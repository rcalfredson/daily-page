import {
  buildForestOwnerGroupReconciliationService,
  FOREST_OWNER_GROUP_RECONCILIATION_VERSION,
  ForestOwnerGroupReconciliationError,
} from '../server/services/forestOwnerGroupReconciliation.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const GROUP_ID = '507f191e810c19729de860ea';
const FOREST_ID = '11111111-1111-4111-8111-111111111111';
const TREE_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-08-04T12:00:00.000Z');
const EARLIER = new Date('2026-07-01T12:00:00.000Z');

function query(value) {
  const chain = {
    session: jasmine.createSpy('session').and.callFake(() => chain),
    lean: jasmine.createSpy('lean').and.resolveTo(value),
  };
  return chain;
}

function tree(overrides = {}) {
  return {
    _id: 'tree-record',
    schemaVersion: 1,
    identityVersion: 1,
    writingTreeId: TREE_ID,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    translationGroupId: GROUP_ID,
    sourceState: 'active',
    sourceStateChangedAt: EARLIER,
    hiddenFromForest: true,
    inclusionChangedAt: EARLIER,
    lastEligibleReconciliationEpoch: 2,
    recordRevision: 4,
    placement: { policyVersion: 1, slot: 7, worldX: -100, worldY: 200 },
    projection: { revision: 1, visualFingerprint: 'stable' },
    policyEvidence: {
      ownerWritingPolicyVersion: 2,
      ownerVariantSelectionVersion: 1,
      writingLifecyclePolicyVersion: 1,
    },
    ...overrides,
  };
}

function world(overrides = {}) {
  return {
    schemaVersion: 1,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    worldRole: 'primary',
    status: 'active',
    placementPolicyVersion: 1,
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1,
    reconciliation: { epoch: 5 },
    ...overrides,
  };
}

function evidence(classification, reasonCode = `${classification}-reason`) {
  return { classification, reasonCode };
}

function harness({
  existingTree = tree(),
  ownerWorld = world(),
  groupEvidence = evidence('eligible'),
  creation = { outcome: 'created', tree: tree() },
} = {}) {
  const hintQuery = query(existingTree);
  const transactionTreeQuery = query(existingTree);
  const findOne = jasmine.createSpy('ForestWritingTree.findOne');
  findOne.and.returnValues(hintQuery, transactionTreeQuery);
  const deletionQuery = query(null);
  const worldQuery = query(ownerWorld);
  const models = {
    AccountDeletionRequest: {
      exists: jasmine.createSpy('AccountDeletionRequest.exists')
        .and.returnValue(deletionQuery),
    },
    Block: {},
    ForestOwnerWorld: {
      findOne: jasmine.createSpy('ForestOwnerWorld.findOne').and.returnValue(worldQuery),
    },
    ForestWritingTree: {
      findOne,
      updateOne: jasmine.createSpy('ForestWritingTree.updateOne')
        .and.resolveTo({ modifiedCount: 1 }),
    },
    User: {},
  };
  const acquireFence = jasmine.createSpy('acquireFence').and.resolveTo({ acquired: true });
  const readGroupEvidence = jasmine.createSpy('readGroupEvidence')
    .and.resolveTo(groupEvidence);
  const createTree = jasmine.createSpy('createTree').and.resolveTo(creation);
  const transactionRunner = jasmine.createSpy('transactionRunner')
    .and.callFake(work => work('transaction-session'));
  const service = buildForestOwnerGroupReconciliationService({
    models,
    acquireFence,
    readGroupEvidence,
    createTree,
    transactionRunner,
  });
  return {
    service,
    models,
    acquireFence,
    readGroupEvidence,
    createTree,
    queries: { deletionQuery, transactionTreeQuery, worldQuery },
  };
}

describe('forest exact owner/group reconciliation', () => {
  it('delegates a missing eligible group to transactional creation', async () => {
    const createdTree = tree({ hiddenFromForest: false });
    const test = harness({
      existingTree: null,
      creation: { outcome: 'created', tree: createdTree },
    });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: NOW,
    });

    expect(result).toEqual({
      reconciliationVersion: FOREST_OWNER_GROUP_RECONCILIATION_VERSION,
      outcome: 'created',
      tree: createdTree,
      evidence: null,
    });
    expect(test.createTree).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: NOW,
    });
    expect(test.acquireFence).not.toHaveBeenCalled();
  });

  it('does nothing when neither a tree nor an eligible founder exists', async () => {
    const test = harness({
      existingTree: null,
      creation: { outcome: 'no-eligible-founder', tree: null },
    });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    });

    expect(result.outcome).toBe('absent');
    expect(result.tree).toBeNull();
  });

  it('marks an eligible active tree with the current epoch without changing its revision', async () => {
    const existing = tree();
    const test = harness({ existingTree: existing });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: NOW,
    });

    expect(result.outcome).toBe('preserved');
    expect(result.tree.lastEligibleReconciliationEpoch).toBe(5);
    expect(result.tree.recordRevision).toBe(4);
    expect(result.tree.sourceStateChangedAt).toBe(EARLIER);
    expect(test.models.ForestWritingTree.updateOne).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        _id: 'tree-record',
        sourceState: 'active',
        recordRevision: 4,
      }),
      { $set: { lastEligibleReconciliationEpoch: 5 } },
      { session: 'transaction-session' },
    );
  });

  it('reactivates the same tree while preserving hide, placement, and projection', async () => {
    const existing = tree({ sourceState: 'inactive' });
    const test = harness({ existingTree: existing });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: NOW,
    });

    expect(result.outcome).toBe('reactivated');
    expect(result.tree).toEqual(jasmine.objectContaining({
      writingTreeId: TREE_ID,
      sourceState: 'active',
      sourceStateChangedAt: NOW,
      hiddenFromForest: true,
      placement: existing.placement,
      projection: existing.projection,
      lastEligibleReconciliationEpoch: 5,
      recordRevision: 5,
    }));
    expect(test.models.ForestWritingTree.updateOne.calls.first().args[1]).toEqual({
      $set: {
        sourceState: 'active',
        sourceStateChangedAt: NOW,
        lastEligibleReconciliationEpoch: 5,
      },
      $inc: { recordRevision: 1 },
    });
  });

  it('deactivates only an active tree proven to have no eligible owner variant', async () => {
    const existing = tree();
    const test = harness({
      existingTree: existing,
      groupEvidence: evidence('ineligible', 'no-eligible-owner-variant'),
    });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: NOW,
    });

    expect(result.outcome).toBe('deactivated');
    expect(result.tree).toEqual(jasmine.objectContaining({
      sourceState: 'inactive',
      sourceStateChangedAt: NOW,
      hiddenFromForest: true,
      recordRevision: 5,
    }));
    expect(result.tree.lastEligibleReconciliationEpoch).toBe(2);
    expect(test.models.ForestWritingTree.updateOne.calls.first().args[1]).toEqual({
      $set: { sourceState: 'inactive', sourceStateChangedAt: NOW },
      $inc: { recordRevision: 1 },
    });
  });

  it('leaves an inactive tree unchanged when it remains ineligible', async () => {
    const existing = tree({ sourceState: 'inactive' });
    const test = harness({
      existingTree: existing,
      groupEvidence: evidence('ineligible'),
    });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    });

    expect(result.outcome).toBe('inactive');
    expect(result.tree).toBe(existing);
    expect(test.models.ForestWritingTree.updateOne).not.toHaveBeenCalled();
  });

  it('preserves the last known-good tree when source evidence is unresolved', async () => {
    const existing = tree();
    const test = harness({
      existingTree: existing,
      groupEvidence: evidence('unresolved', 'invalid-language'),
    });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    });

    expect(result.outcome).toBe('unresolved');
    expect(result.evidence).toEqual({
      classification: 'unresolved',
      reasonCode: 'invalid-language',
    });
    expect(test.models.ForestWritingTree.updateOne).not.toHaveBeenCalled();
  });

  it('uses the account fence and fails closed for deletion, versions, and write conflicts', async () => {
    const deletion = harness();
    deletion.models.AccountDeletionRequest.exists.and.returnValue(query({ _id: 'deletion' }));
    await expectAsync(deletion.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(ForestOwnerGroupReconciliationError, /deletion suppresses/);
    expect(deletion.acquireFence).toHaveBeenCalled();

    const unsupported = harness({
      existingTree: tree({ identityVersion: 2 }),
    });
    await expectAsync(unsupported.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(/unsupported policy versions/);

    const conflict = harness({
      groupEvidence: evidence('ineligible'),
    });
    conflict.models.ForestWritingTree.updateOne.and.resolveTo({ modifiedCount: 0 });
    await expectAsync(conflict.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(/lifecycle state changed/);
  });

  it('rejects malformed inputs and dependencies before mutation', async () => {
    const test = harness();
    await expectAsync(test.service({
      ownerUserId: 'owner',
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(/canonical ObjectId/);
    await expectAsync(test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: new Date('invalid'),
    })).toBeRejectedWithError(/valid Date/);
    expect(() => buildForestOwnerGroupReconciliationService({
      createTree: null,
    })).toThrowError(/createTree must be a function/);
  });
});

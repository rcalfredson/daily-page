import {
  buildForestOwnerTreeInclusionService,
  ForestOwnerTreeInclusionError
} from '../server/services/forestOwnerTreeInclusion.js';

const OWNER = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439012';
const FOREST = '11111111-1111-4111-8111-111111111111';
const TREE = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-08-07T12:00:00.000Z');

function chain(value) {
  return {
    session: jasmine.createSpy('session').and.callFake(() => chain(value)),
    lean: jasmine.createSpy('lean').and.callFake(() => ({
      exec: jasmine.createSpy('exec').and.resolveTo(value)
    }))
  };
}

function awaitedChain(value) {
  return {
    session() { return this; },
    lean: jasmine.createSpy('lean').and.resolveTo(value)
  };
}

function harness(overrides = {}) {
  const tree = {
    _id: 'tree-row', schemaVersion: 1, identityVersion: 1,
    writingTreeId: TREE, forestId: FOREST, ownerUserId: OWNER,
    sourceState: 'active', hiddenFromForest: false,
    inclusionChangedAt: new Date('2026-08-01T00:00:00.000Z'), recordRevision: 4,
    ...overrides.tree
  };
  const models = {
    User: {},
    AccountDeletionRequest: {
      exists: jasmine.createSpy('deletion.exists').and.returnValue(
        awaitedChain(overrides.deletion || null)
      )
    },
    ForestOwnerWorld: {
      findOne: jasmine.createSpy('world.findOne').and.returnValue(chain({
        schemaVersion: 1, forestId: FOREST, ownerUserId: OWNER,
        worldRole: 'primary', status: 'active', ...overrides.world
      }))
    },
    ForestWritingTree: {
      findOne: jasmine.createSpy('tree.findOne').and.returnValue(chain(
        overrides.missingTree ? null : tree
      )),
      updateOne: jasmine.createSpy('tree.updateOne').and.resolveTo(
        overrides.write || { modifiedCount: 1 }
      )
    }
  };
  const acquireFence = jasmine.createSpy('acquireFence').and.resolveTo({ acquired: true });
  const service = buildForestOwnerTreeInclusionService({
    models,
    acquireFence,
    transactionRunner: work => work({ id: 'session' })
  });
  return { service, models, acquireFence, tree };
}

describe('forest owner tree inclusion mutation', () => {
  it('hides an active tree with owner, revision, and state compare-and-set guards', async () => {
    const test = harness();
    const result = await test.service({
      ownerUserId: OWNER, writingTreeId: TREE, hidden: true,
      expectedRevision: 4, now: NOW
    });

    expect(result).toEqual({
      outcome: 'hidden',
      tree: {
        writingTreeId: TREE, hiddenFromForest: true,
        inclusionChangedAt: NOW.toISOString(), recordRevision: 5
      }
    });
    expect(test.acquireFence).toHaveBeenCalled();
    expect(test.models.ForestWritingTree.updateOne).toHaveBeenCalledWith(
      jasmine.objectContaining({
        ownerUserId: OWNER, forestId: FOREST, writingTreeId: TREE,
        sourceState: 'active', hiddenFromForest: false, recordRevision: 4
      }),
      {
        $set: { hiddenFromForest: true, inclusionChangedAt: NOW },
        $inc: { recordRevision: 1 }
      },
      { session: { id: 'session' } }
    );
  });

  it('unhides the same durable identity without changing projection or placement', async () => {
    const test = harness({ tree: { hiddenFromForest: true, recordRevision: 7 } });
    const result = await test.service({
      ownerUserId: OWNER, writingTreeId: TREE, hidden: false,
      expectedRevision: 7, now: NOW
    });
    expect(result.outcome).toBe('unhidden');
    expect(result.tree).toEqual(jasmine.objectContaining({
      writingTreeId: TREE, hiddenFromForest: false, recordRevision: 8
    }));
  });

  it('makes an already-achieved desired state idempotent despite a stale revision', async () => {
    const test = harness({ tree: { hiddenFromForest: true, recordRevision: 8 } });
    const result = await test.service({
      ownerUserId: OWNER, writingTreeId: TREE, hidden: true,
      expectedRevision: 7, now: NOW
    });
    expect(result.outcome).toBe('unchanged');
    expect(result.tree.recordRevision).toBe(8);
    expect(test.models.ForestWritingTree.updateOne).not.toHaveBeenCalled();
  });

  it('rejects stale conflicting and lost compare-and-set writes', async () => {
    const stale = harness({ tree: { recordRevision: 5 } });
    await expectAsync(stale.service({
      ownerUserId: OWNER, writingTreeId: TREE, hidden: true,
      expectedRevision: 4, now: NOW
    })).toBeRejectedWithError(ForestOwnerTreeInclusionError, /revision/);

    const lost = harness({ write: { modifiedCount: 0 } });
    await expectAsync(lost.service({
      ownerUserId: OWNER, writingTreeId: TREE, hidden: true,
      expectedRevision: 4, now: NOW
    })).toBeRejectedWithError(ForestOwnerTreeInclusionError, /concurrently/);
  });

  it('does not enumerate another owner, inactive tree, or missing tree', async () => {
    for (const test of [
      harness({ missingTree: true }),
      harness({ tree: { ownerUserId: OTHER } })
    ]) {
      await expectAsync(test.service({
        ownerUserId: OWNER, writingTreeId: TREE, hidden: true,
        expectedRevision: 4, now: NOW
      })).toBeRejected();
    }
  });

  it('fails closed behind account deletion and validates before acquiring the fence', async () => {
    const deleting = harness({ deletion: { status: 'processing' } });
    await expectAsync(deleting.service({
      ownerUserId: OWNER, writingTreeId: TREE, hidden: true,
      expectedRevision: 4, now: NOW
    })).toBeRejectedWithError(/deletion/);

    const invalid = harness();
    await expectAsync(invalid.service({
      ownerUserId: 'invalid', writingTreeId: TREE, hidden: true,
      expectedRevision: 4, now: NOW
    })).toBeRejectedWithError(/ownerUserId/);
    expect(invalid.acquireFence).not.toHaveBeenCalled();
  });
});

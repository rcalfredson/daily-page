import ForestOwnerWorld from '../server/db/models/ForestOwnerWorld.js';
import {
  buildForestOwnerConvergenceSweep,
  buildForestOwnerConvergenceSweepWorker,
  forestOwnerConvergenceDueIdleWorldFilter,
  forestOwnerConvergenceExpiredRunningWorldFilter,
  FOREST_OWNER_CONVERGENCE_SWEEP_VERSION,
} from '../server/services/forestOwnerConvergenceSweep.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const GROUP_ID = '507f191e810c19729de860ea';
const OTHER_GROUP_ID = '507f191e810c19729de860eb';
const FOREST_ID = '11111111-1111-4111-8111-111111111111';
const TREE_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_TREE_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-08-05T12:00:00.000Z');
const LEASE_TOKEN = 'fixture_convergence_lease_token';

function query(value) {
  const chain = {
    sort: jasmine.createSpy('sort').and.callFake(() => chain),
    limit: jasmine.createSpy('limit').and.callFake(() => chain),
    lean: jasmine.createSpy('lean').and.resolveTo(value),
  };
  return chain;
}

function world({
  epoch = 1,
  phase = 'owner-blocks',
  blockCursor = null,
  treeCursor = null,
  startedAt = NOW,
} = {}) {
  return {
    _id: 'owner-world-record',
    schemaVersion: 1,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    worldRole: 'primary',
    status: 'active',
    placementPolicyVersion: 1,
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1,
    reconciliation: {
      epoch,
      state: 'running',
      phase,
      blockCursor,
      treeCursor,
      startedAt,
      completedAt: null,
      leaseToken: LEASE_TOKEN,
      leaseExpiresAt: new Date(NOW.getTime() + 300_000),
    },
  };
}

function blockPage({
  groups = [GROUP_ID],
  nextCursor = null,
  scannedBlockCount = groups.length,
  reasonCounts = {},
} = {}) {
  return {
    adapterVersion: 1,
    ownerWritingPolicyVersion: 2,
    page: {
      scannedBlockCount,
      eligibleBlockCount: groups.length,
      classificationCounts: { eligible: groups.length, ineligible: 0, unresolved: 0 },
      reasonCounts,
      nextCursor,
    },
    eligibleBlocks: groups.map((translationGroupId, index) => ({
      blockId: `507f1f77bcf86cd7994390${20 + index}`,
      ownerUserId: OWNER_USER_ID,
      translationGroupId,
    })),
  };
}

function tree(overrides = {}) {
  return {
    _id: 'tree-record',
    schemaVersion: 1,
    identityVersion: 1,
    ownerUserId: OWNER_USER_ID,
    translationGroupId: GROUP_ID,
    writingTreeId: TREE_ID,
    ...overrides,
  };
}

function harness({
  claimResults = [null, world()],
  page = blockPage(),
  treeRows = [],
  reconciliationOutcome = 'preserved',
  reconciliationError = null,
} = {}) {
  const ForestOwnerWorldModel = {
    findOneAndUpdate: jasmine.createSpy('ForestOwnerWorld.findOneAndUpdate')
      .and.callFake(() => query(claimResults.shift() || null)),
    updateOne: jasmine.createSpy('ForestOwnerWorld.updateOne')
      .and.resolveTo({ modifiedCount: 1 }),
  };
  const treeQuery = query(treeRows);
  const ForestWritingTreeModel = {
    find: jasmine.createSpy('ForestWritingTree.find').and.returnValue(treeQuery),
  };
  const listBlockPage = jasmine.createSpy('listBlockPage').and.resolveTo(page);
  const reconcileGroup = jasmine.createSpy('reconcileGroup');
  if (reconciliationError) reconcileGroup.and.rejectWith(reconciliationError);
  else reconcileGroup.and.resolveTo({ outcome: reconciliationOutcome });
  return {
    run: buildForestOwnerConvergenceSweep({
      ForestOwnerWorldModel,
      ForestWritingTreeModel,
      listBlockPage,
      reconcileGroup,
      generateLeaseToken: () => LEASE_TOKEN,
    }),
    ForestOwnerWorldModel,
    ForestWritingTreeModel,
    listBlockPage,
    reconcileGroup,
    treeQuery,
  };
}

describe('forest owner convergence sweep', () => {
  it('starts one new epoch, deduplicates a bounded Block page, then advances its cursor', async () => {
    const cursor = 'next-block-cursor';
    const test = harness({
      page: blockPage({ groups: [GROUP_ID, GROUP_ID, OTHER_GROUP_ID], nextCursor: cursor }),
    });

    const result = await test.run({
      ownerUserId: OWNER_USER_ID,
      blockPageSize: 3,
      now: NOW,
    });

    expect(result.sweepVersion).toBe(FOREST_OWNER_CONVERGENCE_SWEEP_VERSION);
    expect(result.outcome).toBe('progressed');
    expect(result.epoch).toBe(1);
    expect(result.phase).toBe('owner-blocks');
    expect(result.diagnostics).toEqual({
      scannedBlocks: 3,
      scannedTrees: 0,
      reconciledGroups: 2,
      reconciliationOutcomes: { preserved: 2 },
      reasonCounts: {},
    });
    expect(test.reconcileGroup.calls.allArgs()).toEqual([
      [{ ownerUserId: OWNER_USER_ID, translationGroupId: GROUP_ID, now: NOW }],
      [{ ownerUserId: OWNER_USER_ID, translationGroupId: OTHER_GROUP_ID, now: NOW }],
    ]);
    expect(test.ForestOwnerWorldModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(test.ForestOwnerWorldModel.findOneAndUpdate.calls.argsFor(1)[1]).toEqual({
      $set: {
        'reconciliation.state': 'running',
        'reconciliation.phase': 'owner-blocks',
        'reconciliation.blockCursor': null,
        'reconciliation.treeCursor': null,
        'reconciliation.startedAt': NOW,
        'reconciliation.completedAt': null,
        'reconciliation.leaseToken': LEASE_TOKEN,
        'reconciliation.leaseExpiresAt': new Date(NOW.getTime() + 300_000),
      },
      $inc: { 'reconciliation.epoch': 1 },
    });
    expect(test.ForestOwnerWorldModel.updateOne.calls.argsFor(0)[1].$set)
      .toEqual(jasmine.objectContaining({ 'reconciliation.blockCursor': cursor }));
  });

  it('resumes an expired lease at the stored epoch and Block cursor', async () => {
    const resumed = world({ epoch: 7, blockCursor: 'stored-cursor' });
    const test = harness({ claimResults: [resumed], page: blockPage() });

    const result = await test.run({ ownerUserId: OWNER_USER_ID, now: NOW });

    expect(result.epoch).toBe(7);
    expect(test.ForestOwnerWorldModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(test.listBlockPage).toHaveBeenCalledOnceWith({
      authenticatedOwnerId: OWNER_USER_ID,
      cursor: 'stored-cursor',
      limit: 25,
    });
  });

  it('does not advance a page when any exact-group reconciliation fails', async () => {
    const failure = new Error('transient failure');
    const test = harness({ reconciliationError: failure });

    await expectAsync(test.run({
      ownerUserId: OWNER_USER_ID,
      now: NOW,
    })).toBeRejectedWith(failure);

    expect(test.ForestOwnerWorldModel.updateOne).not.toHaveBeenCalled();
  });

  it('transitions from Block enrollment through unseen trees and completes atomically', async () => {
    const test = harness({
      page: blockPage({ groups: [], scannedBlockCount: 0 }),
      treeRows: [tree()],
      reconciliationOutcome: 'deactivated',
    });

    const result = await test.run({
      ownerUserId: OWNER_USER_ID,
      blockPageSize: 2,
      treePageSize: 2,
      maxSteps: 2,
      now: NOW,
    });

    expect(result.outcome).toBe('completed');
    expect(result.phase).toBeNull();
    expect(result.diagnostics.scannedTrees).toBe(1);
    expect(result.diagnostics.reconciliationOutcomes).toEqual({ deactivated: 1 });
    expect(test.ForestWritingTreeModel.find).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      sourceState: 'active',
      lastEligibleReconciliationEpoch: { $ne: 1 },
    }, jasmine.any(Object));
    const completion = test.ForestOwnerWorldModel.updateOne.calls.mostRecent().args[1].$set;
    expect(completion).toEqual({
      'reconciliation.state': 'idle',
      'reconciliation.phase': null,
      'reconciliation.blockCursor': null,
      'reconciliation.treeCursor': null,
      'reconciliation.startedAt': null,
      'reconciliation.completedAt': NOW,
      'reconciliation.leaseToken': null,
      'reconciliation.leaseExpiresAt': null,
    });
  });

  it('pages unseen trees and preserves unsupported records as bounded diagnostics', async () => {
    const current = world({ epoch: 4, phase: 'unseen-trees' });
    const test = harness({
      claimResults: [current],
      treeRows: [
        tree(),
        tree({
          _id: 'unsupported-tree',
          schemaVersion: 2,
          translationGroupId: OTHER_GROUP_ID,
          writingTreeId: OTHER_TREE_ID,
        }),
        tree({ writingTreeId: '44444444-4444-4444-8444-444444444444' }),
      ],
    });

    const result = await test.run({
      ownerUserId: OWNER_USER_ID,
      treePageSize: 2,
      now: NOW,
    });

    expect(result.outcome).toBe('progressed');
    expect(result.phase).toBe('unseen-trees');
    expect(result.diagnostics).toEqual({
      scannedBlocks: 0,
      scannedTrees: 2,
      reconciledGroups: 1,
      reconciliationOutcomes: { preserved: 1 },
      reasonCounts: { 'unsupported-or-malformed-tree': 1 },
    });
    expect(test.ForestOwnerWorldModel.updateOne.calls.argsFor(0)[1].$set)
      .toEqual(jasmine.objectContaining({ 'reconciliation.treeCursor': OTHER_TREE_ID }));
  });

  it('returns not-claimable for a live lease and rejects unsafe inputs', async () => {
    const test = harness({ claimResults: [null, null] });
    const result = await test.run({ ownerUserId: OWNER_USER_ID, now: NOW });
    expect(result.outcome).toBe('not-claimable');
    expect(test.listBlockPage).not.toHaveBeenCalled();

    await expectAsync(test.run({
      ownerUserId: 'owner',
      now: NOW,
    })).toBeRejectedWithError(/canonical ObjectId/);
    await expectAsync(test.run({
      ownerUserId: OWNER_USER_ID,
      blockPageSize: 101,
      now: NOW,
    })).toBeRejectedWithError(/blockPageSize/);
  });

  it('declares separate indexes for resumable and due owner worlds', () => {
    const indexes = new Map(ForestOwnerWorld.schema.indexes()
      .map(([fields, options]) => [options.name, fields]));
    expect(indexes.get('forest_owner_convergence_running')).toEqual({
      status: 1,
      worldRole: 1,
      'reconciliation.state': 1,
      'reconciliation.leaseExpiresAt': 1,
      ownerUserId: 1,
    });
    expect(indexes.get('forest_owner_convergence_due')).toEqual({
      status: 1,
      worldRole: 1,
      'reconciliation.state': 1,
      'reconciliation.completedAt': 1,
      ownerUserId: 1,
    });
  });
});

describe('forest owner convergence sweep worker', () => {
  function findQuery(rows) {
    return query(rows);
  }

  it('prioritizes expired running worlds before filling its bound with due idle worlds', async () => {
    const ForestOwnerWorldModel = {
      find: jasmine.createSpy('find').and.returnValues(
        findQuery([{ ownerUserId: OWNER_USER_ID }]),
        findQuery([{ ownerUserId: '507f1f77bcf86cd799439012' }]),
      ),
    };
    const runSweepStep = jasmine.createSpy('runSweepStep').and.returnValues(
      Promise.resolve({ outcome: 'progressed' }),
      Promise.resolve({ outcome: 'completed' }),
    );
    const worker = buildForestOwnerConvergenceSweepWorker({
      ForestOwnerWorldModel,
      runSweepStep,
    });

    const totals = await worker({ limit: 2, intervalMs: 60_000, now: NOW });

    expect(totals).toEqual({
      selected: 2,
      progressed: 1,
      completed: 1,
      notClaimable: 0,
      failed: 0,
    });
    expect(ForestOwnerWorldModel.find.calls.argsFor(0)[0])
      .toEqual(forestOwnerConvergenceExpiredRunningWorldFilter(NOW));
    expect(ForestOwnerWorldModel.find.calls.argsFor(1)[0])
      .toEqual(forestOwnerConvergenceDueIdleWorldFilter(NOW, 60_000));
    expect(runSweepStep.calls.allArgs()).toEqual([
      [{ ownerUserId: OWNER_USER_ID, now: NOW, maxSteps: 10 }],
      [{ ownerUserId: '507f1f77bcf86cd799439012', now: NOW, maxSteps: 10 }],
    ]);
  });

  it('allows a smaller bounded per-owner step budget', async () => {
    const ForestOwnerWorldModel = {
      find: jasmine.createSpy('find').and.returnValues(
        findQuery([{ ownerUserId: OWNER_USER_ID }]),
        findQuery([]),
      ),
    };
    const runSweepStep = jasmine.createSpy('runSweepStep').and.resolveTo({
      outcome: 'progressed',
    });
    const worker = buildForestOwnerConvergenceSweepWorker({
      ForestOwnerWorldModel,
      runSweepStep,
    });

    await worker({ stepsPerOwner: 3, now: NOW });

    expect(runSweepStep).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      now: NOW,
      maxSteps: 3,
    });
  });

  it('isolates owner failures and logs no owner identity', async () => {
    const ForestOwnerWorldModel = {
      find: jasmine.createSpy('find').and.returnValues(
        findQuery([{ ownerUserId: OWNER_USER_ID }]),
        findQuery([]),
      ),
    };
    const failure = new Error(`failed owner ${OWNER_USER_ID}`);
    failure.name = 'MongoNetworkError';
    const logger = { error: jasmine.createSpy('error') };
    const worker = buildForestOwnerConvergenceSweepWorker({
      ForestOwnerWorldModel,
      runSweepStep: jasmine.createSpy('runSweepStep').and.rejectWith(failure),
      logger,
    });

    const totals = await worker({ limit: 2, now: NOW });

    expect(totals.failed).toBe(1);
    expect(logger.error).toHaveBeenCalledOnceWith(
      'Failed forest owner convergence sweep:',
      { error: 'MongoNetworkError' },
    );
    expect(JSON.stringify(logger.error.calls.allArgs())).not.toContain(OWNER_USER_ID);
  });
});

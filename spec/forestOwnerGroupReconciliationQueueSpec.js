import ForestOwnerGroupReconciliationJob from '../server/db/models/ForestOwnerGroupReconciliationJob.js';
import {
  buildForestOwnerGroupReconciliationEnqueuer,
  buildForestOwnerGroupReconciliationWorker,
  enqueueForestOwnerGroupReconciliationForBlock,
} from '../server/services/forestOwnerGroupReconciliationQueue.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const GROUP_ID = '507f191e810c19729de860ea';
const NOW = new Date('2026-08-05T12:00:00.000Z');

function query(value, error = null) {
  return {
    lean: jasmine.createSpy('lean').and.callFake(async () => {
      if (error) throw error;
      return value;
    }),
  };
}

function job(overrides = {}) {
  return {
    _id: 'job-1',
    schemaVersion: 1,
    ownerUserId: OWNER_USER_ID,
    translationGroupId: GROUP_ID,
    status: 'pending',
    requestedRevision: 3,
    attempts: 1,
    availableAt: NOW,
    leaseToken: 'fixture_lease_token_1234567890',
    leaseExpiresAt: new Date(NOW.getTime() + 120_000),
    ...overrides,
  };
}

function workerHarness({
  jobs = [job(), null],
  reconcileError = null,
  deletedCount = 1,
  modifiedCount = 1,
} = {}) {
  const JobModel = {
    findOneAndUpdate: jasmine.createSpy('findOneAndUpdate')
      .and.callFake(() => query(jobs.shift())),
    deleteOne: jasmine.createSpy('deleteOne').and.resolveTo({ deletedCount }),
    updateOne: jasmine.createSpy('updateOne').and.resolveTo({ modifiedCount }),
  };
  const reconcile = jasmine.createSpy('reconcile');
  if (reconcileError) reconcile.and.rejectWith(reconcileError);
  else reconcile.and.resolveTo({ outcome: 'preserved' });
  return {
    JobModel,
    reconcile,
    worker: buildForestOwnerGroupReconciliationWorker({
      JobModel,
      reconcile,
      generateLeaseToken: () => 'fixture_lease_token_1234567890',
    }),
  };
}

describe('forest owner/group reconciliation queue', () => {
  it('validates durable job state and declares dedupe, worker, and deletion indexes', async () => {
    const valid = new ForestOwnerGroupReconciliationJob({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      requestedRevision: 1,
      availableAt: NOW,
    });
    await expectAsync(valid.validate()).toBeResolved();

    const incompleteLease = new ForestOwnerGroupReconciliationJob({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      requestedRevision: 1,
      availableAt: NOW,
      leaseToken: 'fixture_lease_token_1234567890',
    });
    await expectAsync(incompleteLease.validate()).toBeRejectedWithError(/both token and expiry/);

    const failedLease = new ForestOwnerGroupReconciliationJob({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      requestedRevision: 1,
      availableAt: NOW,
      status: 'failed',
      leaseToken: 'fixture_lease_token_1234567890',
      leaseExpiresAt: new Date(NOW.getTime() + 1_000),
    });
    await expectAsync(failedLease.validate()).toBeRejectedWithError(/cannot retain a lease/);

    const indexes = new Map(ForestOwnerGroupReconciliationJob.schema.indexes()
      .map(([fields, options]) => [options.name, { fields, options }]));
    expect(indexes.get('unique_forest_owner_group_reconciliation_job')).toEqual({
      fields: { ownerUserId: 1, translationGroupId: 1 },
      options: jasmine.objectContaining({ unique: true }),
    });
    expect(indexes.get('forest_owner_group_reconciliation_worker').fields).toEqual({
      status: 1,
      availableAt: 1,
      leaseExpiresAt: 1,
      _id: 1,
    });
    expect(indexes.get('forest_owner_group_reconciliation_deletion').fields).toEqual({
      ownerUserId: 1,
      _id: 1,
    });
  });

  it('upserts and increments one durable owner/group job per request', async () => {
    const JobModel = {
      findOneAndUpdate: jasmine.createSpy('findOneAndUpdate')
        .and.returnValue(query(job({ requestedRevision: 4 }))),
    };
    const acquireFence = jasmine.createSpy('acquireFence').and.resolveTo({ acquired: true });
    const UserModel = {};
    const enqueue = buildForestOwnerGroupReconciliationEnqueuer({
      JobModel,
      UserModel,
      acquireFence,
      transactionRunner: work => work('transaction-session'),
    });

    const result = await enqueue({
      ownerUserId: OWNER_USER_ID.toUpperCase(),
      translationGroupId: GROUP_ID,
      now: NOW,
    });

    expect(result.requestedRevision).toBe(4);
    expect(JobModel.findOneAndUpdate).toHaveBeenCalledOnceWith(
      { ownerUserId: OWNER_USER_ID, translationGroupId: GROUP_ID },
      {
        $setOnInsert: { schemaVersion: 1 },
        $set: {
          status: 'pending',
          attempts: 0,
          availableAt: NOW,
          lastErrorCode: null,
        },
        $inc: { requestedRevision: 1 },
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
        session: 'transaction-session',
      },
    );
    expect(acquireFence).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      session: 'transaction-session',
      UserModel,
    });
  });

  it('recovers a concurrent upsert race without creating another identity', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { code: 11_000 });
    const JobModel = {
      findOneAndUpdate: jasmine.createSpy('findOneAndUpdate').and.returnValues(
        query(null, duplicate),
        query(job({ requestedRevision: 2 })),
      ),
    };
    const transactionRunner = jasmine.createSpy('transactionRunner')
      .and.callFake(work => work('transaction-session'));
    const enqueue = buildForestOwnerGroupReconciliationEnqueuer({
      JobModel,
      transactionRunner,
      acquireFence: jasmine.createSpy('acquireFence').and.resolveTo({ acquired: true }),
    });

    const result = await enqueue({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: NOW,
    });

    expect(result.requestedRevision).toBe(2);
    expect(JobModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(transactionRunner).toHaveBeenCalledTimes(2);
    expect(JobModel.findOneAndUpdate.calls.mostRecent().args[2].upsert).toBeFalse();
  });

  it('keeps post success independent of queue failure and skips ownerless Blocks', async () => {
    const logger = { error: jasmine.createSpy('error') };
    const queueError = new Error(`private ${OWNER_USER_ID}`);
    queueError.name = 'MongoNetworkError';
    const enqueue = jasmine.createSpy('enqueue').and.rejectWith(queueError);

    const failed = await enqueueForestOwnerGroupReconciliationForBlock({
      block: {
        userId: OWNER_USER_ID,
        groupId: GROUP_ID,
        authorshipState: 'live',
      },
      enqueue,
      logger,
      now: NOW,
    });
    const skipped = await enqueueForestOwnerGroupReconciliationForBlock({
      block: { groupId: GROUP_ID, authorshipState: 'live' },
      enqueue,
      logger,
      now: NOW,
    });

    expect(failed).toEqual({ scheduled: false, reason: 'enqueue-failed' });
    expect(skipped).toEqual({ scheduled: false, reason: 'ineligible-block-identity' });
    expect(logger.error).toHaveBeenCalledOnceWith(
      'Failed to enqueue forest owner-group reconciliation:',
      { error: 'MongoNetworkError' },
    );
    expect(JSON.stringify(logger.error.calls.allArgs())).not.toContain(OWNER_USER_ID);
  });

  it('leases, reconciles, and conditionally removes completed work', async () => {
    const test = workerHarness();

    const totals = await test.worker({ limit: 2, now: NOW });

    expect(totals).toEqual({
      claimed: 1,
      completed: 1,
      superseded: 0,
      retried: 0,
      failed: 0,
      dropped: 0,
    });
    expect(test.reconcile).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: NOW,
    });
    expect(test.JobModel.deleteOne).toHaveBeenCalledOnceWith({
      _id: 'job-1',
      leaseToken: 'fixture_lease_token_1234567890',
      requestedRevision: 3,
    });
    const [claimFilter, claimUpdate, claimOptions] =
      test.JobModel.findOneAndUpdate.calls.first().args;
    expect(claimFilter).toEqual({
      status: 'pending',
      availableAt: { $lte: NOW },
      $or: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { $lte: NOW } },
      ],
    });
    expect(claimUpdate.$inc).toEqual({ attempts: 1 });
    expect(claimOptions.sort).toEqual({ availableAt: 1, _id: 1 });
  });

  it('starts each production lease from that job actual claim time', async () => {
    const later = new Date(NOW.getTime() + 90_000);
    const JobModel = {
      findOneAndUpdate: jasmine.createSpy('findOneAndUpdate').and.returnValues(
        query(job({ _id: 'job-1' })),
        query(job({ _id: 'job-2' })),
      ),
      deleteOne: jasmine.createSpy('deleteOne').and.resolveTo({ deletedCount: 1 }),
      updateOne: jasmine.createSpy('updateOne').and.resolveTo({ modifiedCount: 1 }),
    };
    const reconcile = jasmine.createSpy('reconcile').and.resolveTo({ outcome: 'preserved' });
    const clock = jasmine.createSpy('clock').and.returnValues(NOW, later);
    const worker = buildForestOwnerGroupReconciliationWorker({
      JobModel,
      reconcile,
      clock,
      generateLeaseToken: () => 'fixture_lease_token_1234567890',
    });

    const totals = await worker({ limit: 2 });

    expect(totals.completed).toBe(2);
    expect(clock).toHaveBeenCalledTimes(2);
    expect(JobModel.findOneAndUpdate.calls.argsFor(0)[1].$set.leaseExpiresAt)
      .toEqual(new Date(NOW.getTime() + 120_000));
    expect(JobModel.findOneAndUpdate.calls.argsFor(1)[1].$set.leaseExpiresAt)
      .toEqual(new Date(later.getTime() + 120_000));
    expect(reconcile.calls.argsFor(0)[0].now).toBe(NOW);
    expect(reconcile.calls.argsFor(1)[0].now).toBe(later);
  });

  it('releases a successful lease when a newer request supersedes the claim', async () => {
    const test = workerHarness({ deletedCount: 0, jobs: [job(), null] });

    const totals = await test.worker({ limit: 1, now: NOW });

    expect(totals.superseded).toBe(1);
    expect(test.JobModel.updateOne).toHaveBeenCalledWith(
      { _id: 'job-1', leaseToken: 'fixture_lease_token_1234567890' },
      {
        $set: {
          status: 'pending',
          availableAt: NOW,
          leaseToken: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
        },
      },
    );
  });

  it('backs off bounded failures and preserves only a bounded error code', async () => {
    const failure = new Error(`database failed for ${OWNER_USER_ID}`);
    failure.name = 'MongoNetworkError';
    const test = workerHarness({ reconcileError: failure });

    const totals = await test.worker({ limit: 1, now: NOW, maxAttempts: 8 });

    expect(totals.retried).toBe(1);
    const update = test.JobModel.updateOne.calls.first().args[1].$set;
    expect(update).toEqual({
      status: 'pending',
      availableAt: new Date(NOW.getTime() + 15_000),
      leaseToken: null,
      leaseExpiresAt: null,
      lastErrorCode: 'MONGO_NETWORK_ERROR',
    });
    expect(JSON.stringify(update)).not.toContain(OWNER_USER_ID);
  });

  it('parks exhausted work and drops jobs for deleted owners', async () => {
    const exhausted = workerHarness({
      jobs: [job({ attempts: 3 }), null],
      reconcileError: new Error('still broken'),
    });
    const exhaustedTotals = await exhausted.worker({
      limit: 1,
      now: NOW,
      maxAttempts: 3,
    });
    expect(exhaustedTotals.failed).toBe(1);
    expect(exhausted.JobModel.updateOne.calls.first().args[1].$set.status).toBe('failed');

    const ownerError = Object.assign(new Error('owner gone'), {
      code: 'FOREST_OWNER_UNAVAILABLE',
    });
    const deletedOwner = workerHarness({ reconcileError: ownerError });
    const deletedTotals = await deletedOwner.worker({ limit: 1, now: NOW });
    expect(deletedTotals.dropped).toBe(1);
    expect(deletedOwner.JobModel.deleteOne).toHaveBeenCalledOnceWith({
      _id: 'job-1',
      leaseToken: 'fixture_lease_token_1234567890',
    });
  });

  it('rejects unsafe worker bounds and dependencies before claiming', async () => {
    const test = workerHarness();
    await expectAsync(test.worker({ limit: 0 })).toBeRejectedWithError(/limit/);
    await expectAsync(test.worker({ leaseMs: 1_000 })).toBeRejectedWithError(/leaseMs/);
    await expectAsync(test.worker({ maxAttempts: 21 })).toBeRejectedWithError(/maxAttempts/);
    expect(() => buildForestOwnerGroupReconciliationWorker({
      JobModel: {},
    })).toThrowError(/findOneAndUpdate/);
  });
});

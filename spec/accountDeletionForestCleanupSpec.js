import AccountDeletionRequest from '../server/db/models/AccountDeletionRequest.js';
import User from '../server/db/models/User.js';
import {
  accountDeletionCleanupHasConverged,
  DELETION_EVIDENCE_RETENTION_MS,
  scheduleAccountDeletionEvidenceExpiry,
  scheduleConvergedAccountDeletionEvidenceExpiries
} from '../server/services/accountDeletionEvidence.js';
import {
  cleanUpAccountDeletionForests
} from '../server/services/accountDeletionForestCleanup.js';
import {
  cleanUpAccountDeletionMedia
} from '../server/services/accountDeletionMedia.js';
import {
  acquireForestLedgerFence,
  ForestLedgerFenceError
} from '../server/services/forestLedgerFence.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const NOW = new Date('2026-08-02T14:00:00.000Z');

function requestQuery(requests) {
  return {
    sort: jasmine.createSpy('sort').and.callFake(() => ({
      limit: jasmine.createSpy('limit').and.resolveTo(requests)
    }))
  };
}

function treeQuery(pages) {
  return {
    sort: jasmine.createSpy('sort').and.callFake(function sort() { return this; }),
    limit: jasmine.createSpy('limit').and.callFake(function limit() { return this; }),
    lean: jasmine.createSpy('lean').and.callFake(async () => pages.shift() || [])
  };
}

function leanQuery(values) {
  return {
    sort: jasmine.createSpy('sort').and.callFake(function sort() { return this; }),
    limit: jasmine.createSpy('limit').and.callFake(function limit() { return this; }),
    lean: jasmine.createSpy('lean').and.resolveTo(values)
  };
}

function deletionRequest(overrides = {}) {
  return {
    _id: 'request-1',
    ownerUserId: OWNER_USER_ID,
    status: 'completed',
    profileMedia: { status: 'none' },
    forestCleanup: { status: 'pending' },
    ...overrides
  };
}

function cleanupHarness({
  authoredObjectPages = [[]],
  authoredRegionRevisionPages = [[]],
  authoredResetOperationPages = [[]],
  treePages = [[]],
  remainingAuthoredObject = null,
  remainingAuthoredRegionRevision = null,
  remainingAuthoredResetOperation = null,
  deletedJobs = 0,
  remainingTree = null,
  remainingJob = null,
  remainingWorld = null
} = {}) {
  const requests = [deletionRequest()];
  const AccountDeletionRequestModel = {
    find: jasmine.createSpy('AccountDeletionRequest.find')
      .and.returnValue(requestQuery(requests)),
    updateOne: jasmine.createSpy('AccountDeletionRequest.updateOne')
      .and.resolveTo({ modifiedCount: 1 })
  };
  function boundedModel(name, pages, remaining) {
    return {
      find: jasmine.createSpy(`${name}.find`).and.callFake(() => treeQuery(pages)),
      deleteMany: jasmine.createSpy(`${name}.deleteMany`)
        .and.callFake(async filter => ({ deletedCount: filter._id.$in.length })),
      exists: jasmine.createSpy(`${name}.exists`).and.resolveTo(remaining)
    };
  }
  const ForestAuthoredObjectModel = boundedModel(
    'ForestAuthoredObject', authoredObjectPages, remainingAuthoredObject
  );
  const ForestAuthoredRegionRevisionModel = boundedModel(
    'ForestAuthoredRegionRevision',
    authoredRegionRevisionPages,
    remainingAuthoredRegionRevision
  );
  const ForestAuthoredResetOperationModel = boundedModel(
    'ForestAuthoredResetOperation',
    authoredResetOperationPages,
    remainingAuthoredResetOperation
  );
  const ForestWritingTreeModel = {
    find: jasmine.createSpy('ForestWritingTree.find')
      .and.callFake(() => treeQuery(treePages)),
    deleteMany: jasmine.createSpy('ForestWritingTree.deleteMany')
      .and.callFake(async filter => ({ deletedCount: filter._id.$in.length })),
    exists: jasmine.createSpy('ForestWritingTree.exists').and.resolveTo(remainingTree)
  };
  const ForestOwnerGroupReconciliationJobModel = {
    deleteMany: jasmine.createSpy('ForestOwnerGroupReconciliationJob.deleteMany')
      .and.resolveTo({ deletedCount: deletedJobs }),
    exists: jasmine.createSpy('ForestOwnerGroupReconciliationJob.exists')
      .and.resolveTo(remainingJob)
  };
  const ForestOwnerWorldModel = {
    deleteMany: jasmine.createSpy('ForestOwnerWorld.deleteMany')
      .and.resolveTo({ deletedCount: 1 }),
    exists: jasmine.createSpy('ForestOwnerWorld.exists').and.resolveTo(remainingWorld)
  };
  const scheduleEvidenceExpiry = jasmine.createSpy('scheduleEvidenceExpiry')
    .and.resolveTo({ scheduled: true });
  const logger = { error: jasmine.createSpy('error') };

  return {
    AccountDeletionRequestModel,
    ForestAuthoredObjectModel,
    ForestAuthoredRegionRevisionModel,
    ForestAuthoredResetOperationModel,
    ForestOwnerGroupReconciliationJobModel,
    ForestWritingTreeModel,
    ForestOwnerWorldModel,
    scheduleEvidenceExpiry,
    logger
  };
}

describe('account-deletion forest cleanup', () => {
  it('adds a safe User fence and backward-compatible cleanup state', async () => {
    const user = new User({
      username: 'forest-writer',
      email: 'forest-writer@example.com',
      password: 'hash'
    });
    const historicalRequest = new AccountDeletionRequest({
      ownerUserId: OWNER_USER_ID,
      disposition: 'delete',
      status: 'completed',
      startedAt: NOW,
      completedAt: NOW,
      profileMedia: { status: 'none' }
    });

    await expectAsync(user.validate()).toBeResolved();
    await expectAsync(historicalRequest.validate()).toBeResolved();
    expect(user.forestLedgerFence).toBe(0);
    expect(historicalRequest.forestCleanup.toObject()).toEqual({
      status: 'not-required',
      attempts: 0,
      lastAttemptAt: null,
      completedAt: null
    });
  });

  it('rejects malformed fences and incoherent forest-cleanup completion', async () => {
    const user = new User({
      username: 'forest-writer',
      email: 'forest-writer@example.com',
      password: 'hash',
      forestLedgerFence: 0.5
    });
    const missingCompletion = new AccountDeletionRequest({
      ownerUserId: OWNER_USER_ID,
      disposition: 'delete',
      status: 'completed',
      startedAt: NOW,
      completedAt: NOW,
      forestCleanup: { status: 'completed' }
    });

    await expectAsync(user.validate()).toBeRejectedWithError(/Forest ledger fence/);
    await expectAsync(missingCompletion.validate()).toBeRejectedWithError(/completion time/);
  });

  it('acquires the User write fence only inside a live owner transaction', async () => {
    const UserModel = {
      updateOne: jasmine.createSpy('User.updateOne').and.resolveTo({ matchedCount: 1 })
    };

    const result = await acquireForestLedgerFence({
      ownerUserId: OWNER_USER_ID,
      session: 'session',
      UserModel
    });

    expect(UserModel.updateOne).toHaveBeenCalledOnceWith(
      { _id: OWNER_USER_ID },
      { $inc: { forestLedgerFence: 1 } },
      { session: 'session' }
    );
    expect(result).toEqual({ ownerUserId: OWNER_USER_ID, acquired: true });
  });

  it('fails the fence closed after account deletion wins the User write', async () => {
    const UserModel = {
      updateOne: jasmine.createSpy('User.updateOne').and.resolveTo({ matchedCount: 0 })
    };

    await expectAsync(acquireForestLedgerFence({
      ownerUserId: OWNER_USER_ID,
      session: 'session',
      UserModel
    })).toBeRejectedWithError(ForestLedgerFenceError, 'FOREST_OWNER_UNAVAILABLE');
    await expectAsync(acquireForestLedgerFence({
      ownerUserId: OWNER_USER_ID,
      session: null,
      UserModel
    })).toBeRejectedWithError(ForestLedgerFenceError, 'FOREST_LEDGER_TRANSACTION_REQUIRED');
  });

  it('declares the pending forest-cleanup worker index', () => {
    const indexes = new Map(AccountDeletionRequest.schema.indexes().map(([fields, options]) => (
      [options.name, fields]
    )));

    expect(indexes.get('account_deletion_forest_cleanup')).toEqual({
      'forestCleanup.status': 1,
      completedAt: 1
    });
    expect(indexes.get('account_deletion_cleanup_convergence')).toEqual({
      status: 1,
      evidenceExpiresAt: 1,
      'profileMedia.status': 1,
      'forestCleanup.status': 1,
      completedAt: 1
    });
  });

  it('recognizes convergence only after both asynchronous cleanups are terminal', () => {
    expect(accountDeletionCleanupHasConverged({
      status: 'completed',
      profileMedia: { status: 'none' },
      forestCleanup: { status: 'completed' }
    })).toBeTrue();
    expect(accountDeletionCleanupHasConverged({
      status: 'completed',
      profileMedia: { status: 'not-managed' },
      forestCleanup: { status: 'not-required' }
    })).toBeTrue();
    expect(accountDeletionCleanupHasConverged({
      status: 'completed',
      profileMedia: { status: 'pending' },
      forestCleanup: { status: 'completed' }
    })).toBeFalse();
    expect(accountDeletionCleanupHasConverged({
      status: 'completed',
      profileMedia: { status: 'deleted' },
      forestCleanup: { status: 'pending' }
    })).toBeFalse();
  });

  it('schedules one owner-keyed expiry only when atomic convergence matches', async () => {
    const AccountDeletionRequestModel = {
      updateOne: jasmine.createSpy('updateOne').and.resolveTo({ modifiedCount: 1 })
    };

    const result = await scheduleAccountDeletionEvidenceExpiry({
      ownerUserId: OWNER_USER_ID,
      AccountDeletionRequestModel,
      now: NOW
    });

    const evidenceExpiresAt = new Date(NOW.getTime() + DELETION_EVIDENCE_RETENTION_MS);
    expect(AccountDeletionRequestModel.updateOne).toHaveBeenCalledOnceWith(
      {
        ownerUserId: OWNER_USER_ID,
        status: 'completed',
        evidenceExpiresAt: null,
        'profileMedia.status': { $in: ['deleted', 'not-managed', 'none'] },
        'forestCleanup.status': { $in: ['completed', 'not-required'] }
      },
      { $set: { evidenceExpiresAt } }
    );
    expect(result).toEqual({ scheduled: true, evidenceExpiresAt });
  });

  it('retries converged evidence that missed its first expiry-scheduling attempt', async () => {
    const requests = [
      { ownerUserId: OWNER_USER_ID },
      { ownerUserId: '507f1f77bcf86cd799439012' }
    ];
    const AccountDeletionRequestModel = {
      find: jasmine.createSpy('find').and.returnValue(leanQuery(requests))
    };
    const expiryError = new Error('temporarily unavailable');
    expiryError.name = 'MongoNetworkError';
    const scheduleEvidenceExpiry = jasmine.createSpy('scheduleEvidenceExpiry')
      .and.returnValues(
        Promise.resolve({ scheduled: true }),
        Promise.reject(expiryError)
      );
    const logger = { error: jasmine.createSpy('error') };

    const result = await scheduleConvergedAccountDeletionEvidenceExpiries({
      limit: 2,
      AccountDeletionRequestModel,
      scheduleEvidenceExpiry,
      logger,
      now: NOW
    });

    expect(AccountDeletionRequestModel.find).toHaveBeenCalledWith({
      status: 'completed',
      evidenceExpiresAt: null,
      'profileMedia.status': { $in: ['deleted', 'not-managed', 'none'] },
      'forestCleanup.status': { $in: ['completed', 'not-required'] }
    }, { ownerUserId: 1 });
    expect(result).toEqual({ inspected: 2, scheduled: 1, failed: 1 });
    expect(logger.error).toHaveBeenCalledOnceWith(
      'Failed account-deletion evidence expiry scheduling:',
      { error: 'MongoNetworkError' }
    );
    expect(JSON.stringify(logger.error.calls.mostRecent().args))
      .not.toContain(OWNER_USER_ID);
  });

  it('drains bounded tree pages, deletes the root, verifies absence, and completes', async () => {
    const harness = cleanupHarness({
      treePages: [[{ _id: 'tree-1' }, { _id: 'tree-2' }], []],
      deletedJobs: 1
    });

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      limit: 1,
      treeBatchSize: 2,
      maxTreeBatchesPerRequest: 3,
      ownerUserId: OWNER_USER_ID,
      now: NOW
    });

    expect(result).toEqual({
      requests: 1,
      completed: 1,
      pending: 0,
      failed: 0,
      deletedAuthoredObjects: 0,
      deletedAuthoredRegionRevisions: 0,
      deletedAuthoredResetOperations: 0,
      deletedTrees: 2,
      deletedReconciliationJobs: 1,
      deletedWorlds: 1
    });
    expect(harness.ForestWritingTreeModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ['tree-1', 'tree-2'] },
      ownerUserId: OWNER_USER_ID
    });
    expect(harness.ForestOwnerWorldModel.deleteMany)
      .toHaveBeenCalledOnceWith({ ownerUserId: OWNER_USER_ID });
    expect(harness.ForestOwnerGroupReconciliationJobModel.deleteMany)
      .toHaveBeenCalledOnceWith({ ownerUserId: OWNER_USER_ID });
    expect(harness.scheduleEvidenceExpiry).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      AccountDeletionRequestModel: harness.AccountDeletionRequestModel,
      now: NOW
    });
    expect(harness.AccountDeletionRequestModel.updateOne.calls.allArgs()).toContain([
      { _id: 'request-1', 'forestCleanup.status': 'pending' },
      {
        $set: {
          'forestCleanup.status': 'completed',
          'forestCleanup.completedAt': NOW
        }
      }
    ]);
  });

  it('completes idempotently when the account never had forest records', async () => {
    const harness = cleanupHarness({ treePages: [[]] });

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      ownerUserId: OWNER_USER_ID,
      now: NOW
    });

    expect(result.completed).toBe(1);
    expect(result.deletedTrees).toBe(0);
    expect(harness.ForestWritingTreeModel.deleteMany).not.toHaveBeenCalled();
    expect(harness.scheduleEvidenceExpiry).toHaveBeenCalled();
  });

  it('drains every authored family before writing trees and verifies complete absence', async () => {
    const harness = cleanupHarness({
      authoredObjectPages: [[{ _id: 'object-1' }, { _id: 'object-2' }], []],
      authoredRegionRevisionPages: [[{ _id: 'cell-1' }], []],
      authoredResetOperationPages: [[{ _id: 'reset-1' }], []],
      treePages: [[]]
    });

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      treeBatchSize: 2,
      maxTreeBatchesPerRequest: 3,
      ownerUserId: OWNER_USER_ID,
      now: NOW
    });

    expect(result).toEqual(jasmine.objectContaining({
      completed: 1,
      deletedAuthoredObjects: 2,
      deletedAuthoredRegionRevisions: 1,
      deletedAuthoredResetOperations: 1
    }));
    expect(harness.ForestAuthoredObjectModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ['object-1', 'object-2'] },
      ownerUserId: OWNER_USER_ID
    });
    expect(harness.ForestAuthoredRegionRevisionModel.exists)
      .toHaveBeenCalledOnceWith({ ownerUserId: OWNER_USER_ID });
    expect(harness.ForestAuthoredResetOperationModel.exists)
      .toHaveBeenCalledOnceWith({ ownerUserId: OWNER_USER_ID });
  });

  it('does not declare convergence while any authored family remains', async () => {
    for (const remaining of [
      { remainingAuthoredObject: { _id: 'object' } },
      { remainingAuthoredRegionRevision: { _id: 'cell' } },
      { remainingAuthoredResetOperation: { _id: 'reset' } }
    ]) {
      const harness = cleanupHarness(remaining);
      const result = await cleanUpAccountDeletionForests({
        ...harness,
        ownerUserId: OWNER_USER_ID,
        now: NOW
      });

      expect(result.pending).toBe(1);
      expect(result.completed).toBe(0);
      expect(harness.scheduleEvidenceExpiry).not.toHaveBeenCalled();
    }
  });

  it('stops after the bounded authored-object allowance without deleting dependent ledgers', async () => {
    const harness = cleanupHarness({
      authoredObjectPages: [[{ _id: 'object-1' }], [{ _id: 'object-2' }]],
      treePages: [[]]
    });

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      treeBatchSize: 1,
      maxTreeBatchesPerRequest: 2,
      now: NOW
    });

    expect(result.pending).toBe(1);
    expect(result.deletedAuthoredObjects).toBe(2);
    expect(harness.ForestAuthoredRegionRevisionModel.find).not.toHaveBeenCalled();
    expect(harness.ForestWritingTreeModel.find).not.toHaveBeenCalled();
    expect(harness.ForestOwnerWorldModel.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps cleanup pending when a bounded deletion does not remove every selected record', async () => {
    const harness = cleanupHarness({
      authoredObjectPages: [[{ _id: 'object-1' }]],
      treePages: [[]]
    });
    harness.ForestAuthoredObjectModel.deleteMany.and.resolveTo({ deletedCount: 0 });

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      ownerUserId: OWNER_USER_ID,
      now: NOW
    });

    expect(result.pending).toBe(1);
    expect(result.deletedAuthoredObjects).toBe(0);
    expect(harness.ForestWritingTreeModel.find).not.toHaveBeenCalled();
    expect(harness.ForestOwnerWorldModel.deleteMany).not.toHaveBeenCalled();
  });

  it('does not declare deletion convergence while an owner queue row remains', async () => {
    const harness = cleanupHarness({
      treePages: [[]],
      remainingJob: { _id: 'remaining-job' }
    });

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      ownerUserId: OWNER_USER_ID,
      now: NOW
    });

    expect(result.pending).toBe(1);
    expect(result.completed).toBe(0);
    expect(harness.scheduleEvidenceExpiry).not.toHaveBeenCalled();
  });

  it('keeps completed cleanup successful when immediate expiry scheduling fails', async () => {
    const harness = cleanupHarness({ treePages: [[]] });
    const expiryError = new Error('temporarily unavailable');
    expiryError.name = 'MongoNetworkError';
    harness.scheduleEvidenceExpiry.and.rejectWith(expiryError);

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      now: NOW
    });

    expect(result.completed).toBe(1);
    expect(result.failed).toBe(0);
    expect(harness.logger.error).toHaveBeenCalledOnceWith(
      'Failed account-deletion evidence expiry scheduling:',
      { error: 'MongoNetworkError' }
    );
  });

  it('stays pending after its bounded tree-batch allowance', async () => {
    const harness = cleanupHarness({
      treePages: [[{ _id: 'tree-1' }], [{ _id: 'tree-2' }]]
    });

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      treeBatchSize: 1,
      maxTreeBatchesPerRequest: 2,
      now: NOW
    });

    expect(result.pending).toBe(1);
    expect(result.deletedTrees).toBe(2);
    expect(harness.ForestOwnerWorldModel.deleteMany).not.toHaveBeenCalled();
    expect(harness.scheduleEvidenceExpiry).not.toHaveBeenCalled();
  });

  it('keeps failures retryable and emits no owner identity in diagnostics', async () => {
    const harness = cleanupHarness();
    const cleanupError = new Error('database unavailable');
    cleanupError.name = 'MongoNetworkError';
    harness.ForestWritingTreeModel.find.and.throwError(cleanupError);

    const result = await cleanUpAccountDeletionForests({
      ...harness,
      now: NOW
    });

    expect(result.failed).toBe(1);
    expect(result.completed).toBe(0);
    expect(harness.logger.error).toHaveBeenCalledOnceWith(
      'Failed account-deletion forest cleanup:',
      { error: 'MongoNetworkError' }
    );
    expect(JSON.stringify(harness.logger.error.calls.mostRecent().args))
      .not.toContain(OWNER_USER_ID);
  });

  it('rejects unbounded worker inputs before querying deletion evidence', async () => {
    const AccountDeletionRequestModel = {
      find: jasmine.createSpy('find')
    };

    await expectAsync(cleanUpAccountDeletionForests({
      limit: 0,
      AccountDeletionRequestModel
    })).toBeRejectedWithError(/limit/);
    await expectAsync(cleanUpAccountDeletionForests({
      treeBatchSize: 1_001,
      AccountDeletionRequestModel
    })).toBeRejectedWithError(/treeBatchSize/);
    expect(AccountDeletionRequestModel.find).not.toHaveBeenCalled();
  });

  it('lets media completion trigger the same convergence scheduler', async () => {
    const request = {
      ownerUserId: OWNER_USER_ID,
      profileMedia: {
        url: 'https://external.example/avatar.png',
        status: 'pending',
        attempts: 0,
        lastAttemptAt: null
      },
      save: jasmine.createSpy('save').and.resolveTo()
    };
    const AccountDeletionRequestModel = {
      find: jasmine.createSpy('find').and.returnValue(requestQuery([request]))
    };
    const scheduleEvidenceExpiry = jasmine.createSpy('scheduleEvidenceExpiry').and.resolveTo({});

    const result = await cleanUpAccountDeletionMedia({
      limit: 1,
      ownerUserId: OWNER_USER_ID,
      AccountDeletionRequestModel,
      scheduleEvidenceExpiry,
      s3: { send: jasmine.createSpy('send') },
      now: NOW
    });

    expect(result).toEqual({ deleted: 0, notManaged: 1, failed: 0 });
    expect(request.profileMedia.status).toBe('not-managed');
    expect(scheduleEvidenceExpiry).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      AccountDeletionRequestModel,
      now: NOW
    });
  });

  it('keeps terminal media cleanup successful when expiry scheduling needs retry', async () => {
    const request = {
      ownerUserId: OWNER_USER_ID,
      profileMedia: {
        url: 'https://external.example/avatar.png',
        status: 'pending',
        attempts: 0,
        lastAttemptAt: null
      },
      save: jasmine.createSpy('save').and.resolveTo()
    };
    const AccountDeletionRequestModel = {
      find: jasmine.createSpy('find').and.returnValue(requestQuery([request]))
    };
    const expiryError = new Error('temporarily unavailable');
    expiryError.name = 'MongoNetworkError';
    const logger = { error: jasmine.createSpy('error') };

    const result = await cleanUpAccountDeletionMedia({
      limit: 1,
      AccountDeletionRequestModel,
      scheduleEvidenceExpiry: jasmine.createSpy('scheduleEvidenceExpiry')
        .and.rejectWith(expiryError),
      s3: { send: jasmine.createSpy('send') },
      logger,
      now: NOW
    });

    expect(result).toEqual({ deleted: 0, notManaged: 1, failed: 0 });
    expect(logger.error).toHaveBeenCalledOnceWith(
      'Failed account-deletion evidence expiry scheduling:',
      { error: 'MongoNetworkError' }
    );
  });
});

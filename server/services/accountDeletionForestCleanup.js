import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../db/models/ForestAuthoredRegionRevision.js';
import ForestAuthoredResetOperation from '../db/models/ForestAuthoredResetOperation.js';
import ForestOwnerGroupReconciliationJob from '../db/models/ForestOwnerGroupReconciliationJob.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  scheduleAccountDeletionEvidenceExpiry
} from './accountDeletionEvidence.js';

const MAX_REQUEST_LIMIT = 100;
const MAX_RECORD_BATCH_SIZE = 1_000;
const MAX_RECORD_BATCHES_PER_REQUEST = 100;

function boundedInteger(value, label, maximum) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer from 1 through ${maximum}.`);
  }
  return value;
}

async function nextRecordIds(Model, ownerUserId, batchSize) {
  const records = await Model.find(
    { ownerUserId },
    { _id: 1 }
  ).sort({ _id: 1 }).limit(batchSize).lean();
  if (!Array.isArray(records) || records.length > batchSize) {
    throw new Error('Forest cleanup model returned an unbounded record page.');
  }
  return records;
}

async function drainOwnerRecords({ Model, ownerUserId, batchSize, batchLimit }) {
  let deletedCount = 0;
  for (let batch = 0; batch < batchLimit; batch += 1) {
    const records = await nextRecordIds(Model, ownerUserId, batchSize);
    if (!records.length) return { complete: true, deletedCount };

    const deleted = await Model.deleteMany({
      _id: { $in: records.map(record => record._id) },
      ownerUserId
    });
    const removed = Number(deleted?.deletedCount || 0);
    deletedCount += removed;
    if (removed !== records.length) return { complete: false, deletedCount };
    if (records.length < batchSize) return { complete: true, deletedCount };
  }
  return { complete: false, deletedCount };
}

export async function cleanUpAccountDeletionForests({
  limit = 25,
  treeBatchSize = 100,
  maxTreeBatchesPerRequest = 10,
  ownerUserId = null,
  AccountDeletionRequestModel = AccountDeletionRequest,
  ForestAuthoredObjectModel = ForestAuthoredObject,
  ForestAuthoredRegionRevisionModel = ForestAuthoredRegionRevision,
  ForestAuthoredResetOperationModel = ForestAuthoredResetOperation,
  ForestOwnerGroupReconciliationJobModel = ForestOwnerGroupReconciliationJob,
  ForestOwnerWorldModel = ForestOwnerWorld,
  ForestWritingTreeModel = ForestWritingTree,
  scheduleEvidenceExpiry = scheduleAccountDeletionEvidenceExpiry,
  logger = console,
  now = new Date()
} = {}) {
  const requestLimit = boundedInteger(limit, 'limit', MAX_REQUEST_LIMIT);
  const batchSize = boundedInteger(
    treeBatchSize,
    'treeBatchSize',
    MAX_RECORD_BATCH_SIZE
  );
  const batchLimit = boundedInteger(
    maxTreeBatchesPerRequest,
    'maxTreeBatchesPerRequest',
    MAX_RECORD_BATCHES_PER_REQUEST
  );
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('now must be a valid Date.');
  }

  const requests = await AccountDeletionRequestModel.find({
    status: 'completed',
    'forestCleanup.status': 'pending',
    ...(ownerUserId ? { ownerUserId: String(ownerUserId) } : {})
  }).sort({ completedAt: 1 }).limit(requestLimit);
  const totals = {
    requests: requests.length,
    completed: 0,
    pending: 0,
    failed: 0,
    deletedAuthoredObjects: 0,
    deletedAuthoredRegionRevisions: 0,
    deletedAuthoredResetOperations: 0,
    deletedTrees: 0,
    deletedReconciliationJobs: 0,
    deletedWorlds: 0
  };

  for (const request of requests) {
    const owner = String(request.ownerUserId);
    try {
      await AccountDeletionRequestModel.updateOne(
        { _id: request._id, 'forestCleanup.status': 'pending' },
        {
          $inc: { 'forestCleanup.attempts': 1 },
          $set: { 'forestCleanup.lastAttemptAt': now }
        }
      );

      const boundedCollections = [
        [ForestAuthoredObjectModel, 'deletedAuthoredObjects'],
        [ForestAuthoredRegionRevisionModel, 'deletedAuthoredRegionRevisions'],
        [ForestAuthoredResetOperationModel, 'deletedAuthoredResetOperations'],
        [ForestWritingTreeModel, 'deletedTrees']
      ];
      let boundedCleanupComplete = true;
      for (const [Model, totalField] of boundedCollections) {
        const drained = await drainOwnerRecords({
          Model,
          ownerUserId: owner,
          batchSize,
          batchLimit
        });
        totals[totalField] += drained.deletedCount;
        if (!drained.complete) {
          boundedCleanupComplete = false;
          break;
        }
      }
      if (!boundedCleanupComplete) {
        totals.pending += 1;
        continue;
      }

      const deletedJobs = await ForestOwnerGroupReconciliationJobModel.deleteMany({
        ownerUserId: owner
      });
      totals.deletedReconciliationJobs += Number(deletedJobs?.deletedCount || 0);

      const deletedWorlds = await ForestOwnerWorldModel.deleteMany({
        ownerUserId: owner
      });
      totals.deletedWorlds += Number(deletedWorlds?.deletedCount || 0);

      const [
        remainingAuthoredObject,
        remainingAuthoredRegionRevision,
        remainingAuthoredResetOperation,
        remainingTree,
        remainingJob,
        remainingWorld
      ] = await Promise.all([
        ForestAuthoredObjectModel.exists({ ownerUserId: owner }),
        ForestAuthoredRegionRevisionModel.exists({ ownerUserId: owner }),
        ForestAuthoredResetOperationModel.exists({ ownerUserId: owner }),
        ForestWritingTreeModel.exists({ ownerUserId: owner }),
        ForestOwnerGroupReconciliationJobModel.exists({ ownerUserId: owner }),
        ForestOwnerWorldModel.exists({ ownerUserId: owner })
      ]);
      if (remainingAuthoredObject
        || remainingAuthoredRegionRevision
        || remainingAuthoredResetOperation
        || remainingTree
        || remainingJob
        || remainingWorld) {
        totals.pending += 1;
        continue;
      }

      const completed = await AccountDeletionRequestModel.updateOne(
        { _id: request._id, 'forestCleanup.status': 'pending' },
        {
          $set: {
            'forestCleanup.status': 'completed',
            'forestCleanup.completedAt': now
          }
        }
      );
      if (Number(completed?.modifiedCount || 0) !== 1) {
        totals.pending += 1;
        continue;
      }

      totals.completed += 1;
      try {
        await scheduleEvidenceExpiry({
          ownerUserId: owner,
          AccountDeletionRequestModel,
          now
        });
      } catch (error) {
        logger.error('Failed account-deletion evidence expiry scheduling:', {
          error: error?.name || 'Error'
        });
      }
    } catch (error) {
      totals.failed += 1;
      logger.error('Failed account-deletion forest cleanup:', {
        error: error?.name || 'Error'
      });
    }
  }

  return totals;
}

import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  scheduleAccountDeletionEvidenceExpiry
} from './accountDeletionEvidence.js';

const MAX_REQUEST_LIMIT = 100;
const MAX_TREE_BATCH_SIZE = 1_000;
const MAX_TREE_BATCHES_PER_REQUEST = 100;

function boundedInteger(value, label, maximum) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer from 1 through ${maximum}.`);
  }
  return value;
}

async function nextTreeIds(ForestWritingTreeModel, ownerUserId, treeBatchSize) {
  return ForestWritingTreeModel.find(
    { ownerUserId },
    { _id: 1 }
  ).sort({ _id: 1 }).limit(treeBatchSize).lean();
}

export async function cleanUpAccountDeletionForests({
  limit = 25,
  treeBatchSize = 100,
  maxTreeBatchesPerRequest = 10,
  ownerUserId = null,
  AccountDeletionRequestModel = AccountDeletionRequest,
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
    MAX_TREE_BATCH_SIZE
  );
  const batchLimit = boundedInteger(
    maxTreeBatchesPerRequest,
    'maxTreeBatchesPerRequest',
    MAX_TREE_BATCHES_PER_REQUEST
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
    deletedTrees: 0,
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

      let exhaustedBatchLimit = true;
      for (let batch = 0; batch < batchLimit; batch += 1) {
        const treeIds = await nextTreeIds(
          ForestWritingTreeModel,
          owner,
          batchSize
        );
        if (!treeIds.length) {
          exhaustedBatchLimit = false;
          break;
        }

        const deleted = await ForestWritingTreeModel.deleteMany({
          _id: { $in: treeIds.map(tree => tree._id) },
          ownerUserId: owner
        });
        totals.deletedTrees += Number(deleted?.deletedCount || 0);
      }

      if (exhaustedBatchLimit) {
        totals.pending += 1;
        continue;
      }

      const deletedWorlds = await ForestOwnerWorldModel.deleteMany({
        ownerUserId: owner
      });
      totals.deletedWorlds += Number(deletedWorlds?.deletedCount || 0);

      const [remainingTree, remainingWorld] = await Promise.all([
        ForestWritingTreeModel.exists({ ownerUserId: owner }),
        ForestOwnerWorldModel.exists({ ownerUserId: owner })
      ]);
      if (remainingTree || remainingWorld) {
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

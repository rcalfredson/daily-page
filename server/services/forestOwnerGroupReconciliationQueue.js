import crypto from 'node:crypto';
import mongoose from 'mongoose';

import ForestOwnerGroupReconciliationJob from '../db/models/ForestOwnerGroupReconciliationJob.js';
import User from '../db/models/User.js';
import {
  FOREST_OWNER_GROUP_RECONCILIATION_JOB_SCHEMA_VERSION,
} from '../db/schemas/ForestOwnerGroupReconciliationJobSchema.js';
import {
  reconcileForestOwnerGroup,
} from './forestOwnerGroupReconciliation.js';
import {
  acquireForestLedgerFence,
} from './forestLedgerFence.js';

export const FOREST_OWNER_GROUP_RECONCILIATION_QUEUE_VERSION = 1;
export const FOREST_OWNER_GROUP_RECONCILIATION_DEFAULT_BATCH_SIZE = 25;
export const FOREST_OWNER_GROUP_RECONCILIATION_MAX_BATCH_SIZE = 100;
export const FOREST_OWNER_GROUP_RECONCILIATION_DEFAULT_LEASE_MS = 120_000;
export const FOREST_OWNER_GROUP_RECONCILIATION_DEFAULT_MAX_ATTEMPTS = 8;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,79}$/;
const MINIMUM_LEASE_MS = 10_000;
const MAXIMUM_LEASE_MS = 600_000;
const MAXIMUM_ATTEMPTS = 20;
const INITIAL_RETRY_DELAY_MS = 15_000;
const MAXIMUM_RETRY_DELAY_MS = 3_600_000;

function canonicalObjectId(value, fieldName) {
  const normalized = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} must be a canonical ObjectId string.`);
  }
  return normalized;
}

function validDate(value, fieldName) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${fieldName} must be a valid Date.`);
  }
  return value;
}

function boundedInteger(value, fieldName, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${fieldName} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function duplicateKey(error) {
  return Number(error?.code) === 11_000;
}

function leaseToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function retryDelay(attempts) {
  return Math.min(
    INITIAL_RETRY_DELAY_MS * (2 ** Math.max(0, attempts - 1)),
    MAXIMUM_RETRY_DELAY_MS,
  );
}

function errorCode(error) {
  if (typeof error?.code === 'string' && ERROR_CODE_PATTERN.test(error.code)) {
    return error.code;
  }
  const normalized = String(error?.name || 'Error')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 80);
  return ERROR_CODE_PATTERN.test(normalized) ? normalized : 'ERROR';
}

function terminalOwnerError(error) {
  return error?.code === 'FOREST_OWNER_UNAVAILABLE';
}

function enqueueUpdate(now) {
  return {
    $setOnInsert: {
      schemaVersion: FOREST_OWNER_GROUP_RECONCILIATION_JOB_SCHEMA_VERSION,
    },
    $set: {
      status: 'pending',
      attempts: 0,
      availableAt: now,
      lastErrorCode: null,
    },
    $inc: { requestedRevision: 1 },
  };
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export function buildForestOwnerGroupReconciliationEnqueuer({
  JobModel = ForestOwnerGroupReconciliationJob,
  UserModel = User,
  transactionRunner = runInTransaction,
  acquireFence = acquireForestLedgerFence,
} = {}) {
  if (!JobModel?.findOneAndUpdate) {
    throw new Error('JobModel.findOneAndUpdate must be available.');
  }
  if (typeof transactionRunner !== 'function' || typeof acquireFence !== 'function') {
    throw new Error('transactionRunner and acquireFence must be functions.');
  }
  return async function enqueueForestOwnerGroupReconciliation({
    ownerUserId,
    translationGroupId,
    now = new Date(),
  }) {
    const owner = canonicalObjectId(ownerUserId, 'ownerUserId');
    const group = canonicalObjectId(translationGroupId, 'translationGroupId');
    const requestedAt = validDate(now, 'now');
    const identity = { ownerUserId: owner, translationGroupId: group };
    async function write(upsert) {
      return transactionRunner(async (session) => {
        await acquireFence({ ownerUserId: owner, session, UserModel });
        return JobModel.findOneAndUpdate(
          identity,
          enqueueUpdate(requestedAt),
          {
            upsert,
            returnDocument: 'after',
            setDefaultsOnInsert: true,
            session,
          },
        ).lean();
      });
    }
    let job;
    try {
      job = await write(true);
    } catch (error) {
      if (!duplicateKey(error)) throw error;
      job = await write(false);
    }
    if (!job) throw new Error('Reconciliation queue did not return its durable job.');
    return Object.freeze({
      queueVersion: FOREST_OWNER_GROUP_RECONCILIATION_QUEUE_VERSION,
      enqueued: true,
      requestedRevision: job.requestedRevision,
    });
  };
}

export const enqueueForestOwnerGroupReconciliation =
  buildForestOwnerGroupReconciliationEnqueuer();

export async function enqueueForestOwnerGroupReconciliationForBlock({
  block,
  enqueue = enqueueForestOwnerGroupReconciliation,
  logger = console,
  now = new Date(),
} = {}) {
  const ownerUserId = String(block?.userId || '').toLowerCase();
  const translationGroupId = String(block?.groupId || '').toLowerCase();
  const authorshipState = block?.authorshipState === undefined
    ? 'live'
    : block.authorshipState;
  if (!OBJECT_ID_PATTERN.test(ownerUserId)
    || !OBJECT_ID_PATTERN.test(translationGroupId)
    || authorshipState !== 'live') {
    return Object.freeze({ scheduled: false, reason: 'ineligible-block-identity' });
  }
  try {
    const queued = await enqueue({ ownerUserId, translationGroupId, now });
    return Object.freeze({ scheduled: true, requestedRevision: queued.requestedRevision });
  } catch (error) {
    logger.error('Failed to enqueue forest owner-group reconciliation:', {
      error: error?.name || 'Error',
    });
    return Object.freeze({ scheduled: false, reason: 'enqueue-failed' });
  }
}

export function buildForestOwnerGroupReconciliationWorker({
  JobModel = ForestOwnerGroupReconciliationJob,
  reconcile = reconcileForestOwnerGroup,
  generateLeaseToken = leaseToken,
  clock = () => new Date(),
} = {}) {
  for (const method of ['findOneAndUpdate', 'deleteOne', 'updateOne']) {
    if (typeof JobModel?.[method] !== 'function') {
      throw new Error(`JobModel.${method} must be available.`);
    }
  }
  if (typeof reconcile !== 'function'
    || typeof generateLeaseToken !== 'function'
    || typeof clock !== 'function') {
    throw new Error('reconcile, generateLeaseToken, and clock must be functions.');
  }

  return async function processForestOwnerGroupReconciliationJobs({
    limit = FOREST_OWNER_GROUP_RECONCILIATION_DEFAULT_BATCH_SIZE,
    leaseMs = FOREST_OWNER_GROUP_RECONCILIATION_DEFAULT_LEASE_MS,
    maxAttempts = FOREST_OWNER_GROUP_RECONCILIATION_DEFAULT_MAX_ATTEMPTS,
    now = null,
  } = {}) {
    const batchSize = boundedInteger(
      limit,
      'limit',
      1,
      FOREST_OWNER_GROUP_RECONCILIATION_MAX_BATCH_SIZE,
    );
    const leaseDuration = boundedInteger(
      leaseMs,
      'leaseMs',
      MINIMUM_LEASE_MS,
      MAXIMUM_LEASE_MS,
    );
    const attemptLimit = boundedInteger(
      maxAttempts,
      'maxAttempts',
      1,
      MAXIMUM_ATTEMPTS,
    );
    const fixedTime = now === null ? null : validDate(now, 'now');
    const totals = {
      claimed: 0,
      completed: 0,
      superseded: 0,
      retried: 0,
      failed: 0,
      dropped: 0,
    };

    for (let index = 0; index < batchSize; index += 1) {
      const attemptedAt = fixedTime || validDate(clock(), 'clock()');
      const token = generateLeaseToken();
      const leaseExpiresAt = new Date(attemptedAt.getTime() + leaseDuration);
      const job = await JobModel.findOneAndUpdate(
        {
          status: 'pending',
          availableAt: { $lte: attemptedAt },
          $or: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { $lte: attemptedAt } },
          ],
        },
        {
          $set: {
            leaseToken: token,
            leaseExpiresAt,
            lastAttemptAt: attemptedAt,
          },
          $inc: { attempts: 1 },
        },
        {
          sort: { availableAt: 1, _id: 1 },
          returnDocument: 'after',
        },
      ).lean();
      if (!job) break;
      totals.claimed += 1;

      try {
        await reconcile({
          ownerUserId: job.ownerUserId,
          translationGroupId: job.translationGroupId,
          now: attemptedAt,
        });
        const removed = await JobModel.deleteOne({
          _id: job._id,
          leaseToken: token,
          requestedRevision: job.requestedRevision,
        });
        if (Number(removed?.deletedCount || 0) === 1) {
          totals.completed += 1;
        } else {
          await JobModel.updateOne(
            { _id: job._id, leaseToken: token },
            {
              $set: {
                status: 'pending',
                availableAt: attemptedAt,
                leaseToken: null,
                leaseExpiresAt: null,
                lastErrorCode: null,
              },
            },
          );
          totals.superseded += 1;
        }
      } catch (error) {
        if (terminalOwnerError(error)) {
          await JobModel.deleteOne({ _id: job._id, leaseToken: token });
          totals.dropped += 1;
          continue;
        }
        const code = errorCode(error);
        const attempts = Number(job.attempts || 0);
        const terminalFailure = attempts >= attemptLimit;
        const failedWrite = await JobModel.updateOne(
          {
            _id: job._id,
            leaseToken: token,
            requestedRevision: job.requestedRevision,
          },
          {
            $set: {
              status: terminalFailure ? 'failed' : 'pending',
              availableAt: terminalFailure
                ? attemptedAt
                : new Date(attemptedAt.getTime() + retryDelay(attempts)),
              leaseToken: null,
              leaseExpiresAt: null,
              lastErrorCode: code,
            },
          },
        );
        if (Number(failedWrite?.modifiedCount || 0) === 1) {
          totals[terminalFailure ? 'failed' : 'retried'] += 1;
        } else {
          await JobModel.updateOne(
            { _id: job._id, leaseToken: token },
            {
              $set: {
                status: 'pending',
                availableAt: attemptedAt,
                leaseToken: null,
                leaseExpiresAt: null,
              },
            },
          );
          totals.superseded += 1;
        }
      }
    }
    return Object.freeze(totals);
  };
}

export const processForestOwnerGroupReconciliationJobs =
  buildForestOwnerGroupReconciliationWorker();

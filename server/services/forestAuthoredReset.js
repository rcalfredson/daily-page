import mongoose from 'mongoose';

import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../db/models/ForestAuthoredRegionRevision.js';
import ForestAuthoredResetOperation from '../db/models/ForestAuthoredResetOperation.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import User from '../db/models/User.js';
import {
  FOREST_AUTHORED_COORDINATE_LIMIT,
  FOREST_AUTHORED_MARKER_APPEARANCE_ID,
  FOREST_AUTHORED_MARKER_APPEARANCE_VERSION,
  FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION,
  FOREST_AUTHORED_OBJECT_IDENTITY_VERSION,
  FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
} from '../db/schemas/ForestAuthoredObjectSchema.js';
import {
  FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION
} from '../db/schemas/ForestAuthoredRegionRevisionSchema.js';
import {
  FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION,
  FOREST_AUTHORED_RESET_OPERATION_VERSION
} from '../db/schemas/ForestAuthoredResetOperationSchema.js';
import { FOREST_OWNER_WORLD_SCHEMA_VERSION } from '../db/schemas/ForestOwnerWorldSchema.js';
import { acquireForestLedgerFence } from './forestLedgerFence.js';
import { FOREST_AUTHORED_TOMBSTONE_RETENTION_MS } from './forestAuthoredRetentionPolicy.js';
import {
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION
} from './forestOwnerEnvironmentResolver.js';
import { FOREST_OWNER_GROVE_PLACEMENT_VERSION } from './forestOwnerGrovePlacement.js';
import {
  deriveForestOwnerPlacementIndex,
  FOREST_OWNER_PLACEMENT_INDEX_VERSION
} from './forestOwnerPlacementNeighborhood.js';

export const FOREST_AUTHORED_RESET_DEFAULT_BATCH_SIZE = 100;
export const FOREST_AUTHORED_RESET_MAX_BATCH_SIZE = 250;
export const FOREST_AUTHORED_RESET_WORKER_DEFAULT_LIMIT = 5;
export const FOREST_AUTHORED_RESET_WORKER_MAX_LIMIT = 25;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class ForestAuthoredResetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestAuthoredResetError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestAuthoredResetError(code, message);
}

function canonicalOwner(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail('INVALID_AUTHORED_RESET_INPUT', 'ownerUserId must be a canonical ObjectId string.');
  }
  return ownerUserId;
}

function canonicalResetId(value) {
  const resetId = String(value || '').toLowerCase();
  if (!UUID_V4_PATTERN.test(resetId)) {
    fail('INVALID_AUTHORED_RESET_INPUT', 'resetId must be a canonical UUIDv4.');
  }
  return resetId;
}

function boundedInteger(value, fallback, maximum, fieldName) {
  const resolved = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) {
    fail('INVALID_AUTHORED_RESET_INPUT', `${fieldName} is outside the supported bound.`);
  }
  return resolved;
}

function timestamp(clock) {
  const value = clock();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('INVALID_AUTHORED_RESET_DEPENDENCY', 'clock must return a valid Date.');
  }
  return new Date(value.getTime());
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

function validateWorld(world, ownerUserId) {
  if (!world
    || world.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || world.ownerUserId !== ownerUserId
    || world.worldRole !== 'primary'
    || !UUID_V4_PATTERN.test(world.forestId || '')
    || world.status !== 'active'
    || world.reconciliation?.state !== 'idle'
    || world.placementPolicyVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || world.environmentPolicyVersion !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || world.environmentSchemaVersion !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || world.worldGenerationVersion !== FOREST_OWNER_WORLD_GENERATION_VERSION) {
    fail('AUTHORED_RESET_UNAVAILABLE', 'The owner forest is unavailable for reset.');
  }
  return world;
}

function validateOperation(operation, { ownerUserId, forestId, resetId }) {
  const processing = operation?.status === 'processing' && operation.completedAt === null;
  const completed = operation?.status === 'completed'
    && operation.completedAt instanceof Date
    && !Number.isNaN(operation.completedAt.getTime());
  if (!operation
    || operation.schemaVersion !== FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION
    || operation.operationVersion !== FOREST_AUTHORED_RESET_OPERATION_VERSION
    || operation.ownerUserId !== ownerUserId
    || operation.forestId !== forestId
    || operation.resetId !== resetId
    || operation.authoredObjectSchemaVersion !== FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    || operation.spatialIndexVersion !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
    || ![null, undefined].includes(operation.afterObjectId)
      && !UUID_V4_PATTERN.test(operation.afterObjectId)
    || !Number.isSafeInteger(operation.affectedObjectCount)
    || operation.affectedObjectCount < 0
    || !(operation.startedAt instanceof Date)
    || Number.isNaN(operation.startedAt.getTime())
    || (!processing && !completed)) {
    fail('AUTHORED_RESET_MIGRATION_REQUIRED', 'The authored reset uses unsupported evidence.');
  }
  return operation;
}

function validateObject(object, { ownerUserId, forestId }) {
  let expectedIndex;
  try {
    expectedIndex = deriveForestOwnerPlacementIndex({
      worldX: object?.placement?.worldX,
      worldY: object?.placement?.worldY
    });
  } catch {
    fail('AUTHORED_RESET_MIGRATION_REQUIRED', 'An authored object cannot be reset safely.');
  }
  if (object?.schemaVersion !== FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    || object?.identityVersion !== FOREST_AUTHORED_OBJECT_IDENTITY_VERSION
    || !object?._id
    || object?.ownerUserId !== ownerUserId
    || object?.forestId !== forestId
    || !UUID_V4_PATTERN.test(object?.objectId || '')
    || object?.kind !== 'personal-marker'
    || object?.state !== 'active'
    || !Number.isSafeInteger(object?.placement?.worldX)
    || !Number.isSafeInteger(object?.placement?.worldY)
    || Math.abs(object.placement.worldX) > FOREST_AUTHORED_COORDINATE_LIMIT
    || Math.abs(object.placement.worldY) > FOREST_AUTHORED_COORDINATE_LIMIT
    || object?.placementIndex?.version !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
    || object?.placementIndex?.cellX !== expectedIndex.cellX
    || object?.placementIndex?.cellY !== expectedIndex.cellY
    || object?.worldVersionEvidence?.ownerWorldSchemaVersion
      !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || object?.worldVersionEvidence?.placementPolicyVersion
      !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || object?.worldVersionEvidence?.environmentPolicyVersion
      !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || object?.worldVersionEvidence?.environmentSchemaVersion
      !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || object?.worldVersionEvidence?.worldGenerationVersion
      !== FOREST_OWNER_WORLD_GENERATION_VERSION
    || object?.appearance?.id !== FOREST_AUTHORED_MARKER_APPEARANCE_ID
    || object?.appearance?.version !== FOREST_AUTHORED_MARKER_APPEARANCE_VERSION
    || object?.creationFingerprint?.version !== FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION
    || !SHA256_BASE64URL_PATTERN.test(object?.creationFingerprint?.digest || '')
    || !Number.isSafeInteger(object?.recordRevision)
    || object.recordRevision < 1
    || object.recordRevision >= Number.MAX_SAFE_INTEGER
    || !(object?.createdAt instanceof Date)
    || Number.isNaN(object.createdAt.getTime())
    || !(object?.changedAt instanceof Date)
    || Number.isNaN(object.changedAt.getTime())
    || object?.removedAt !== null
    || object?.purgeEligibleAt !== null) {
    fail('AUTHORED_RESET_MIGRATION_REQUIRED', 'An authored object cannot be reset safely.');
  }
  return object;
}

function safeOperation(operation, outcome) {
  return Object.freeze({
    operationVersion: FOREST_AUTHORED_RESET_OPERATION_VERSION,
    outcome,
    resetId: operation.resetId,
    status: operation.status,
    affectedObjectCount: operation.affectedObjectCount,
    startedAt: new Date(operation.startedAt),
    completedAt: operation.completedAt ? new Date(operation.completedAt) : null
  });
}

async function authority(db, ownerUserId, session, acquireFence) {
  await acquireFence({ ownerUserId, session, UserModel: db.User });
  const deletion = await db.AccountDeletionRequest.exists({
    ownerUserId,
    status: { $in: ['processing', 'completed'] }
  }).session(session).lean();
  if (deletion) fail('AUTHORED_RESET_UNAVAILABLE', 'The owner forest is unavailable for reset.');
  return validateWorld(await db.ForestOwnerWorld.findOne({
    ownerUserId,
    worldRole: 'primary'
  }).session(session).lean(), ownerUserId);
}

async function advanceCellRevision(db, {
  ownerUserId, forestId, placementIndex, count, session
}) {
  let cell;
  try {
    cell = await db.ForestAuthoredRegionRevision.findOneAndUpdate({
      schemaVersion: FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION,
      ownerUserId,
      forestId,
      spatialIndexVersion: placementIndex.version,
      cellX: placementIndex.cellX,
      cellY: placementIndex.cellY,
      revision: { $lte: Number.MAX_SAFE_INTEGER - count }
    }, {
      $setOnInsert: {
        schemaVersion: FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION,
        ownerUserId,
        forestId,
        spatialIndexVersion: placementIndex.version,
        cellX: placementIndex.cellX,
        cellY: placementIndex.cellY
      },
      $inc: { revision: count }
    }, {
      session,
      upsert: true,
      returnDocument: 'after',
      lean: true,
      runValidators: true,
      setDefaultsOnInsert: false
    });
  } catch (error) {
    if (Number(error?.code) !== 11_000) throw error;
    fail('AUTHORED_RESET_UNAVAILABLE', 'An authored region revision cannot advance.');
  }
  if (!cell
    || cell.schemaVersion !== FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION
    || cell.ownerUserId !== ownerUserId
    || cell.forestId !== forestId
    || cell.spatialIndexVersion !== placementIndex.version
    || cell.cellX !== placementIndex.cellX
    || cell.cellY !== placementIndex.cellY
    || !Number.isSafeInteger(cell.revision)
    || cell.revision < count) {
    fail('AUTHORED_RESET_UNAVAILABLE', 'An authored region revision cannot advance.');
  }
}

export function buildForestAuthoredResetService({
  models = {},
  transactionRunner = runInTransaction,
  acquireFence = acquireForestLedgerFence,
  clock = () => new Date()
} = {}) {
  const db = {
    AccountDeletionRequest,
    ForestAuthoredObject,
    ForestAuthoredRegionRevision,
    ForestAuthoredResetOperation,
    ForestOwnerWorld,
    User,
    ...models
  };

  async function request({ ownerUserId: ownerValue, resetId: resetValue }) {
    const ownerUserId = canonicalOwner(ownerValue);
    const resetId = canonicalResetId(resetValue);
    const startedAt = timestamp(clock);
    return transactionRunner(async (session) => {
      const world = await authority(db, ownerUserId, session, acquireFence);
      const existing = await db.ForestAuthoredResetOperation.findOne({
        ownerUserId,
        forestId: world.forestId,
        resetId
      }).session(session).lean();
      if (existing) {
        const operation = validateOperation(existing, {
          ownerUserId, forestId: world.forestId, resetId
        });
        return safeOperation(operation, operation.status === 'completed'
          ? 'already-completed' : 'existing');
      }
      const processing = await db.ForestAuthoredResetOperation.findOne({
        ownerUserId,
        forestId: world.forestId,
        status: 'processing'
      }).session(session).lean();
      if (processing) {
        fail('AUTHORED_RESET_IN_PROGRESS', 'Another authored reset is already processing.');
      }
      const [created] = await db.ForestAuthoredResetOperation.create([{
        resetId,
        forestId: world.forestId,
        ownerUserId,
        status: 'processing',
        afterObjectId: null,
        affectedObjectCount: 0,
        authoredObjectSchemaVersion: FOREST_AUTHORED_OBJECT_SCHEMA_VERSION,
        spatialIndexVersion: FOREST_OWNER_PLACEMENT_INDEX_VERSION,
        startedAt,
        completedAt: null
      }], { session });
      const operation = validateOperation(created?.toObject ? created.toObject() : created, {
        ownerUserId, forestId: world.forestId, resetId
      });
      return safeOperation(operation, 'started');
    });
  }

  async function processBatch({
    ownerUserId: ownerValue,
    resetId: resetValue,
    batchSize: batchValue
  }) {
    const ownerUserId = canonicalOwner(ownerValue);
    const resetId = canonicalResetId(resetValue);
    const batchSize = boundedInteger(
      batchValue,
      FOREST_AUTHORED_RESET_DEFAULT_BATCH_SIZE,
      FOREST_AUTHORED_RESET_MAX_BATCH_SIZE,
      'batchSize'
    );
    const removedAt = timestamp(clock);
    const purgeEligibleAt = new Date(removedAt.getTime() + FOREST_AUTHORED_TOMBSTONE_RETENTION_MS);
    return transactionRunner(async (session) => {
      const world = await authority(db, ownerUserId, session, acquireFence);
      const operation = validateOperation(await db.ForestAuthoredResetOperation.findOne({
        ownerUserId,
        forestId: world.forestId,
        resetId
      }).session(session).lean(), { ownerUserId, forestId: world.forestId, resetId });
      if (operation.status === 'completed') return safeOperation(operation, 'already-completed');

      const objectQuery = {
        ownerUserId,
        forestId: world.forestId,
        state: 'active',
        ...(operation.afterObjectId ? { objectId: { $gt: operation.afterObjectId } } : {})
      };
      const rows = await db.ForestAuthoredObject.find(objectQuery)
        .session(session).sort({ objectId: 1 }).limit(batchSize + 1).lean();
      if (!Array.isArray(rows) || rows.length > batchSize + 1) {
        fail('AUTHORED_RESET_UNAVAILABLE', 'The authored reset batch was not bounded.');
      }
      const batch = rows.slice(0, batchSize).map(object => validateObject(object, {
        ownerUserId, forestId: world.forestId
      }));
      if (operation.affectedObjectCount > Number.MAX_SAFE_INTEGER - batch.length) {
        fail('AUTHORED_RESET_UNAVAILABLE', 'The authored reset count cannot advance.');
      }

      if (batch.length) {
        const writes = batch.map(object => ({
          updateOne: {
            filter: {
              _id: object._id,
              ownerUserId,
              forestId: world.forestId,
              objectId: object.objectId,
              state: 'active',
              recordRevision: object.recordRevision
            },
            update: {
              $set: { state: 'removed', changedAt: removedAt, removedAt, purgeEligibleAt },
              $inc: { recordRevision: 1 }
            }
          }
        }));
        const result = await db.ForestAuthoredObject.bulkWrite(writes, { session, ordered: true });
        if (Number(result?.matchedCount) !== batch.length
          || Number(result?.modifiedCount) !== batch.length) {
          fail('AUTHORED_RESET_CONFLICT', 'The authored reset batch changed concurrently.');
        }
        const counts = new Map();
        for (const object of batch) {
          const key = `${object.placementIndex.cellX}:${object.placementIndex.cellY}`;
          const current = counts.get(key) || { placementIndex: object.placementIndex, count: 0 };
          current.count += 1;
          counts.set(key, current);
        }
        for (const value of counts.values()) {
          await advanceCellRevision(db, {
            ownerUserId,
            forestId: world.forestId,
            placementIndex: value.placementIndex,
            count: value.count,
            session
          });
        }
      }

      const afterObjectId = batch.at(-1)?.objectId || operation.afterObjectId || null;
      let completed = rows.length <= batchSize;
      if (completed) {
        const remaining = await db.ForestAuthoredObject.exists({
          ownerUserId,
          forestId: world.forestId,
          state: 'active'
        }).session(session).lean();
        completed = !remaining;
        if (remaining && batch.length === 0) {
          fail('AUTHORED_RESET_MIGRATION_REQUIRED', 'The reset cursor cannot reach active state.');
        }
      }
      const updated = await db.ForestAuthoredResetOperation.findOneAndUpdate({
        _id: operation._id,
        ownerUserId,
        forestId: world.forestId,
        resetId,
        status: 'processing',
        afterObjectId: operation.afterObjectId ?? null
      }, {
        $set: {
          afterObjectId,
          status: completed ? 'completed' : 'processing',
          completedAt: completed ? removedAt : null
        },
        $inc: { affectedObjectCount: batch.length }
      }, {
        session,
        returnDocument: 'after',
        lean: true,
        runValidators: true
      });
      if (!updated) fail('AUTHORED_RESET_CONFLICT', 'The authored reset cursor changed.');
      return safeOperation(validateOperation(updated, {
        ownerUserId, forestId: world.forestId, resetId
      }), completed ? 'completed' : 'progressed');
    });
  }

  async function processOperations({ limit: limitValue, batchSize } = {}) {
    const limit = boundedInteger(
      limitValue,
      FOREST_AUTHORED_RESET_WORKER_DEFAULT_LIMIT,
      FOREST_AUTHORED_RESET_WORKER_MAX_LIMIT,
      'limit'
    );
    const resolvedBatchSize = boundedInteger(
      batchSize,
      FOREST_AUTHORED_RESET_DEFAULT_BATCH_SIZE,
      FOREST_AUTHORED_RESET_MAX_BATCH_SIZE,
      'batchSize'
    );
    const operations = await db.ForestAuthoredResetOperation.find({ status: 'processing' }, {
      _id: 0,
      ownerUserId: 1,
      resetId: 1
    }).sort({ updatedAt: 1, _id: 1 }).limit(limit).lean();
    if (!Array.isArray(operations) || operations.length > limit) {
      fail('AUTHORED_RESET_UNAVAILABLE', 'The authored reset worker read was not bounded.');
    }
    const outcomes = { requested: operations.length, progressed: 0, completed: 0, failed: 0 };
    for (const operation of operations) {
      try {
        const result = await processBatch({
          ownerUserId: operation.ownerUserId,
          resetId: operation.resetId,
          batchSize: resolvedBatchSize
        });
        if (['completed', 'already-completed'].includes(result.outcome)) outcomes.completed += 1;
        else outcomes.progressed += 1;
      } catch {
        outcomes.failed += 1;
      }
    }
    return Object.freeze(outcomes);
  }

  return Object.freeze({ request, processBatch, processOperations });
}

export const forestAuthoredReset = buildForestAuthoredResetService();

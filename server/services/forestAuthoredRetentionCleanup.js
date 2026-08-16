import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestAuthoredResetOperation from '../db/models/ForestAuthoredResetOperation.js';
import {
  FOREST_AUTHORED_COORDINATE_LIMIT,
  FOREST_AUTHORED_MARKER_APPEARANCE_ID,
  FOREST_AUTHORED_MARKER_APPEARANCE_VERSION,
  FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION,
  FOREST_AUTHORED_OBJECT_IDENTITY_VERSION,
  FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
} from '../db/schemas/ForestAuthoredObjectSchema.js';
import {
  FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION,
  FOREST_AUTHORED_RESET_OPERATION_VERSION
} from '../db/schemas/ForestAuthoredResetOperationSchema.js';
import { FOREST_OWNER_WORLD_SCHEMA_VERSION } from '../db/schemas/ForestOwnerWorldSchema.js';
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
import {
  FOREST_AUTHORED_RESET_RETENTION_MS
} from './forestAuthoredRetentionPolicy.js';

export {
  FOREST_AUTHORED_RESET_RETENTION_MS,
  FOREST_AUTHORED_RETENTION_DAYS
} from './forestAuthoredRetentionPolicy.js';
export const FOREST_AUTHORED_RETENTION_DEFAULT_BATCH_SIZE = 100;
export const FOREST_AUTHORED_RETENTION_MAX_BATCH_SIZE = 250;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class ForestAuthoredRetentionCleanupError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestAuthoredRetentionCleanupError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestAuthoredRetentionCleanupError(code, message);
}

function timestamp(clock) {
  const value = clock();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('INVALID_AUTHORED_RETENTION_DEPENDENCY', 'clock must return a valid Date.');
  }
  return new Date(value.getTime());
}

function batchSize(value) {
  const resolved = value === undefined ? FOREST_AUTHORED_RETENTION_DEFAULT_BATCH_SIZE : value;
  if (!Number.isSafeInteger(resolved)
    || resolved < 1
    || resolved > FOREST_AUTHORED_RETENTION_MAX_BATCH_SIZE) {
    fail('INVALID_AUTHORED_RETENTION_INPUT', 'batchSize is outside the supported bound.');
  }
  return resolved;
}

function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function validTombstone(object, now) {
  let expectedIndex;
  try {
    expectedIndex = deriveForestOwnerPlacementIndex({
      worldX: object?.placement?.worldX,
      worldY: object?.placement?.worldY
    });
  } catch {
    return false;
  }
  return object?.schemaVersion === FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    && object?.identityVersion === FOREST_AUTHORED_OBJECT_IDENTITY_VERSION
    && Boolean(object?._id)
    && OBJECT_ID_PATTERN.test(object?.ownerUserId || '')
    && UUID_V4_PATTERN.test(object?.forestId || '')
    && UUID_V4_PATTERN.test(object?.objectId || '')
    && object?.kind === 'personal-marker'
    && object?.state === 'removed'
    && Number.isSafeInteger(object?.placement?.worldX)
    && Number.isSafeInteger(object?.placement?.worldY)
    && Math.abs(object.placement.worldX) <= FOREST_AUTHORED_COORDINATE_LIMIT
    && Math.abs(object.placement.worldY) <= FOREST_AUTHORED_COORDINATE_LIMIT
    && object?.placementIndex?.version === FOREST_OWNER_PLACEMENT_INDEX_VERSION
    && object?.placementIndex?.cellX === expectedIndex.cellX
    && object?.placementIndex?.cellY === expectedIndex.cellY
    && object?.worldVersionEvidence?.ownerWorldSchemaVersion === FOREST_OWNER_WORLD_SCHEMA_VERSION
    && object?.worldVersionEvidence?.placementPolicyVersion
      === FOREST_OWNER_GROVE_PLACEMENT_VERSION
    && object?.worldVersionEvidence?.environmentPolicyVersion
      === FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    && object?.worldVersionEvidence?.environmentSchemaVersion
      === FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    && object?.worldVersionEvidence?.worldGenerationVersion
      === FOREST_OWNER_WORLD_GENERATION_VERSION
    && object?.appearance?.id === FOREST_AUTHORED_MARKER_APPEARANCE_ID
    && object?.appearance?.version === FOREST_AUTHORED_MARKER_APPEARANCE_VERSION
    && object?.creationFingerprint?.version === FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION
    && SHA256_BASE64URL_PATTERN.test(object?.creationFingerprint?.digest || '')
    && Number.isSafeInteger(object?.recordRevision)
    && object.recordRevision >= 2
    && validDate(object?.createdAt)
    && validDate(object?.changedAt)
    && validDate(object?.removedAt)
    && validDate(object?.purgeEligibleAt)
    && object.changedAt.getTime() === object.removedAt.getTime()
    && object.purgeEligibleAt > object.removedAt
    && object.purgeEligibleAt <= now;
}

function validCompletedReset(operation, cutoff) {
  return operation?.schemaVersion === FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION
    && operation?.operationVersion === FOREST_AUTHORED_RESET_OPERATION_VERSION
    && Boolean(operation?._id)
    && OBJECT_ID_PATTERN.test(operation?.ownerUserId || '')
    && UUID_V4_PATTERN.test(operation?.forestId || '')
    && UUID_V4_PATTERN.test(operation?.resetId || '')
    && operation?.status === 'completed'
    && ([null, undefined].includes(operation?.afterObjectId)
      || UUID_V4_PATTERN.test(operation.afterObjectId))
    && Number.isSafeInteger(operation?.affectedObjectCount)
    && operation.affectedObjectCount >= 0
    && operation?.authoredObjectSchemaVersion === FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    && operation?.spatialIndexVersion === FOREST_OWNER_PLACEMENT_INDEX_VERSION
    && validDate(operation?.startedAt)
    && validDate(operation?.completedAt)
    && operation.completedAt >= operation.startedAt
    && operation.completedAt <= cutoff;
}

function outcome(selected, deleted, failed) {
  return Object.freeze({ selected, deleted, failed });
}

export function buildForestAuthoredRetentionCleanupService({
  models = {},
  clock = () => new Date()
} = {}) {
  const db = { ForestAuthoredObject, ForestAuthoredResetOperation, ...models };

  async function purgeTombstones({ batchSize: batchValue } = {}) {
    const limit = batchSize(batchValue);
    const now = timestamp(clock);
    const objects = await db.ForestAuthoredObject.find({
      state: 'removed',
      purgeEligibleAt: { $lte: now }
    }).sort({ purgeEligibleAt: 1, _id: 1 }).limit(limit).lean();
    if (!Array.isArray(objects) || objects.length > limit) {
      fail('AUTHORED_RETENTION_UNAVAILABLE', 'The tombstone purge read was not bounded.');
    }
    let deleted = 0;
    let failed = 0;
    for (const object of objects) {
      if (!validTombstone(object, now)) {
        failed += 1;
        continue;
      }
      try {
        const result = await db.ForestAuthoredObject.deleteOne({
          _id: object._id,
          schemaVersion: FOREST_AUTHORED_OBJECT_SCHEMA_VERSION,
          identityVersion: FOREST_AUTHORED_OBJECT_IDENTITY_VERSION,
          state: 'removed',
          removedAt: object.removedAt,
          purgeEligibleAt: object.purgeEligibleAt,
          recordRevision: object.recordRevision
        });
        if (Number(result?.deletedCount) === 1) deleted += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    return outcome(objects.length, deleted, failed);
  }

  async function purgeCompletedResetOperations({ batchSize: batchValue } = {}) {
    const limit = batchSize(batchValue);
    const now = timestamp(clock);
    const cutoff = new Date(now.getTime() - FOREST_AUTHORED_RESET_RETENTION_MS);
    const operations = await db.ForestAuthoredResetOperation.find({
      status: 'completed',
      completedAt: { $lte: cutoff }
    }).sort({ completedAt: 1, _id: 1 }).limit(limit).lean();
    if (!Array.isArray(operations) || operations.length > limit) {
      fail('AUTHORED_RETENTION_UNAVAILABLE', 'The reset-operation purge read was not bounded.');
    }
    let deleted = 0;
    let failed = 0;
    for (const operation of operations) {
      if (!validCompletedReset(operation, cutoff)) {
        failed += 1;
        continue;
      }
      try {
        const result = await db.ForestAuthoredResetOperation.deleteOne({
          _id: operation._id,
          schemaVersion: FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION,
          operationVersion: FOREST_AUTHORED_RESET_OPERATION_VERSION,
          status: 'completed',
          completedAt: operation.completedAt
        });
        if (Number(result?.deletedCount) === 1) deleted += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    return outcome(operations.length, deleted, failed);
  }

  return Object.freeze({ purgeTombstones, purgeCompletedResetOperations });
}

export const forestAuthoredRetentionCleanup = buildForestAuthoredRetentionCleanupService();

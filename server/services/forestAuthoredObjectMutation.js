import crypto from 'node:crypto';

import mongoose from 'mongoose';

import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../db/models/ForestAuthoredRegionRevision.js';
import ForestAuthoredResetOperation from '../db/models/ForestAuthoredResetOperation.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
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
  FOREST_OWNER_WORLD_SCHEMA_VERSION
} from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  acquireForestLedgerFence
} from './forestLedgerFence.js';
import {
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION
} from './forestOwnerEnvironmentResolver.js';
import {
  FOREST_OWNER_GROVE_PLACEMENT_VERSION
} from './forestOwnerGrovePlacement.js';
import {
  inspectForestAuthoredPlacement
} from './forestAuthoredPlacement.js';
import {
  deriveForestOwnerPlacementIndex,
  FOREST_OWNER_PLACEMENT_INDEX_VERSION
} from './forestOwnerPlacementNeighborhood.js';

export const FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION = 1;
export const FOREST_AUTHORED_TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class ForestAuthoredMutationError extends Error {
  constructor(code, message, object = null) {
    super(message);
    this.name = 'ForestAuthoredMutationError';
    this.code = code;
    this.object = object;
  }
}

function fail(code, message, object = null) {
  throw new ForestAuthoredMutationError(code, message, object);
}

function exactInput(input, allowedFields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('INVALID_AUTHORED_MUTATION_INPUT', 'Mutation input must be an object.');
  }
  const allowed = new Set(allowedFields);
  if (Object.keys(input).some(field => !allowed.has(field))) {
    fail('INVALID_AUTHORED_MUTATION_INPUT', 'Mutation input contains an unknown field.');
  }
  return input;
}

function canonicalOwner(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail(
      'INVALID_AUTHORED_MUTATION_INPUT',
      'ownerUserId must be a canonical ObjectId string.'
    );
  }
  return ownerUserId;
}

function canonicalObjectId(value) {
  const objectId = String(value || '').toLowerCase();
  if (!UUID_V4_PATTERN.test(objectId)) {
    fail(
      'INVALID_AUTHORED_MUTATION_INPUT',
      'objectId must be a canonical UUIDv4.'
    );
  }
  return objectId;
}

function protocolVersion(value) {
  if (value !== FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION) {
    fail(
      'UNSUPPORTED_AUTHORED_MUTATION_PROTOCOL',
      'The authored mutation protocol version is unsupported.'
    );
  }
  return value;
}

function coordinate(value, fieldName) {
  if (
    !Number.isSafeInteger(value)
    || value < -FOREST_AUTHORED_COORDINATE_LIMIT
    || value > FOREST_AUTHORED_COORDINATE_LIMIT
  ) {
    fail(
      'INVALID_AUTHORED_MUTATION_INPUT',
      `${fieldName} must be a supported signed integer coordinate.`
    );
  }
  return value;
}

function revision(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(
      'INVALID_AUTHORED_MUTATION_INPUT',
      'expectedRevision must be a positive safe integer.'
    );
  }
  return value;
}

function timestamp(clock) {
  const value = clock();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(
      'INVALID_AUTHORED_MUTATION_DEPENDENCY',
      'clock must return a valid Date.'
    );
  }
  return new Date(value.getTime());
}

function leanObject(value) {
  if (value?.toObject) return value.toObject();
  return value;
}

function safeObject(value) {
  const object = leanObject(value);
  if (!object) return null;
  return Object.freeze({
    objectId: object.objectId,
    kind: object.kind,
    state: object.state,
    placement: Object.freeze({
      worldX: object.placement.worldX,
      worldY: object.placement.worldY
    }),
    placementIndex: Object.freeze({
      version: object.placementIndex.version,
      cellX: object.placementIndex.cellX,
      cellY: object.placementIndex.cellY
    }),
    appearance: Object.freeze({
      id: object.appearance.id,
      version: object.appearance.version
    }),
    recordRevision: object.recordRevision,
    createdAt: object.createdAt ? new Date(object.createdAt) : null,
    changedAt: new Date(object.changedAt),
    removedAt: object.removedAt ? new Date(object.removedAt) : null,
    purgeEligibleAt: object.purgeEligibleAt
      ? new Date(object.purgeEligibleAt) : null
  });
}

function result(outcome, object) {
  return Object.freeze({
    protocolVersion: FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION,
    outcome,
    object: safeObject(object)
  });
}

export function createForestAuthoredCreationFingerprint({
  objectId,
  kind,
  worldX,
  worldY
}) {
  const canonical = JSON.stringify([
    FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION,
    objectId,
    kind,
    worldX,
    worldY,
    FOREST_AUTHORED_MARKER_APPEARANCE_ID,
    FOREST_AUTHORED_MARKER_APPEARANCE_VERSION
  ]);
  return Object.freeze({
    version: FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION,
    digest: crypto.createHash('sha256').update(canonical).digest('base64url')
  });
}

function validateWorld(world, ownerUserId) {
  if (!world) {
    fail('AUTHORED_OWNER_UNAVAILABLE', 'The owner forest is unavailable.');
  }
  if (
    world.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || world.ownerUserId !== ownerUserId
    || !UUID_V4_PATTERN.test(world.forestId || '')
    || world.worldRole !== 'primary'
    || world.placementPolicyVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || world.environmentPolicyVersion !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || world.environmentSchemaVersion !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || world.worldGenerationVersion !== FOREST_OWNER_WORLD_GENERATION_VERSION
  ) {
    fail(
      'AUTHORED_MIGRATION_REQUIRED',
      'The owner forest uses unsupported authored-placement versions.'
    );
  }
  if (
    world.status !== 'active'
    || world.reconciliation?.state !== 'idle'
  ) {
    fail('AUTHORED_OWNER_UNAVAILABLE', 'The owner forest is unavailable.');
  }
  if (
    typeof world.worldSeed !== 'string'
    || world.worldSeed.length < 32
    || world.worldSeed.length > 80
    || !BASE64URL_PATTERN.test(world.worldSeed)
  ) {
    fail('AUTHORED_OWNER_UNAVAILABLE', 'The owner forest is malformed.');
  }
  return world;
}

function supportedVersionEvidence(object) {
  return object?.worldVersionEvidence?.ownerWorldSchemaVersion
      === FOREST_OWNER_WORLD_SCHEMA_VERSION
    && object?.worldVersionEvidence?.placementPolicyVersion
      === FOREST_OWNER_GROVE_PLACEMENT_VERSION
    && object?.worldVersionEvidence?.environmentPolicyVersion
      === FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    && object?.worldVersionEvidence?.environmentSchemaVersion
      === FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    && object?.worldVersionEvidence?.worldGenerationVersion
      === FOREST_OWNER_WORLD_GENERATION_VERSION;
}

function validateStoredObject(object, { ownerUserId, forestId, objectId }) {
  if (!object) return null;
  if (
    object.schemaVersion !== FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    || object.identityVersion !== FOREST_AUTHORED_OBJECT_IDENTITY_VERSION
    || !supportedVersionEvidence(object)
    || object.placementIndex?.version !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
    || object.appearance?.id !== FOREST_AUTHORED_MARKER_APPEARANCE_ID
    || object.appearance?.version !== FOREST_AUTHORED_MARKER_APPEARANCE_VERSION
  ) {
    fail(
      'AUTHORED_MIGRATION_REQUIRED',
      'The authored object uses unsupported versions.'
    );
  }
  let expectedIndex;
  try {
    expectedIndex = deriveForestOwnerPlacementIndex({
      worldX: object?.placement?.worldX,
      worldY: object?.placement?.worldY
    });
  } catch {
    fail('AUTHORED_OBJECT_UNAVAILABLE', 'The authored object is malformed.');
  }
  const activeLifecycle = object.state === 'active'
    && object.removedAt === null
    && object.purgeEligibleAt === null;
  const removedLifecycle = object.state === 'removed'
    && object.removedAt instanceof Date
    && !Number.isNaN(object.removedAt.getTime())
    && object.purgeEligibleAt instanceof Date
    && !Number.isNaN(object.purgeEligibleAt.getTime())
    && object.changedAt instanceof Date
    && object.changedAt.getTime() === object.removedAt.getTime()
    && object.purgeEligibleAt > object.removedAt;
  if (
    object.ownerUserId !== ownerUserId
    || object.forestId !== forestId
    || object.objectId !== objectId
    || object.kind !== 'personal-marker'
    || !['active', 'removed'].includes(object.state)
    || object.placementIndex.cellX !== expectedIndex.cellX
    || object.placementIndex.cellY !== expectedIndex.cellY
    || !Number.isSafeInteger(object.recordRevision)
    || object.recordRevision < 1
    || object.recordRevision > Number.MAX_SAFE_INTEGER
    || object.creationFingerprint?.version
      !== FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION
    || !SHA256_BASE64URL_PATTERN.test(object.creationFingerprint?.digest || '')
    || !(object.createdAt instanceof Date)
    || !(object.changedAt instanceof Date)
    || (!activeLifecycle && !removedLifecycle)
  ) {
    fail('AUTHORED_OBJECT_UNAVAILABLE', 'The authored object is malformed.');
  }
  return object;
}

function versionEvidence(world) {
  return {
    ownerWorldSchemaVersion: FOREST_OWNER_WORLD_SCHEMA_VERSION,
    placementPolicyVersion: world.placementPolicyVersion,
    environmentPolicyVersion: world.environmentPolicyVersion,
    environmentSchemaVersion: world.environmentSchemaVersion,
    worldGenerationVersion: world.worldGenerationVersion
  };
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let resultValue;
    await session.withTransaction(async () => {
      resultValue = await work(session);
    });
    return resultValue;
  } finally {
    await session.endSession();
  }
}

async function queryOwnerWorld(db, ownerUserId, session) {
  const deletion = await db.AccountDeletionRequest.exists({
    ownerUserId,
    status: { $in: ['processing', 'completed'] }
  }).session(session).lean();
  if (deletion) {
    fail('AUTHORED_OWNER_UNAVAILABLE', 'The owner forest is unavailable.');
  }
  const world = validateWorld(await db.ForestOwnerWorld.findOne({
    ownerUserId,
    worldRole: 'primary'
  }).session(session).lean(), ownerUserId);
  const reset = await db.ForestAuthoredResetOperation.exists({
    ownerUserId,
    forestId: world.forestId,
    status: 'processing'
  }).session(session).lean();
  if (reset) {
    fail('AUTHORED_RESETTING', 'The authored overlay is being reset.');
  }
  return world;
}

async function readObject(db, { ownerUserId, forestId, objectId, session }) {
  return db.ForestAuthoredObject.findOne({
    ownerUserId,
    forestId,
    objectId
  }).session(session).lean();
}

async function advanceCellRevision(db, {
  ownerUserId,
  forestId,
  placementIndex,
  session
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
      revision: { $lt: Number.MAX_SAFE_INTEGER }
    }, {
      $setOnInsert: {
        schemaVersion: FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION,
        ownerUserId,
        forestId,
        spatialIndexVersion: placementIndex.version,
        cellX: placementIndex.cellX,
        cellY: placementIndex.cellY
      },
      $inc: { revision: 1 }
    }, {
      session,
      upsert: true,
      returnDocument: 'after',
      lean: true,
      runValidators: true,
      setDefaultsOnInsert: false
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    fail(
      'AUTHORED_REGION_REVISION_UNAVAILABLE',
      'The authored region revision could not advance.'
    );
  }
  if (
    !cell
    || cell.schemaVersion !== FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION
    || cell.ownerUserId !== ownerUserId
    || cell.forestId !== forestId
    || cell.spatialIndexVersion !== placementIndex.version
    || cell.cellX !== placementIndex.cellX
    || cell.cellY !== placementIndex.cellY
    || !Number.isSafeInteger(cell.revision)
    || cell.revision < 1
  ) {
    fail(
      'AUTHORED_REGION_REVISION_UNAVAILABLE',
      'The authored region revision could not advance.'
    );
  }
}

function isDuplicateKey(error) {
  return Number(error?.code) === 11_000;
}

export function buildForestAuthoredObjectMutationService({
  models = {},
  transactionRunner = runInTransaction,
  acquireFence = acquireForestLedgerFence,
  inspectPlacement = inspectForestAuthoredPlacement,
  clock = () => new Date()
} = {}) {
  const db = {
    AccountDeletionRequest,
    ForestAuthoredObject,
    ForestAuthoredRegionRevision,
    ForestAuthoredResetOperation,
    ForestOwnerWorld,
    ForestWritingTree,
    User,
    ...models
  };
  for (const [name, dependency] of Object.entries({
    transactionRunner,
    acquireFence,
    inspectPlacement,
    clock
  })) {
    if (typeof dependency !== 'function') {
      fail('INVALID_AUTHORED_MUTATION_DEPENDENCY', `${name} must be a function.`);
    }
  }

  async function authority(ownerUserId, session) {
    await acquireFence({
      ownerUserId,
      session,
      UserModel: db.User
    });
    return queryOwnerWorld(db, ownerUserId, session);
  }

  async function inspect({
    ownerUserId,
    world,
    objectId,
    worldX,
    worldY,
    destinationIndex,
    enforceDensity,
    session
  }) {
    return inspectPlacement({
      ownerUserId,
      world,
      objectId,
      worldX,
      worldY,
      destinationIndex,
      enforceDensity,
      session,
      ForestAuthoredObjectModel: db.ForestAuthoredObject,
      ForestWritingTreeModel: db.ForestWritingTree
    });
  }

  async function create(input) {
    exactInput(input, ['ownerUserId', 'objectId', 'protocolVersion', 'kind', 'worldX', 'worldY']);
    const ownerUserId = canonicalOwner(input.ownerUserId);
    const objectId = canonicalObjectId(input.objectId);
    protocolVersion(input.protocolVersion);
    if (input.kind !== 'personal-marker') {
      fail('UNSUPPORTED_AUTHORED_OBJECT_KIND', 'The authored object kind is unsupported.');
    }
    const worldX = coordinate(input.worldX, 'worldX');
    const worldY = coordinate(input.worldY, 'worldY');
    const changedAt = timestamp(clock);
    const fingerprint = createForestAuthoredCreationFingerprint({
      objectId,
      kind: input.kind,
      worldX,
      worldY
    });

    const attempt = () => transactionRunner(async (session) => {
      const world = await authority(ownerUserId, session);
      const existing = validateStoredObject(await readObject(db, {
        ownerUserId,
        forestId: world.forestId,
        objectId,
        session
      }), { ownerUserId, forestId: world.forestId, objectId });
      if (existing) {
        if (existing.creationFingerprint.digest !== fingerprint.digest) {
          fail(
            'AUTHORED_CREATE_IDEMPOTENCY_CONFLICT',
            'The authored object id was used for a different creation.',
            safeObject(existing)
          );
        }
        return result(
          existing.state === 'active' ? 'existing-active' : 'existing-removed',
          existing
        );
      }
      const placementIndex = deriveForestOwnerPlacementIndex({ worldX, worldY });
      await inspect({
        ownerUserId,
        world,
        objectId,
        worldX,
        worldY,
        destinationIndex: placementIndex,
        enforceDensity: true,
        session
      });
      const [created] = await db.ForestAuthoredObject.create([{
        objectId,
        forestId: world.forestId,
        ownerUserId,
        kind: input.kind,
        state: 'active',
        placement: { worldX, worldY },
        placementIndex,
        worldVersionEvidence: versionEvidence(world),
        appearance: {
          id: FOREST_AUTHORED_MARKER_APPEARANCE_ID,
          version: FOREST_AUTHORED_MARKER_APPEARANCE_VERSION
        },
        creationFingerprint: fingerprint,
        recordRevision: 1,
        changedAt,
        removedAt: null,
        purgeEligibleAt: null
      }], { session });
      await advanceCellRevision(db, {
        ownerUserId,
        forestId: world.forestId,
        placementIndex,
        session
      });
      return result('created', created);
    });

    try {
      return await attempt();
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      return attempt();
    }
  }

  async function move(input) {
    exactInput(input, [
      'ownerUserId', 'objectId', 'protocolVersion', 'expectedRevision', 'worldX', 'worldY'
    ]);
    const ownerUserId = canonicalOwner(input.ownerUserId);
    const objectId = canonicalObjectId(input.objectId);
    protocolVersion(input.protocolVersion);
    const expectedRevision = revision(input.expectedRevision);
    const worldX = coordinate(input.worldX, 'worldX');
    const worldY = coordinate(input.worldY, 'worldY');
    const changedAt = timestamp(clock);

    return transactionRunner(async (session) => {
      const world = await authority(ownerUserId, session);
      const current = validateStoredObject(await readObject(db, {
        ownerUserId,
        forestId: world.forestId,
        objectId,
        session
      }), { ownerUserId, forestId: world.forestId, objectId });
      if (!current) {
        fail('AUTHORED_OBJECT_NOT_FOUND', 'The authored object was not found.');
      }
      if (current.state === 'removed') {
        fail(
          'AUTHORED_OBJECT_REMOVED',
          'The authored object has been removed.',
          safeObject(current)
        );
      }
      if (
        current.placement.worldX === worldX
        && current.placement.worldY === worldY
      ) return result('unchanged', current);
      if (current.recordRevision !== expectedRevision) {
        fail(
          'AUTHORED_OBJECT_CONFLICT',
          'The authored object changed elsewhere.',
          safeObject(current)
        );
      }
      if (current.recordRevision === Number.MAX_SAFE_INTEGER) {
        fail('AUTHORED_OBJECT_UNAVAILABLE', 'The authored object revision cannot advance.');
      }
      const destinationIndex = deriveForestOwnerPlacementIndex({ worldX, worldY });
      const sameCell = current.placementIndex.cellX === destinationIndex.cellX
        && current.placementIndex.cellY === destinationIndex.cellY;
      await inspect({
        ownerUserId,
        world,
        objectId,
        worldX,
        worldY,
        destinationIndex,
        enforceDensity: !sameCell,
        session
      });
      const updated = await db.ForestAuthoredObject.findOneAndUpdate({
        _id: current._id,
        ownerUserId,
        forestId: world.forestId,
        objectId,
        state: 'active',
        recordRevision: expectedRevision
      }, {
        $set: {
          placement: { worldX, worldY },
          placementIndex: destinationIndex,
          worldVersionEvidence: versionEvidence(world),
          changedAt
        },
        $inc: { recordRevision: 1 }
      }, {
        session,
        returnDocument: 'after',
        lean: true,
        runValidators: true
      });
      if (!updated) {
        fail('AUTHORED_OBJECT_CONFLICT', 'The authored object changed elsewhere.');
      }
      await advanceCellRevision(db, {
        ownerUserId,
        forestId: world.forestId,
        placementIndex: current.placementIndex,
        session
      });
      if (!sameCell) {
        await advanceCellRevision(db, {
          ownerUserId,
          forestId: world.forestId,
          placementIndex: destinationIndex,
          session
        });
      }
      return result('moved', updated);
    });
  }

  async function remove(input) {
    exactInput(input, ['ownerUserId', 'objectId', 'protocolVersion', 'expectedRevision']);
    const ownerUserId = canonicalOwner(input.ownerUserId);
    const objectId = canonicalObjectId(input.objectId);
    protocolVersion(input.protocolVersion);
    const expectedRevision = revision(input.expectedRevision);
    const removedAt = timestamp(clock);
    const purgeEligibleAt = new Date(
      removedAt.getTime() + FOREST_AUTHORED_TOMBSTONE_RETENTION_MS
    );

    return transactionRunner(async (session) => {
      const world = await authority(ownerUserId, session);
      const current = validateStoredObject(await readObject(db, {
        ownerUserId,
        forestId: world.forestId,
        objectId,
        session
      }), { ownerUserId, forestId: world.forestId, objectId });
      if (!current) {
        fail('AUTHORED_OBJECT_NOT_FOUND', 'The authored object was not found.');
      }
      if (current.state === 'removed') return result('already-removed', current);
      if (current.recordRevision !== expectedRevision) {
        fail(
          'AUTHORED_OBJECT_CONFLICT',
          'The authored object changed elsewhere.',
          safeObject(current)
        );
      }
      if (current.recordRevision === Number.MAX_SAFE_INTEGER) {
        fail('AUTHORED_OBJECT_UNAVAILABLE', 'The authored object revision cannot advance.');
      }
      const updated = await db.ForestAuthoredObject.findOneAndUpdate({
        _id: current._id,
        ownerUserId,
        forestId: world.forestId,
        objectId,
        state: 'active',
        recordRevision: expectedRevision
      }, {
        $set: {
          state: 'removed',
          changedAt: removedAt,
          removedAt,
          purgeEligibleAt
        },
        $inc: { recordRevision: 1 }
      }, {
        session,
        returnDocument: 'after',
        lean: true,
        runValidators: true
      });
      if (!updated) {
        fail('AUTHORED_OBJECT_CONFLICT', 'The authored object changed elsewhere.');
      }
      await advanceCellRevision(db, {
        ownerUserId,
        forestId: world.forestId,
        placementIndex: current.placementIndex,
        session
      });
      return result('removed', updated);
    });
  }

  return Object.freeze({ create, move, remove });
}

export const forestAuthoredObjectMutations = buildForestAuthoredObjectMutationService();

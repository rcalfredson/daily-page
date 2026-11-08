import { forestTerrainDescriptor } from './forestOwnerTerrainRegion.js';
import { forestWritingLinksEnabled } from './forestWritingLinkAvailability.js';
import { canonicalForestWritingLink, readForestAuthoredObjectFormat } from './forestAuthoredObjectFormat.js';
import { inspectForestAuthoredWritingLink } from './forestAuthoredWritingLink.js';
import mongoose from 'mongoose';
import { createForestAuthoredCreationFingerprint } from './forestAuthoredCreationFingerprint.js';
export { createForestAuthoredCreationFingerprint } from './forestAuthoredCreationFingerprint.js';

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
  FOREST_AUTHORED_OBJECT_IDENTITY_VERSION,
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
  FOREST_AUTHORED_TOMBSTONE_RETENTION_MS
} from './forestAuthoredRetentionPolicy.js';
import {
  deriveForestOwnerPlacementIndex,
  FOREST_OWNER_PLACEMENT_INDEX_VERSION
} from './forestOwnerPlacementNeighborhood.js';

export const FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION = 1;
export { FOREST_AUTHORED_TOMBSTONE_RETENTION_MS } from './forestAuthoredRetentionPolicy.js';

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
  if (![1, 2, 3].includes(value)) {
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

function safeObject(value, version = 1) {
  const object = leanObject(value);
  if (!object) return null;
  if (version === 1 && object.schemaVersion === 2) {
    fail('AUTHORED_PROTOCOL_UPGRADE_REQUIRED', 'The marker requires a newer mutation protocol.');
  }
  return Object.freeze({
    ...(version >= 2 ? {
      schemaVersion: object.schemaVersion,
      writingLink: object.schemaVersion === 2 ? Object.freeze({ ...object.writingLink }) : null
    } : {}),
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

function result(outcome, object, version = 1) {
  return Object.freeze({
    protocolVersion: version,
    outcome,
    object: safeObject(object, version)
  });
}

function validateWorld(world, ownerUserId, { allowReconciling = false } = {}) {
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
    || (world.reconciliation?.state !== 'idle'
      && !(allowReconciling && world.reconciliation?.state === 'running'))
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
    ![1, 2].includes(object.schemaVersion)
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
    readForestAuthoredObjectFormat(object);
    expectedIndex = deriveForestOwnerPlacementIndex({
      worldX: object?.placement?.worldX,
      worldY: object?.placement?.worldY
    });
  } catch (error) {
    if (error.code?.startsWith('UNSUPPORTED_AUTHORED_')) {
      fail('AUTHORED_MIGRATION_REQUIRED', 'The authored object uses unsupported versions.');
    }
    fail('AUTHORED_OBJECT_UNAVAILABLE', 'The authored object is malformed.');
  }
  // createdAt records insertion time. changedAt is captured before the transaction, so a
  // newly created marker can legitimately have changedAt earlier than createdAt.
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
    || Math.abs(object.placement.worldX) > FOREST_AUTHORED_COORDINATE_LIMIT
    || Math.abs(object.placement.worldY) > FOREST_AUTHORED_COORDINATE_LIMIT
    || object.placementIndex.cellX !== expectedIndex.cellX
    || object.placementIndex.cellY !== expectedIndex.cellY
    || !Number.isSafeInteger(object.recordRevision)
    || object.recordRevision < 1
    || object.recordRevision > Number.MAX_SAFE_INTEGER
    || object.creationFingerprint?.version !== object.schemaVersion
    || !SHA256_BASE64URL_PATTERN.test(object.creationFingerprint?.digest || '')
    || !(object.createdAt instanceof Date)
    || !(object.changedAt instanceof Date)
    || Number.isNaN(object.createdAt.getTime())
    || Number.isNaN(object.changedAt.getTime())
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
  inspectWritingLink = inspectForestAuthoredWritingLink,
  linkedCreationEnabled = forestWritingLinksEnabled,
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
    inspectWritingLink,
    linkedCreationEnabled,
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

  function requireCurrentTerrain(input, world) {
    const descriptor = forestTerrainDescriptor(world);
    if (descriptor && (input.protocolVersion !== 3 || input.terrainToken !== descriptor.token)
      || input.protocolVersion === 3 && (!descriptor || typeof input.terrainToken !== 'string'
        || input.terrainToken !== descriptor.token)) {
      fail('AUTHORED_PROTOCOL_UPGRADE_REQUIRED', 'Reload the forest before placing a marker.');
    }
  }

  async function create(input) {
    exactInput(input, ['ownerUserId', 'objectId', 'protocolVersion', 'kind', 'worldX', 'worldY',
      ...(input?.protocolVersion === 2 || input?.protocolVersion === 3 && Object.hasOwn(input, 'writingLink') ? ['writingLink'] : []),
      ...(input?.protocolVersion === 3 ? ['terrainToken'] : [])]);
    const ownerUserId = canonicalOwner(input.ownerUserId);
    const objectId = canonicalObjectId(input.objectId);
    const version = protocolVersion(input.protocolVersion);
    if (input.kind !== 'personal-marker') {
      fail('UNSUPPORTED_AUTHORED_OBJECT_KIND', 'The authored object kind is unsupported.');
    }
    const worldX = coordinate(input.worldX, 'worldX');
    const worldY = coordinate(input.worldY, 'worldY');
    let writingLink;
    if (version === 2 || version === 3 && Object.hasOwn(input, 'writingLink')) {
      try { writingLink = canonicalForestWritingLink(input.writingLink); }
      catch { fail('INVALID_AUTHORED_MUTATION_INPUT', 'The writing relationship is invalid.'); }
    }
    const changedAt = timestamp(clock);
    const fingerprint = createForestAuthoredCreationFingerprint({
      objectId,
      kind: input.kind,
      worldX,
      worldY,
      ...(writingLink ? { writingLink } : {})
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
        if (existing.creationFingerprint.version !== fingerprint.version
          || existing.creationFingerprint.digest !== fingerprint.digest) {
          fail(
            'AUTHORED_CREATE_IDEMPOTENCY_CONFLICT',
            'The authored object id was used for a different creation.',
            version === 1 && existing.schemaVersion === 2 ? null : safeObject(existing, version)
          );
        }
        return result(
          existing.state === 'active' ? 'existing-active' : 'existing-removed',
          existing, version
        );
      }
      requireCurrentTerrain(input, world);
      if (writingLink) {
        if (linkedCreationEnabled() !== true) {
          fail('AUTHORED_WRITING_LINKS_DISABLED', 'New writing-linked markers are unavailable.');
        }
        try {
          await inspectWritingLink({
            ownerUserId, world, writingLink, worldX, worldY, session,
            ForestWritingTreeModel: db.ForestWritingTree
          });
        } catch (error) {
          if (['AUTHORED_WRITING_UNAVAILABLE', 'AUTHORED_WRITING_DISTANCE'].includes(error.code)) {
            fail(error.code, 'The writing cannot be marked here.');
          }
          throw error;
        }
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
        ...(writingLink ? { schemaVersion: 2, writingLink } : {}),
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
      return result('created', created, version);
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
      'ownerUserId', 'objectId', 'protocolVersion', 'expectedRevision', 'worldX', 'worldY',
      ...(input?.protocolVersion === 3 ? ['terrainToken'] : [])
    ]);
    const ownerUserId = canonicalOwner(input.ownerUserId);
    const objectId = canonicalObjectId(input.objectId);
    const version = protocolVersion(input.protocolVersion);
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
      if (version === 1 && current.schemaVersion === 2) {
        fail('AUTHORED_PROTOCOL_UPGRADE_REQUIRED', 'The marker requires a newer mutation protocol.');
      }
      if (current.state === 'removed') {
        fail(
          'AUTHORED_OBJECT_REMOVED',
          'The authored object has been removed.',
          safeObject(current, version)
        );
      }
      if (
        current.placement.worldX === worldX
        && current.placement.worldY === worldY
      ) return result('unchanged', current, version);
      if (current.recordRevision !== expectedRevision) {
        fail(
          'AUTHORED_OBJECT_CONFLICT',
          'The authored object changed elsewhere.',
          safeObject(current, version)
        );
      }
      if (current.recordRevision === Number.MAX_SAFE_INTEGER) {
        fail('AUTHORED_OBJECT_UNAVAILABLE', 'The authored object revision cannot advance.');
      }
      requireCurrentTerrain(input, world);
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
      return result('moved', updated, version);
    });
  }

  async function remove(input) {
    exactInput(input, ['ownerUserId', 'objectId', 'protocolVersion', 'expectedRevision']);
    const ownerUserId = canonicalOwner(input.ownerUserId);
    const objectId = canonicalObjectId(input.objectId);
    const version = protocolVersion(input.protocolVersion);
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
      if (version === 1 && current.schemaVersion === 2) {
        fail('AUTHORED_PROTOCOL_UPGRADE_REQUIRED', 'The marker requires a newer mutation protocol.');
      }
      if (current.state === 'removed') return result('already-removed', current, version);
      if (current.recordRevision !== expectedRevision) {
        fail(
          'AUTHORED_OBJECT_CONFLICT',
          'The authored object changed elsewhere.',
          safeObject(current, version)
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
      return result('removed', updated, version);
    });
  }

  return Object.freeze({ create, move, remove });
}

export const forestAuthoredObjectMutations = buildForestAuthoredObjectMutationService();

// Read boundaries share the full durable-record and world checks used by mutations.
export {
  validateStoredObject as validateForestAuthoredStoredObject,
  validateWorld as validateForestAuthoredOwnerWorld
};

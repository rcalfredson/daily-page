import crypto from 'node:crypto';

import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import {
  FOREST_AUTHORED_COORDINATE_LIMIT,
  FOREST_AUTHORED_MARKER_APPEARANCE_ID,
  FOREST_AUTHORED_MARKER_APPEARANCE_VERSION,
  FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION,
  FOREST_AUTHORED_OBJECT_IDENTITY_VERSION,
  FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
} from '../db/schemas/ForestAuthoredObjectSchema.js';
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

export const FOREST_AUTHORED_DIAGNOSTIC_EXPORT_VERSION = 1;
export const FOREST_AUTHORED_DIAGNOSTIC_CURSOR_VERSION = 1;
export const FOREST_AUTHORED_DIAGNOSTIC_DEFAULT_PAGE_SIZE = 100;
export const FOREST_AUTHORED_DIAGNOSTIC_MAX_PAGE_SIZE = 250;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const COMPACT_FINGERPRINT_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const CURSOR_MAX_LENGTH = 512;
const OBJECT_PROJECTION = Object.freeze({
  _id: 0,
  schemaVersion: 1,
  identityVersion: 1,
  objectId: 1,
  forestId: 1,
  ownerUserId: 1,
  kind: 1,
  state: 1,
  placement: 1,
  placementIndex: 1,
  worldVersionEvidence: 1,
  appearance: 1,
  creationFingerprint: 1,
  recordRevision: 1,
  createdAt: 1,
  changedAt: 1,
  removedAt: 1,
  purgeEligibleAt: 1
});

export class ForestAuthoredDiagnosticExportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestAuthoredDiagnosticExportError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestAuthoredDiagnosticExportError(code, message);
}

function canonicalOwner(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail('INVALID_AUTHORED_DIAGNOSTIC_INPUT', 'ownerUserId must be a canonical ObjectId string.');
  }
  return ownerUserId;
}

function exactIncludeRemoved(value) {
  if (typeof value !== 'boolean') {
    fail('INVALID_AUTHORED_DIAGNOSTIC_INPUT', 'includeRemoved must be an explicit boolean.');
  }
  return value;
}

function resolveLimit(value) {
  if (value === undefined || value === null || value === '') {
    return FOREST_AUTHORED_DIAGNOSTIC_DEFAULT_PAGE_SIZE;
  }
  const normalized = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)
    || normalized < 1
    || normalized > FOREST_AUTHORED_DIAGNOSTIC_MAX_PAGE_SIZE) {
    fail(
      'INVALID_AUTHORED_DIAGNOSTIC_INPUT',
      `limit must be an integer from 1 through ${FOREST_AUTHORED_DIAGNOSTIC_MAX_PAGE_SIZE}.`
    );
  }
  return normalized;
}

function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function currentTime(now) {
  const value = now();
  if (!validDate(value)) fail('AUTHORED_DIAGNOSTIC_UNAVAILABLE', 'The export clock is invalid.');
  return new Date(value);
}

function compactFingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('base64url').slice(0, 22);
}

function encodeCursor({ forestId, includeRemoved, exportStartedAt, afterObjectId }) {
  return Buffer.from(JSON.stringify({
    version: FOREST_AUTHORED_DIAGNOSTIC_CURSOR_VERSION,
    exportVersion: FOREST_AUTHORED_DIAGNOSTIC_EXPORT_VERSION,
    forestFingerprint: compactFingerprint(forestId),
    includeRemoved,
    exportStartedAt: exportStartedAt.toISOString(),
    afterObjectId
  })).toString('base64url');
}

function decodeCursor(value, { includeRemoved, currentDate }) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > CURSOR_MAX_LENGTH) {
    fail('INVALID_AUTHORED_DIAGNOSTIC_INPUT', 'cursor must be a bounded opaque string.');
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const fields = decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? Object.keys(decoded) : [];
    const exportStartedAt = new Date(decoded?.exportStartedAt);
    if (fields.length !== 6
      || !fields.includes('version')
      || !fields.includes('exportVersion')
      || !fields.includes('forestFingerprint')
      || !fields.includes('includeRemoved')
      || !fields.includes('exportStartedAt')
      || !fields.includes('afterObjectId')
      || decoded.version !== FOREST_AUTHORED_DIAGNOSTIC_CURSOR_VERSION
      || decoded.exportVersion !== FOREST_AUTHORED_DIAGNOSTIC_EXPORT_VERSION
      || decoded.includeRemoved !== includeRemoved
      || !COMPACT_FINGERPRINT_PATTERN.test(decoded.forestFingerprint || '')
      || !validDate(exportStartedAt)
      || exportStartedAt > currentDate
      || !UUID_V4_PATTERN.test(decoded.afterObjectId || '')) {
      throw new Error('unsupported cursor');
    }
    return { ...decoded, exportStartedAt };
  } catch {
    fail('INVALID_AUTHORED_DIAGNOSTIC_INPUT', 'cursor is invalid for this export.');
  }
}

async function lean(query) {
  const result = query.lean();
  return typeof result.exec === 'function' ? result.exec() : result;
}

function validateWorld(world, ownerUserId) {
  if (world.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || world.ownerUserId !== ownerUserId
    || world.worldRole !== 'primary'
    || !UUID_V4_PATTERN.test(world.forestId || '')
    || world.placementPolicyVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || world.environmentPolicyVersion !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || world.environmentSchemaVersion !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || world.worldGenerationVersion !== FOREST_OWNER_WORLD_GENERATION_VERSION) {
    fail(
      'AUTHORED_DIAGNOSTIC_MIGRATION_REQUIRED',
      'The owner world uses unsupported diagnostic identity or versions.'
    );
  }
  if (world.status !== 'active'
    || !['idle', 'running'].includes(world.reconciliation?.state)) {
    fail('AUTHORED_DIAGNOSTIC_UNAVAILABLE', 'The owner world is unavailable.');
  }
}

function validateSupportedVersions(object) {
  if (object?.schemaVersion !== FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    || object?.identityVersion !== FOREST_AUTHORED_OBJECT_IDENTITY_VERSION
    || object?.kind !== 'personal-marker'
    || !['active', 'removed'].includes(object?.state)
    || object?.placementIndex?.version !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
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
    || object?.creationFingerprint?.version !== FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION) {
    fail(
      'AUTHORED_DIAGNOSTIC_MIGRATION_REQUIRED',
      'The diagnostic inventory contains unsupported authored-object versions.'
    );
  }
}

function validateObject(object, { ownerUserId, forestId, exportStartedAt }) {
  validateSupportedVersions(object);
  let expectedIndex;
  try {
    expectedIndex = deriveForestOwnerPlacementIndex({
      worldX: object?.placement?.worldX,
      worldY: object?.placement?.worldY
    });
  } catch {
    fail('AUTHORED_DIAGNOSTIC_UNAVAILABLE', 'The diagnostic inventory is malformed.');
  }
  const active = object.state === 'active';
  const timestampsValid = validDate(object.createdAt)
    && validDate(object.changedAt)
    && object.createdAt <= object.changedAt
    && object.createdAt <= exportStartedAt
    && (active
      ? object.removedAt === null && object.purgeEligibleAt === null
      : validDate(object.removedAt)
        && validDate(object.purgeEligibleAt)
        && object.changedAt.getTime() === object.removedAt.getTime()
        && object.purgeEligibleAt > object.removedAt);
  if (!UUID_V4_PATTERN.test(object.objectId || '')
    || object.ownerUserId !== ownerUserId
    || object.forestId !== forestId
    || !Number.isSafeInteger(object?.placement?.worldX)
    || !Number.isSafeInteger(object?.placement?.worldY)
    || Math.abs(object.placement.worldX) > FOREST_AUTHORED_COORDINATE_LIMIT
    || Math.abs(object.placement.worldY) > FOREST_AUTHORED_COORDINATE_LIMIT
    || object.placementIndex.cellX !== expectedIndex.cellX
    || object.placementIndex.cellY !== expectedIndex.cellY
    || !SHA256_BASE64URL_PATTERN.test(object.creationFingerprint?.digest || '')
    || !Number.isSafeInteger(object.recordRevision)
    || object.recordRevision < 1
    || !timestampsValid) {
    fail('AUTHORED_DIAGNOSTIC_UNAVAILABLE', 'The diagnostic inventory is malformed.');
  }
}

function diagnosticObject(object) {
  return {
    objectId: object.objectId,
    kind: object.kind,
    state: object.state,
    placement: {
      worldX: object.placement.worldX,
      worldY: object.placement.worldY
    },
    placementIndex: {
      version: object.placementIndex.version,
      cellX: object.placementIndex.cellX,
      cellY: object.placementIndex.cellY
    },
    worldVersionEvidence: { ...object.worldVersionEvidence },
    appearance: { ...object.appearance },
    creationFingerprint: { ...object.creationFingerprint },
    recordRevision: object.recordRevision,
    createdAt: object.createdAt,
    changedAt: object.changedAt,
    removedAt: object.removedAt,
    purgeEligibleAt: object.purgeEligibleAt
  };
}

function emptyExport(includeRemoved, exportStartedAt) {
  return {
    exportVersion: FOREST_AUTHORED_DIAGNOSTIC_EXPORT_VERSION,
    status: 'not-established',
    forestId: null,
    includeRemoved,
    exportStartedAt,
    objects: [],
    page: { inspectedObjectCount: 0, returnedObjectCount: 0, nextCursor: null }
  };
}

export function buildForestAuthoredDiagnosticExportService({
  ForestOwnerWorldModel = ForestOwnerWorld,
  ForestAuthoredObjectModel = ForestAuthoredObject,
  now = () => new Date()
} = {}) {
  return async function readForestAuthoredDiagnosticExport({
    ownerUserId: ownerValue,
    includeRemoved: includeRemovedValue,
    cursor = null,
    limit
  }) {
    const ownerUserId = canonicalOwner(ownerValue);
    const includeRemoved = exactIncludeRemoved(includeRemovedValue);
    const pageSize = resolveLimit(limit);
    const currentDate = currentTime(now);
    const decodedCursor = decodeCursor(cursor, { includeRemoved, currentDate });
    const world = await lean(ForestOwnerWorldModel.findOne({
      ownerUserId,
      worldRole: 'primary'
    }));
    const exportStartedAt = decodedCursor?.exportStartedAt || currentDate;
    if (!world) return emptyExport(includeRemoved, exportStartedAt);
    validateWorld(world, ownerUserId);
    if (decodedCursor?.forestFingerprint
      && decodedCursor.forestFingerprint !== compactFingerprint(world.forestId)) {
      fail('INVALID_AUTHORED_DIAGNOSTIC_INPUT', 'cursor is invalid for this owner forest.');
    }
    const query = ForestAuthoredObjectModel.find({
      ownerUserId,
      forestId: world.forestId,
      createdAt: { $lte: exportStartedAt },
      ...(decodedCursor ? { objectId: { $gt: decodedCursor.afterObjectId } } : {})
    }, OBJECT_PROJECTION).sort({ objectId: 1 }).limit(pageSize + 1);
    const rows = await lean(query);
    if (!Array.isArray(rows) || rows.length > pageSize + 1) {
      fail('AUTHORED_DIAGNOSTIC_UNAVAILABLE', 'The diagnostic read was not bounded.');
    }
    const pageRows = rows.slice(0, pageSize);
    for (const object of pageRows) {
      validateObject(object, {
        ownerUserId,
        forestId: world.forestId,
        exportStartedAt
      });
    }
    const objects = pageRows.filter(object => includeRemoved || object.state === 'active')
      .map(diagnosticObject);
    return {
      exportVersion: FOREST_AUTHORED_DIAGNOSTIC_EXPORT_VERSION,
      status: 'ready',
      forestId: world.forestId,
      includeRemoved,
      exportStartedAt,
      objects,
      page: {
        inspectedObjectCount: pageRows.length,
        returnedObjectCount: objects.length,
        nextCursor: rows.length > pageSize && pageRows.length
          ? encodeCursor({
            forestId: world.forestId,
            includeRemoved,
            exportStartedAt,
            afterObjectId: pageRows.at(-1).objectId
          }) : null
      }
    };
  };
}

export const readForestAuthoredDiagnosticExport =
  buildForestAuthoredDiagnosticExportService();

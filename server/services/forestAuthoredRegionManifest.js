import crypto from 'node:crypto';

import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../db/models/ForestAuthoredRegionRevision.js';
import ForestAuthoredResetOperation from '../db/models/ForestAuthoredResetOperation.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
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
import {
  FOREST_OWNER_WORLD_SCHEMA_VERSION
} from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION
} from './forestOwnerEnvironmentResolver.js';
import {
  FOREST_OWNER_GROVE_PLACEMENT_VERSION
} from './forestOwnerGrovePlacement.js';
import {
  deriveForestOwnerPlacementIndex,
  FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE,
  FOREST_OWNER_PLACEMENT_INDEX_VERSION
} from './forestOwnerPlacementNeighborhood.js';

export const FOREST_AUTHORED_REGION_MANIFEST_VERSION = 1;
export const FOREST_AUTHORED_REGION_CURSOR_VERSION = 1;
export const FOREST_AUTHORED_REGION_MAX_CELLS = 9;
export const FOREST_AUTHORED_REGION_DEFAULT_PAGE_SIZE = 100;
export const FOREST_AUTHORED_REGION_MAX_PAGE_SIZE = 250;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const COMPACT_FINGERPRINT_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const CURSOR_MAX_LENGTH = 256;
const MAXIMUM_CELL_MAGNITUDE = Math.ceil(
  FOREST_AUTHORED_COORDINATE_LIMIT / FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE
);
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
const REVISION_PROJECTION = Object.freeze({
  _id: 0,
  schemaVersion: 1,
  forestId: 1,
  ownerUserId: 1,
  spatialIndexVersion: 1,
  cellX: 1,
  cellY: 1,
  revision: 1
});

export class ForestAuthoredRegionManifestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestAuthoredRegionManifestError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestAuthoredRegionManifestError(code, message);
}

function canonicalOwner(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail(
      'INVALID_AUTHORED_REGION_INPUT',
      'ownerUserId must be a canonical ObjectId string.'
    );
  }
  return ownerUserId;
}

function exactCell(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_AUTHORED_REGION_INPUT', `cells[${index}] must be an exact cell object.`);
  }
  const fields = Object.keys(value);
  if (fields.length !== 2 || !fields.includes('cellX') || !fields.includes('cellY')) {
    fail('INVALID_AUTHORED_REGION_INPUT', `cells[${index}] contains unsupported fields.`);
  }
  for (const field of ['cellX', 'cellY']) {
    if (!Number.isSafeInteger(value[field])
      || Math.abs(value[field]) > MAXIMUM_CELL_MAGNITUDE) {
      fail(
        'INVALID_AUTHORED_REGION_INPUT',
        `cells[${index}].${field} is outside the supported signed cell range.`
      );
    }
  }
  return { cellX: value.cellX, cellY: value.cellY };
}

function canonicalCells(value) {
  if (!Array.isArray(value)
    || value.length < 1
    || value.length > FOREST_AUTHORED_REGION_MAX_CELLS) {
    fail(
      'INVALID_AUTHORED_REGION_INPUT',
      `cells must contain 1 through ${FOREST_AUTHORED_REGION_MAX_CELLS} exact cells.`
    );
  }
  const cells = value.map(exactCell).sort((left, right) => (
    left.cellY - right.cellY || left.cellX - right.cellX
  ));
  const keys = cells.map(cell => `${cell.cellX}:${cell.cellY}`);
  if (new Set(keys).size !== keys.length) {
    fail('INVALID_AUTHORED_REGION_INPUT', 'cells must not contain duplicates.');
  }
  return cells;
}

function resolveLimit(value) {
  if (value === undefined || value === null || value === '') {
    return FOREST_AUTHORED_REGION_DEFAULT_PAGE_SIZE;
  }
  const normalized = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)
    || normalized < 1
    || normalized > FOREST_AUTHORED_REGION_MAX_PAGE_SIZE) {
    fail(
      'INVALID_AUTHORED_REGION_INPUT',
      `limit must be an integer from 1 through ${FOREST_AUTHORED_REGION_MAX_PAGE_SIZE}.`
    );
  }
  return normalized;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('base64url').slice(0, 22);
}

function cellFingerprint(cells) {
  return fingerprint(cells.map(cell => `${cell.cellX}:${cell.cellY}`).join(','));
}

function revisionFingerprint(vector) {
  return fingerprint(vector.map(cell => (
    `${cell.cellX}:${cell.cellY}:${cell.revision}`
  )).join(','));
}

function encodeCursor(objectId, regionFingerprint, vectorFingerprint) {
  return Buffer.from(JSON.stringify({
    version: FOREST_AUTHORED_REGION_CURSOR_VERSION,
    regionFingerprint,
    revisionFingerprint: vectorFingerprint,
    afterObjectId: objectId
  })).toString('base64url');
}

function decodeCursor(value, expectedRegionFingerprint) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > CURSOR_MAX_LENGTH) {
    fail('INVALID_AUTHORED_REGION_INPUT', 'cursor must be a bounded opaque string.');
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const fields = decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? Object.keys(decoded) : [];
    if (fields.length !== 4
      || !fields.includes('version')
      || !fields.includes('regionFingerprint')
      || !fields.includes('revisionFingerprint')
      || !fields.includes('afterObjectId')
      || decoded.version !== FOREST_AUTHORED_REGION_CURSOR_VERSION
      || decoded.regionFingerprint !== expectedRegionFingerprint
      || !COMPACT_FINGERPRINT_PATTERN.test(decoded.revisionFingerprint || '')
      || !UUID_V4_PATTERN.test(decoded.afterObjectId || '')) {
      throw new Error('unsupported cursor');
    }
    return decoded;
  } catch {
    fail('INVALID_AUTHORED_REGION_INPUT', 'cursor is invalid for the requested region.');
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
      'AUTHORED_REGION_MIGRATION_REQUIRED',
      'The owner world has unsupported authored-region identity or versions.'
    );
  }
  if (world.status !== 'active') {
    fail('AUTHORED_REGION_UNAVAILABLE', 'The owner world is unavailable.');
  }
  if (!['idle', 'running'].includes(world.reconciliation?.state)) {
    fail('AUTHORED_REGION_UNAVAILABLE', 'The owner world reconciliation state is unsupported.');
  }
}

function emptyManifest(status, cells) {
  return {
    manifestVersion: FOREST_AUTHORED_REGION_MANIFEST_VERSION,
    status,
    spatialIndex: {
      version: FOREST_OWNER_PLACEMENT_INDEX_VERSION,
      cellSize: FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE
    },
    requestedRegions: cells.map(cell => ({
      id: `${cell.cellX}:${cell.cellY}`,
      ...cell,
      revision: null
    })),
    objects: [],
    page: { returnedObjectCount: 0, nextCursor: null }
  };
}

function cellFilter(cells) {
  return cells.map(cell => ({ cellX: cell.cellX, cellY: cell.cellY }));
}

async function readRevisionVector({
  ownerUserId,
  forestId,
  cells,
  ForestAuthoredRegionRevisionModel
}) {
  const query = ForestAuthoredRegionRevisionModel.find({
    ownerUserId,
    forestId,
    spatialIndexVersion: FOREST_OWNER_PLACEMENT_INDEX_VERSION,
    $or: cellFilter(cells)
  }, REVISION_PROJECTION).limit(cells.length + 1);
  const rows = await lean(query);
  if (!Array.isArray(rows) || rows.length > cells.length) {
    fail('AUTHORED_REGION_UNAVAILABLE', 'The authored revision read was not bounded.');
  }
  const revisions = new Map();
  const requestedKeys = new Set(cells.map(cell => `${cell.cellX}:${cell.cellY}`));
  for (const row of rows) {
    const key = `${row?.cellX}:${row?.cellY}`;
    if (row?.schemaVersion !== FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION
      || row?.ownerUserId !== ownerUserId
      || row?.forestId !== forestId
      || row?.spatialIndexVersion !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
      || !requestedKeys.has(key)
      || revisions.has(key)
      || !Number.isSafeInteger(row?.revision)
      || row.revision < 1) {
      fail(
        'AUTHORED_REGION_MIGRATION_REQUIRED',
        'The authored region contains unsupported revision evidence.'
      );
    }
    revisions.set(key, row.revision);
  }
  return cells.map(cell => ({
    ...cell,
    revision: revisions.get(`${cell.cellX}:${cell.cellY}`) || 0
  }));
}

function validateObject(object, world, ownerUserId, requestedKeys) {
  let expectedIndex;
  try {
    expectedIndex = deriveForestOwnerPlacementIndex({
      worldX: object?.placement?.worldX,
      worldY: object?.placement?.worldY
    });
  } catch {
    fail('AUTHORED_REGION_MIGRATION_REQUIRED', 'The authored region has invalid coordinates.');
  }
  const key = `${expectedIndex.cellX}:${expectedIndex.cellY}`;
  if (object?.schemaVersion !== FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    || object?.identityVersion !== FOREST_AUTHORED_OBJECT_IDENTITY_VERSION
    || !UUID_V4_PATTERN.test(object?.objectId || '')
    || object?.forestId !== world.forestId
    || object?.ownerUserId !== ownerUserId
    || object?.kind !== 'personal-marker'
    || object?.state !== 'active'
    || Math.abs(object?.placement?.worldX) > FOREST_AUTHORED_COORDINATE_LIMIT
    || Math.abs(object?.placement?.worldY) > FOREST_AUTHORED_COORDINATE_LIMIT
    || object?.placementIndex?.version !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
    || object?.placementIndex?.cellX !== expectedIndex.cellX
    || object?.placementIndex?.cellY !== expectedIndex.cellY
    || !requestedKeys.has(key)
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
    || !(object?.createdAt instanceof Date)
    || Number.isNaN(object.createdAt.getTime())
    || !(object?.changedAt instanceof Date)
    || Number.isNaN(object.changedAt.getTime())
    || object?.removedAt !== null
    || object?.purgeEligibleAt !== null) {
    fail(
      'AUTHORED_REGION_MIGRATION_REQUIRED',
      'The authored region contains an unsupported active object.'
    );
  }
  return expectedIndex;
}

function manifestObject(object, placementIndex) {
  return {
    objectId: object.objectId,
    kind: object.kind,
    regionId: `${placementIndex.cellX}:${placementIndex.cellY}`,
    worldX: object.placement.worldX,
    worldY: object.placement.worldY,
    appearance: {
      id: object.appearance.id,
      version: object.appearance.version
    },
    recordRevision: object.recordRevision,
    changedAt: object.changedAt
  };
}

async function resetState({ ownerUserId, forestId, ForestAuthoredResetOperationModel }) {
  const operation = await lean(ForestAuthoredResetOperationModel.findOne({
    ownerUserId,
    forestId,
    status: 'processing'
  }, {
    _id: 0,
    schemaVersion: 1,
    operationVersion: 1,
    ownerUserId: 1,
    forestId: 1,
    status: 1,
    authoredObjectSchemaVersion: 1,
    spatialIndexVersion: 1
  }));
  if (!operation) return false;
  if (operation.schemaVersion !== FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION
    || operation.operationVersion !== FOREST_AUTHORED_RESET_OPERATION_VERSION
    || operation.ownerUserId !== ownerUserId
    || operation.forestId !== forestId
    || operation.status !== 'processing'
    || operation.authoredObjectSchemaVersion !== FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    || operation.spatialIndexVersion !== FOREST_OWNER_PLACEMENT_INDEX_VERSION) {
    fail(
      'AUTHORED_REGION_MIGRATION_REQUIRED',
      'The authored reset operation uses unsupported versions.'
    );
  }
  return true;
}

export function buildForestAuthoredRegionManifestService({
  ForestOwnerWorldModel = ForestOwnerWorld,
  ForestAuthoredObjectModel = ForestAuthoredObject,
  ForestAuthoredRegionRevisionModel = ForestAuthoredRegionRevision,
  ForestAuthoredResetOperationModel = ForestAuthoredResetOperation
} = {}) {
  return async function readForestAuthoredRegionManifest({
    ownerUserId: ownerValue,
    cells: cellValue,
    cursor = null,
    limit
  }) {
    const ownerUserId = canonicalOwner(ownerValue);
    const cells = canonicalCells(cellValue);
    const pageSize = resolveLimit(limit);
    const requestedFingerprint = cellFingerprint(cells);
    const decodedCursor = decodeCursor(cursor, requestedFingerprint);
    const world = await lean(ForestOwnerWorldModel.findOne({
      ownerUserId,
      worldRole: 'primary'
    }));
    if (!world) return emptyManifest('not-established', cells);
    validateWorld(world, ownerUserId);
    if (world.reconciliation.state === 'running') {
      return emptyManifest('reconciling', cells);
    }
    if (await resetState({
      ownerUserId,
      forestId: world.forestId,
      ForestAuthoredResetOperationModel
    })) return emptyManifest('resetting', cells);

    const initialVector = await readRevisionVector({
      ownerUserId,
      forestId: world.forestId,
      cells,
      ForestAuthoredRegionRevisionModel
    });
    const initialFingerprint = revisionFingerprint(initialVector);
    if (decodedCursor?.revisionFingerprint !== undefined
      && decodedCursor.revisionFingerprint !== initialFingerprint) {
      fail('AUTHORED_REGION_CHANGED', 'The authored region changed during pagination.');
    }
    const requestedKeys = new Set(cells.map(cell => `${cell.cellX}:${cell.cellY}`));
    const objectCellFilter = cells.map(cell => ({
      'placementIndex.cellX': cell.cellX,
      'placementIndex.cellY': cell.cellY
    }));
    const unsupportedSpatialObject = await lean(ForestAuthoredObjectModel.findOne({
      ownerUserId,
      forestId: world.forestId,
      state: 'active',
      'placementIndex.version': { $ne: FOREST_OWNER_PLACEMENT_INDEX_VERSION },
      $or: objectCellFilter
    }, { _id: 1 }));
    if (unsupportedSpatialObject) {
      fail(
        'AUTHORED_REGION_MIGRATION_REQUIRED',
        'The authored region contains an unsupported spatial-index version.'
      );
    }
    const objectQuery = ForestAuthoredObjectModel.find({
      ownerUserId,
      forestId: world.forestId,
      state: 'active',
      'placementIndex.version': FOREST_OWNER_PLACEMENT_INDEX_VERSION,
      $or: objectCellFilter,
      ...(decodedCursor ? { objectId: { $gt: decodedCursor.afterObjectId } } : {})
    }, OBJECT_PROJECTION).sort({ objectId: 1 }).limit(pageSize + 1);
    const rows = await lean(objectQuery);
    if (!Array.isArray(rows) || rows.length > pageSize + 1) {
      fail('AUTHORED_REGION_UNAVAILABLE', 'The authored object read was not bounded.');
    }
    const pageRows = rows.slice(0, pageSize);
    const revisionsByKey = new Map(initialVector.map(cell => (
      [`${cell.cellX}:${cell.cellY}`, cell.revision]
    )));
    const objects = pageRows.map((object) => {
      const placementIndex = validateObject(object, world, ownerUserId, requestedKeys);
      if (!revisionsByKey.get(`${placementIndex.cellX}:${placementIndex.cellY}`)) {
        fail(
          'AUTHORED_REGION_MIGRATION_REQUIRED',
          'An active authored object is missing regional revision evidence.'
        );
      }
      return manifestObject(object, placementIndex);
    });
    const finalVector = await readRevisionVector({
      ownerUserId,
      forestId: world.forestId,
      cells,
      ForestAuthoredRegionRevisionModel
    });
    if (revisionFingerprint(finalVector) !== initialFingerprint) {
      fail('AUTHORED_REGION_CHANGED', 'The authored region changed during pagination.');
    }
    if (await resetState({
      ownerUserId,
      forestId: world.forestId,
      ForestAuthoredResetOperationModel
    })) return emptyManifest('resetting', cells);

    return {
      manifestVersion: FOREST_AUTHORED_REGION_MANIFEST_VERSION,
      status: 'ready',
      spatialIndex: {
        version: FOREST_OWNER_PLACEMENT_INDEX_VERSION,
        cellSize: FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE
      },
      requestedRegions: initialVector.map(cell => ({
        id: `${cell.cellX}:${cell.cellY}`,
        ...cell
      })),
      objects,
      page: {
        returnedObjectCount: objects.length,
        nextCursor: rows.length > pageSize && pageRows.length
          ? encodeCursor(
            pageRows.at(-1).objectId,
            requestedFingerprint,
            initialFingerprint
          ) : null
      }
    };
  };
}

export const readForestAuthoredRegionManifest = buildForestAuthoredRegionManifestService();

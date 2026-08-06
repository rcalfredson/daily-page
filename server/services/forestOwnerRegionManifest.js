import crypto from 'node:crypto';

import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  FOREST_OWNER_WORLD_SCHEMA_VERSION
} from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_WRITING_TREE_CREATION_SEASONS,
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION
} from '../db/schemas/ForestWritingTreeSchema.js';
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
import {
  FOREST_POST_TREE_MAPPING_VERSION,
  FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
} from './forestPostTreeProjection.js';
import { FOREST_RENDERER_VERSION_V3 } from './forestTreeGeneratorV3.js';
import { FOREST_WRITING_TREE_PROJECTION_REVISION } from './forestWritingTreeCreation.js';
import {
  FOREST_PHENOTYPE_SCENE_TRAITS,
  resolveForestPhenotype
} from './forest/v3/phenotype.js';
import {
  FOREST_RENDERER_ID,
  FOREST_TREE_ASSET_SCHEMA_VERSION,
  treeAssetCacheKey
} from './forest/v3/treeAsset.js';

export const FOREST_OWNER_REGION_MANIFEST_VERSION = 1;
export const FOREST_OWNER_REGION_CURSOR_VERSION = 1;
export const FOREST_OWNER_REGION_MAX_CELLS = 9;
export const FOREST_OWNER_REGION_DEFAULT_PAGE_SIZE = 100;
export const FOREST_OWNER_REGION_MAX_PAGE_SIZE = 250;
export const FOREST_OWNER_REGION_TREE_SCALE = 1;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CURSOR_MAX_LENGTH = 256;
const MAXIMUM_CELL_MAGNITUDE = Math.ceil(
  1_000_000_000 / FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE
);
const TREE_PROJECTION = Object.freeze({
  _id: 0,
  schemaVersion: 1,
  identityVersion: 1,
  writingTreeId: 1,
  forestId: 1,
  ownerUserId: 1,
  sourceState: 1,
  hiddenFromForest: 1,
  placement: 1,
  placementIndex: 1,
  originatingEnvironment: 1,
  projection: 1
});

export class ForestOwnerRegionManifestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerRegionManifestError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerRegionManifestError(code, message);
}

function canonicalOwner(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail('INVALID_OWNER_REGION_INPUT', 'ownerUserId must be a canonical ObjectId string.');
  }
  return ownerUserId;
}

function exactCell(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_OWNER_REGION_INPUT', `cells[${index}] must be an exact cell object.`);
  }
  const fields = Object.keys(value);
  if (fields.length !== 2 || !fields.includes('cellX') || !fields.includes('cellY')) {
    fail('INVALID_OWNER_REGION_INPUT', `cells[${index}] contains unsupported fields.`);
  }
  for (const field of ['cellX', 'cellY']) {
    if (!Number.isSafeInteger(value[field])
      || Math.abs(value[field]) > MAXIMUM_CELL_MAGNITUDE) {
      fail(
        'INVALID_OWNER_REGION_INPUT',
        `cells[${index}].${field} is outside the supported signed cell range.`
      );
    }
  }
  return { cellX: value.cellX, cellY: value.cellY };
}

function canonicalCells(value) {
  if (!Array.isArray(value)
    || value.length < 1
    || value.length > FOREST_OWNER_REGION_MAX_CELLS) {
    fail(
      'INVALID_OWNER_REGION_INPUT',
      `cells must contain 1 through ${FOREST_OWNER_REGION_MAX_CELLS} exact cells.`
    );
  }
  const cells = value.map(exactCell).sort((left, right) => (
    left.cellY - right.cellY || left.cellX - right.cellX
  ));
  const keys = cells.map(cell => `${cell.cellX}:${cell.cellY}`);
  if (new Set(keys).size !== keys.length) {
    fail('INVALID_OWNER_REGION_INPUT', 'cells must not contain duplicates.');
  }
  return cells;
}

function resolveLimit(value) {
  if (value === undefined || value === null || value === '') {
    return FOREST_OWNER_REGION_DEFAULT_PAGE_SIZE;
  }
  const normalized = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  if (!Number.isSafeInteger(normalized)
    || normalized < 1
    || normalized > FOREST_OWNER_REGION_MAX_PAGE_SIZE) {
    fail(
      'INVALID_OWNER_REGION_INPUT',
      `limit must be an integer from 1 through ${FOREST_OWNER_REGION_MAX_PAGE_SIZE}.`
    );
  }
  return normalized;
}

function regionFingerprint(cells) {
  return crypto.createHash('sha256')
    .update(cells.map(cell => `${cell.cellX}:${cell.cellY}`).join(','))
    .digest('base64url')
    .slice(0, 22);
}

function encodeCursor(writingTreeId, fingerprint) {
  return Buffer.from(JSON.stringify({
    version: FOREST_OWNER_REGION_CURSOR_VERSION,
    regionFingerprint: fingerprint,
    afterWritingTreeId: writingTreeId
  })).toString('base64url');
}

function decodeCursor(value, fingerprint) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > CURSOR_MAX_LENGTH) {
    fail('INVALID_OWNER_REGION_INPUT', 'cursor must be a bounded opaque string.');
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const fields = decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? Object.keys(decoded)
      : [];
    if (fields.length !== 3
      || !fields.includes('version')
      || !fields.includes('regionFingerprint')
      || !fields.includes('afterWritingTreeId')
      || decoded.version !== FOREST_OWNER_REGION_CURSOR_VERSION
      || decoded.regionFingerprint !== fingerprint
      || !UUID_V4_PATTERN.test(decoded.afterWritingTreeId || '')) {
      throw new Error('unsupported cursor');
    }
    return decoded.afterWritingTreeId;
  } catch {
    fail('INVALID_OWNER_REGION_INPUT', 'cursor is invalid for the requested region.');
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
    fail('OWNER_REGION_UNAVAILABLE', 'The owner world has unsupported identity or versions.');
  }
  if (world.status !== 'active') {
    fail('OWNER_REGION_UNAVAILABLE', 'The owner world is unavailable.');
  }
  if (!['idle', 'running'].includes(world.reconciliation?.state)) {
    fail('OWNER_REGION_UNAVAILABLE', 'The owner world has unsupported reconciliation state.');
  }
}

function validateTree(tree, world, ownerUserId, requestedCellKeys) {
  if (!Number.isSafeInteger(tree?.placement?.worldX)
    || !Number.isSafeInteger(tree?.placement?.worldY)) {
    fail('OWNER_REGION_UNAVAILABLE', 'The owner region contains unsupported coordinates.');
  }
  const expectedIndex = deriveForestOwnerPlacementIndex({
    worldX: tree?.placement?.worldX,
    worldY: tree?.placement?.worldY
  });
  const cellKey = `${expectedIndex.cellX}:${expectedIndex.cellY}`;
  const phenotype = resolveForestPhenotype(tree?.projection?.phenotypeId);
  const creationSeason = tree?.projection?.creationSeason;
  const paletteId = tree?.projection?.foliagePaletteId;
  const expectedPaletteId = creationSeason === 'unknown'
    ? null
    : phenotype?.postTreeMeaning?.creationSeasonPaletteIds?.[creationSeason];
  const expectedVisualFingerprint = [
    `mapping-v${FOREST_POST_TREE_MAPPING_VERSION}`,
    paletteId ? `foliage-${paletteId}` : 'foliage-seed-selected'
  ].join(':');
  if (tree?.schemaVersion !== FOREST_WRITING_TREE_SCHEMA_VERSION
    || tree?.identityVersion !== FOREST_WRITING_TREE_IDENTITY_VERSION
    || !UUID_V4_PATTERN.test(tree?.writingTreeId || '')
    || tree?.forestId !== world.forestId
    || tree?.ownerUserId !== ownerUserId
    || tree?.sourceState !== 'active'
    || tree?.hiddenFromForest !== false
    || tree?.placement?.policyVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || tree?.placementIndex?.version !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
    || tree?.placementIndex?.cellX !== expectedIndex.cellX
    || tree?.placementIndex?.cellY !== expectedIndex.cellY
    || !requestedCellKeys.has(cellKey)
    || tree?.originatingEnvironment?.policyVersion
      !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || tree?.originatingEnvironment?.schemaVersion
      !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || tree?.originatingEnvironment?.worldGenerationVersion
      !== FOREST_OWNER_WORLD_GENERATION_VERSION
    || tree?.projection?.revision !== FOREST_WRITING_TREE_PROJECTION_REVISION
    || tree?.projection?.schemaVersion !== FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
    || tree?.projection?.mappingVersion !== FOREST_POST_TREE_MAPPING_VERSION
    || !Number.isSafeInteger(tree?.projection?.specimenSeed)
    || tree.projection.specimenSeed < 0
    || tree.projection.specimenSeed > 0xFFFFFFFF
    || !phenotype
    || phenotype.assetVersion !== tree?.projection?.phenotypeAssetVersion
    || !FOREST_WRITING_TREE_CREATION_SEASONS.includes(creationSeason)
    || paletteId !== expectedPaletteId
    || tree?.projection?.visualFingerprint !== expectedVisualFingerprint) {
    fail('OWNER_REGION_UNAVAILABLE', 'The owner region contains an unsupported tree record.');
  }
  const collisionRadius = FOREST_PHENOTYPE_SCENE_TRAITS[phenotype.id]?.collisionRadius;
  if (!Number.isSafeInteger(collisionRadius) || collisionRadius < 1) {
    fail('OWNER_REGION_UNAVAILABLE', 'The owner region contains unsupported collision identity.');
  }
  return { expectedIndex, phenotype, collisionRadius };
}

function placementManifest(tree, validation) {
  const assetKey = treeAssetCacheKey({
    seed: tree.projection.specimenSeed,
    rendererVersion: FOREST_RENDERER_VERSION_V3,
    phenotypeId: validation.phenotype.id,
    phenotypeAssetVersion: validation.phenotype.assetVersion,
    meaningProjection: {
      version: tree.projection.mappingVersion,
      visualFingerprint: tree.projection.visualFingerprint
    }
  });
  return {
    id: tree.writingTreeId,
    regionId: `${validation.expectedIndex.cellX}:${validation.expectedIndex.cellY}`,
    worldX: tree.placement.worldX,
    worldY: tree.placement.worldY,
    scale: FOREST_OWNER_REGION_TREE_SCALE,
    collisionRadius: validation.collisionRadius * FOREST_OWNER_REGION_TREE_SCALE,
    phenotypeId: validation.phenotype.id,
    assetKey
  };
}

function emptyManifest(status, cells) {
  return {
    manifestVersion: FOREST_OWNER_REGION_MANIFEST_VERSION,
    status,
    spatialIndex: {
      version: FOREST_OWNER_PLACEMENT_INDEX_VERSION,
      cellSize: FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE
    },
    requestedRegions: cells.map(cell => ({
      id: `${cell.cellX}:${cell.cellY}`,
      ...cell
    })),
    placements: [],
    page: { returnedPlacementCount: 0, nextCursor: null }
  };
}

export function buildForestOwnerRegionManifestService({
  ForestOwnerWorldModel = ForestOwnerWorld,
  ForestWritingTreeModel = ForestWritingTree
} = {}) {
  return async function readForestOwnerRegionManifest({
    ownerUserId: ownerValue,
    cells: cellValue,
    cursor = null,
    limit
  }) {
    const ownerUserId = canonicalOwner(ownerValue);
    const cells = canonicalCells(cellValue);
    const pageSize = resolveLimit(limit);
    const fingerprint = regionFingerprint(cells);
    const afterWritingTreeId = decodeCursor(cursor, fingerprint);
    const world = await lean(ForestOwnerWorldModel.findOne({
      ownerUserId,
      worldRole: 'primary'
    }));
    if (!world) return emptyManifest('not-established', cells);
    validateWorld(world, ownerUserId);
    if (world.reconciliation.state === 'running') {
      return emptyManifest('reconciling', cells);
    }

    const cellFilter = cells.map(cell => ({
      'placementIndex.cellX': cell.cellX,
      'placementIndex.cellY': cell.cellY
    }));
    const query = ForestWritingTreeModel.find({
      ownerUserId,
      forestId: world.forestId,
      sourceState: 'active',
      hiddenFromForest: false,
      'placementIndex.version': FOREST_OWNER_PLACEMENT_INDEX_VERSION,
      $or: cellFilter,
      ...(afterWritingTreeId ? { writingTreeId: { $gt: afterWritingTreeId } } : {})
    }, TREE_PROJECTION).sort({ writingTreeId: 1 }).limit(pageSize + 1);
    const rows = await lean(query);
    if (!Array.isArray(rows) || rows.length > pageSize + 1) {
      fail('OWNER_REGION_UNAVAILABLE', 'The owner region read was not bounded.');
    }
    const pageRows = rows.slice(0, pageSize);
    const requestedCellKeys = new Set(cells.map(cell => `${cell.cellX}:${cell.cellY}`));
    const placements = pageRows.map(tree => placementManifest(
      tree,
      validateTree(tree, world, ownerUserId, requestedCellKeys)
    ));

    return {
      ...emptyManifest('ready', cells),
      assetContract: {
        schemaVersion: FOREST_TREE_ASSET_SCHEMA_VERSION,
        rendererId: FOREST_RENDERER_ID,
        rendererVersion: FOREST_RENDERER_VERSION_V3
      },
      placements,
      page: {
        returnedPlacementCount: placements.length,
        nextCursor: rows.length > pageSize && pageRows.length
          ? encodeCursor(pageRows.at(-1).writingTreeId, fingerprint)
          : null
      }
    };
  };
}

export const readForestOwnerRegionManifest = buildForestOwnerRegionManifestService();

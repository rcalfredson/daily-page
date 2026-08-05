import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  FOREST_WRITING_TREE_SCHEMA_VERSION,
} from '../db/schemas/ForestWritingTreeSchema.js';
import {
  FOREST_OWNER_GROVE_PLACEMENT_CONFIG,
  FOREST_OWNER_GROVE_PLACEMENT_VERSION,
  inspectForestOwnerGrovePlacementCandidate,
} from './forestOwnerGrovePlacement.js';

export const FOREST_OWNER_PLACEMENT_INDEX_VERSION = 1;
export const FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE = 720;
export const FOREST_OWNER_PLACEMENT_NEIGHBORHOOD_LIMIT =
  FOREST_OWNER_GROVE_PLACEMENT_CONFIG.maximumOccupiedPlacements;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const MAXIMUM_MEMBER_OFFSET = FOREST_OWNER_GROVE_PLACEMENT_CONFIG
  .microGroveHaloRadius.maximum;

export class ForestOwnerPlacementNeighborhoodError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerPlacementNeighborhoodError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerPlacementNeighborhoodError(code, message);
}

function validateOwnerUserId(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail(
      'INVALID_PLACEMENT_NEIGHBORHOOD_INPUT',
      'ownerUserId must be a canonical ObjectId string',
    );
  }
  return ownerUserId;
}

function validateWorldSeed(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 80) {
    fail(
      'INVALID_PLACEMENT_NEIGHBORHOOD_INPUT',
      'worldSeed must be a non-empty string of at most 80 characters',
    );
  }
  return value;
}

function validatePlacementSlot(value) {
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > FOREST_OWNER_GROVE_PLACEMENT_CONFIG.maximumPlacementSlot
  ) {
    fail(
      'INVALID_PLACEMENT_NEIGHBORHOOD_INPUT',
      'placementSlot is outside the supported candidate stream',
    );
  }
  return value;
}

function validateCoordinate(value, fieldName) {
  if (!Number.isSafeInteger(value)) {
    fail(
      'INVALID_PLACEMENT_NEIGHBORHOOD_INPUT',
      `${fieldName} must be a signed safe integer`,
    );
  }
  return value;
}

function validateLimit(value) {
  if (
    !Number.isSafeInteger(value)
    || value < 1
    || value > FOREST_OWNER_PLACEMENT_NEIGHBORHOOD_LIMIT
  ) {
    fail(
      'INVALID_PLACEMENT_NEIGHBORHOOD_INPUT',
      `maximumPlacements must be an integer from 1 through ${FOREST_OWNER_PLACEMENT_NEIGHBORHOOD_LIMIT}`,
    );
  }
  return value;
}

export function deriveForestOwnerPlacementIndex({
  worldX,
  worldY,
  version = FOREST_OWNER_PLACEMENT_INDEX_VERSION,
}) {
  const x = validateCoordinate(worldX, 'worldX');
  const y = validateCoordinate(worldY, 'worldY');
  if (version !== FOREST_OWNER_PLACEMENT_INDEX_VERSION) {
    fail(
      'UNSUPPORTED_PLACEMENT_INDEX_VERSION',
      `placement index version ${version} is not supported`,
    );
  }

  return Object.freeze({
    version,
    cellX: Math.floor(x / FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE),
    cellY: Math.floor(y / FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE),
  });
}

function neighborhoodDescription(worldSeed, placementSlot) {
  const candidate = inspectForestOwnerGrovePlacementCandidate({
    worldSeed,
    placementSlot,
  });
  const microGrove = Boolean(candidate.microGroveNodeKey);
  const focus = microGrove ? candidate.microGroveAnchor : {
    worldX: candidate.worldX,
    worldY: candidate.worldY,
  };
  const conflictRadius = microGrove
    ? FOREST_OWNER_GROVE_PLACEMENT_CONFIG.minimumMicroGroveAnchorSpacing
      + MAXIMUM_MEMBER_OFFSET
    : Math.max(
      FOREST_OWNER_GROVE_PLACEMENT_CONFIG.minimumTreeSpacing,
      FOREST_OWNER_GROVE_PLACEMENT_CONFIG.microGroveOpeningRadius
        + MAXIMUM_MEMBER_OFFSET,
    );
  const focusIndex = deriveForestOwnerPlacementIndex(focus);
  const cellRadius = Math.ceil(
    conflictRadius / FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE,
  );
  const cellXs = [];
  const cellYs = [];
  for (let offset = -cellRadius; offset <= cellRadius; offset += 1) {
    cellXs.push(focusIndex.cellX + offset);
    cellYs.push(focusIndex.cellY + offset);
  }

  return {
    candidate,
    focus,
    conflictRadius,
    cellXs,
    cellYs,
  };
}

function validateStoredPlacement(record) {
  if (
    record?.schemaVersion !== FOREST_WRITING_TREE_SCHEMA_VERSION
    || record?.placement?.policyVersion
      !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || record?.placementIndex?.version
      !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
  ) {
    fail(
      'UNSUPPORTED_PLACEMENT_NEIGHBOR_RECORD',
      'placement neighborhood contains an unsupported tree record',
    );
  }
  const placement = {
    placementSlot: record.placement.slot,
    worldX: record.placement.worldX,
    worldY: record.placement.worldY,
  };
  if (
    !Number.isSafeInteger(placement.placementSlot)
    || placement.placementSlot < 0
  ) {
    fail(
      'MALFORMED_PLACEMENT_NEIGHBOR_RECORD',
      'placement neighborhood contains an invalid placement slot',
    );
  }
  validateCoordinate(placement.worldX, 'stored placement worldX');
  validateCoordinate(placement.worldY, 'stored placement worldY');
  const expectedIndex = deriveForestOwnerPlacementIndex(placement);
  if (
    record.placementIndex.cellX !== expectedIndex.cellX
    || record.placementIndex.cellY !== expectedIndex.cellY
  ) {
    fail(
      'MALFORMED_PLACEMENT_NEIGHBOR_RECORD',
      'placement neighborhood contains a stale spatial index',
    );
  }

  return Object.freeze(placement);
}

export async function readForestOwnerPlacementNeighborhood({
  ownerUserId,
  worldSeed,
  placementSlot,
  maximumPlacements = FOREST_OWNER_PLACEMENT_NEIGHBORHOOD_LIMIT,
  session = null,
  ForestWritingTreeModel = ForestWritingTree,
}) {
  const owner = validateOwnerUserId(ownerUserId);
  const seed = validateWorldSeed(worldSeed);
  const slot = validatePlacementSlot(placementSlot);
  const limit = validateLimit(maximumPlacements);
  if (!ForestWritingTreeModel?.find) {
    fail(
      'INVALID_PLACEMENT_NEIGHBORHOOD_DEPENDENCY',
      'ForestWritingTreeModel.find must be available',
    );
  }
  const description = neighborhoodDescription(seed, slot);
  let query = ForestWritingTreeModel.find(
    {
      ownerUserId: owner,
      'placementIndex.cellX': { $in: description.cellXs },
      'placementIndex.cellY': { $in: description.cellYs },
    },
    {
      _id: 0,
      schemaVersion: 1,
      writingTreeId: 1,
      placement: 1,
      placementIndex: 1,
    },
  ).sort({ writingTreeId: 1 }).limit(limit + 1);
  if (session !== null) {
    if (typeof query?.session !== 'function') {
      fail(
        'INVALID_PLACEMENT_NEIGHBORHOOD_DEPENDENCY',
        'ForestWritingTree query must support transaction sessions',
      );
    }
    query = query.session(session);
  }
  const records = await query.lean();
  if (!Array.isArray(records)) {
    fail(
      'INVALID_PLACEMENT_NEIGHBORHOOD_DEPENDENCY',
      'ForestWritingTreeModel.find must resolve to an array',
    );
  }
  if (records.length > limit) {
    fail(
      'PLACEMENT_NEIGHBORHOOD_LIMIT_EXCEEDED',
      'placement neighborhood exceeds the safe per-candidate bound',
    );
  }
  const occupiedPlacements = records.map(validateStoredPlacement);

  return Object.freeze({
    indexVersion: FOREST_OWNER_PLACEMENT_INDEX_VERSION,
    cellSize: FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE,
    placementSlot: description.candidate.placementSlot,
    candidateClass: description.candidate.candidateClass,
    focus: Object.freeze({ ...description.focus }),
    conflictRadius: description.conflictRadius,
    queriedCellCount:
      description.cellXs.length * description.cellYs.length,
    occupiedPlacements: Object.freeze(occupiedPlacements),
  });
}

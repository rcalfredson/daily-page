import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  FOREST_AUTHORED_MARKER_APPEARANCE_ID,
  FOREST_AUTHORED_MARKER_APPEARANCE_VERSION,
  FOREST_AUTHORED_OBJECT_IDENTITY_VERSION,
  FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
} from '../db/schemas/ForestAuthoredObjectSchema.js';
import {
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION
} from '../db/schemas/ForestWritingTreeSchema.js';
import {
  FOREST_OWNER_WORLD_SCHEMA_VERSION
} from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION,
  resolveForestOwnerEnvironment
} from './forestOwnerEnvironmentResolver.js';
import {
  FOREST_OWNER_GROVE_PLACEMENT_VERSION
} from './forestOwnerGrovePlacement.js';
import {
  deriveForestOwnerPlacementIndex,
  FOREST_OWNER_PLACEMENT_INDEX_VERSION
} from './forestOwnerPlacementNeighborhood.js';
import {
  FOREST_POST_TREE_MAPPING_VERSION,
  FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
} from './forestPostTreeProjection.js';
import {
  FOREST_WRITING_TREE_PROJECTION_REVISION
} from './forestWritingTreeCreation.js';
import {
  FOREST_PHENOTYPE_SCENE_TRAITS,
  resolveForestPhenotype
} from './forest/v3/phenotype.js';

export const FOREST_AUTHORED_MARKER_RADIUS = 9;
export const FOREST_AUTHORED_PLACEMENT_GAP = 8;
export const FOREST_AUTHORED_MARKER_MINIMUM_SPACING = 26;
export const FOREST_AUTHORED_ACTIVE_CELL_LIMIT = 128;
export const FOREST_AUTHORED_COLLISION_CELL_RADIUS = 1;
export const FOREST_AUTHORED_MARKER_NEIGHBORHOOD_LIMIT =
  FOREST_AUTHORED_ACTIVE_CELL_LIMIT * 9;
export const FOREST_AUTHORED_WRITING_TREE_NEIGHBORHOOD_LIMIT = 10_000;

const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

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
const MARKER_PROJECTION = Object.freeze({
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
  changedAt: 1,
  removedAt: 1,
  purgeEligibleAt: 1
});

export class ForestAuthoredPlacementError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestAuthoredPlacementError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestAuthoredPlacementError(code, message);
}

function queryCells(center) {
  const cellXs = [];
  const cellYs = [];
  for (
    let offset = -FOREST_AUTHORED_COLLISION_CELL_RADIUS;
    offset <= FOREST_AUTHORED_COLLISION_CELL_RADIUS;
    offset += 1
  ) {
    cellXs.push(center.cellX + offset);
    cellYs.push(center.cellY + offset);
  }
  return { cellXs, cellYs };
}

function squaredDistance(left, right) {
  return ((left.worldX - right.worldX) ** 2)
    + ((left.worldY - right.worldY) ** 2);
}

function storedPlacementIndex(record, recordType) {
  try {
    return deriveForestOwnerPlacementIndex({
      worldX: record?.placement?.worldX,
      worldY: record?.placement?.worldY
    });
  } catch {
    fail(
      'AUTHORED_PLACEMENT_UNAVAILABLE',
      `The placement neighborhood contains malformed ${recordType} coordinates.`
    );
  }
}

function validateEnvironment(environment, world) {
  if (
    environment?.policyVersion !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || environment?.schemaVersion !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || environment?.worldGenerationVersion !== FOREST_OWNER_WORLD_GENERATION_VERSION
    || environment.policyVersion !== world.environmentPolicyVersion
    || environment.schemaVersion !== world.environmentSchemaVersion
    || environment.worldGenerationVersion !== world.worldGenerationVersion
    || typeof environment?.originatingEnvironment?.regionId !== 'string'
    || typeof environment?.originatingEnvironment?.groundSurfaceId !== 'string'
  ) {
    fail(
      'AUTHORED_PLACEMENT_UNAVAILABLE',
      'The owner environment could not represent the requested placement.'
    );
  }
}

function validateTree(tree, { ownerUserId, forestId }) {
  const expectedIndex = storedPlacementIndex(tree, 'writing-tree');
  const phenotype = resolveForestPhenotype(tree?.projection?.phenotypeId);
  const collisionRadius = FOREST_PHENOTYPE_SCENE_TRAITS[phenotype?.id]?.collisionRadius;
  if (
    tree?.schemaVersion !== FOREST_WRITING_TREE_SCHEMA_VERSION
    || tree?.identityVersion !== FOREST_WRITING_TREE_IDENTITY_VERSION
    || !UUID_V4_PATTERN.test(tree?.writingTreeId || '')
    || tree?.ownerUserId !== ownerUserId
    || tree?.forestId !== forestId
    || tree?.placement?.policyVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || !['active', 'inactive'].includes(tree?.sourceState)
    || typeof tree?.hiddenFromForest !== 'boolean'
    || tree?.placementIndex?.version !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
    || tree?.placementIndex?.cellX !== expectedIndex.cellX
    || tree?.placementIndex?.cellY !== expectedIndex.cellY
    || tree?.originatingEnvironment?.policyVersion
      !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || tree?.originatingEnvironment?.schemaVersion
      !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || tree?.originatingEnvironment?.worldGenerationVersion
      !== FOREST_OWNER_WORLD_GENERATION_VERSION
    || !phenotype
    || tree?.projection?.revision !== FOREST_WRITING_TREE_PROJECTION_REVISION
    || tree?.projection?.schemaVersion !== FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
    || tree?.projection?.mappingVersion !== FOREST_POST_TREE_MAPPING_VERSION
    || phenotype.assetVersion !== tree?.projection?.phenotypeAssetVersion
    || !Number.isSafeInteger(collisionRadius)
    || collisionRadius < 1
  ) {
    fail(
      'AUTHORED_PLACEMENT_UNAVAILABLE',
      'The placement neighborhood contains unsupported writing-tree evidence.'
    );
  }
  return collisionRadius;
}

function validateMarker(marker, { ownerUserId, forestId }) {
  const expectedIndex = storedPlacementIndex(marker, 'authored-object');
  if (
    marker?.schemaVersion !== FOREST_AUTHORED_OBJECT_SCHEMA_VERSION
    || marker?.identityVersion !== FOREST_AUTHORED_OBJECT_IDENTITY_VERSION
    || !UUID_V4_PATTERN.test(marker?.objectId || '')
    || marker?.ownerUserId !== ownerUserId
    || marker?.forestId !== forestId
    || marker?.kind !== 'personal-marker'
    || marker?.state !== 'active'
    || marker?.placementIndex?.version !== FOREST_OWNER_PLACEMENT_INDEX_VERSION
    || marker?.placementIndex?.cellX !== expectedIndex.cellX
    || marker?.placementIndex?.cellY !== expectedIndex.cellY
    || marker?.worldVersionEvidence?.ownerWorldSchemaVersion
      !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || marker?.worldVersionEvidence?.placementPolicyVersion
      !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || marker?.worldVersionEvidence?.environmentPolicyVersion
      !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || marker?.worldVersionEvidence?.environmentSchemaVersion
      !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || marker?.worldVersionEvidence?.worldGenerationVersion
      !== FOREST_OWNER_WORLD_GENERATION_VERSION
    || marker?.appearance?.id !== FOREST_AUTHORED_MARKER_APPEARANCE_ID
    || marker?.appearance?.version !== FOREST_AUTHORED_MARKER_APPEARANCE_VERSION
    || marker?.creationFingerprint?.version !== 1
    || !SHA256_BASE64URL_PATTERN.test(marker?.creationFingerprint?.digest || '')
    || !Number.isSafeInteger(marker?.recordRevision)
    || marker.recordRevision < 1
    || !(marker?.changedAt instanceof Date)
    || marker?.removedAt !== null
    || marker?.purgeEligibleAt !== null
  ) {
    fail(
      'AUTHORED_PLACEMENT_UNAVAILABLE',
      'The placement neighborhood contains unsupported authored-object evidence.'
    );
  }
  return expectedIndex;
}

async function readBounded(query, { session, limit, dependencyName, sort }) {
  let bounded = query.sort(sort).limit(limit + 1);
  if (typeof bounded?.session !== 'function') {
    fail(
      'INVALID_AUTHORED_PLACEMENT_DEPENDENCY',
      `${dependencyName} must support transaction sessions.`
    );
  }
  bounded = bounded.session(session);
  const records = await bounded.lean();
  if (!Array.isArray(records)) {
    fail(
      'INVALID_AUTHORED_PLACEMENT_DEPENDENCY',
      `${dependencyName} must resolve to an array.`
    );
  }
  if (records.length > limit) {
    fail(
      'AUTHORED_PLACEMENT_UNAVAILABLE',
      'The placement neighborhood exceeds its safe query bound.'
    );
  }
  return records;
}

export async function inspectForestAuthoredPlacement({
  ownerUserId,
  world,
  objectId = null,
  worldX,
  worldY,
  destinationIndex = deriveForestOwnerPlacementIndex({ worldX, worldY }),
  enforceDensity = true,
  session,
  ForestAuthoredObjectModel = ForestAuthoredObject,
  ForestWritingTreeModel = ForestWritingTree,
  resolveEnvironment = resolveForestOwnerEnvironment
}) {
  if (!session) {
    fail(
      'INVALID_AUTHORED_PLACEMENT_DEPENDENCY',
      'Placement inspection requires a transaction session.'
    );
  }
  const environment = resolveEnvironment({
    worldSeed: world.worldSeed,
    worldX,
    worldY,
    policyVersion: world.environmentPolicyVersion,
    schemaVersion: world.environmentSchemaVersion,
    worldGenerationVersion: world.worldGenerationVersion
  });
  validateEnvironment(environment, world);
  const { cellXs, cellYs } = queryCells(destinationIndex);
  const scope = {
    ownerUserId,
    forestId: world.forestId,
    'placementIndex.cellX': { $in: cellXs },
    'placementIndex.cellY': { $in: cellYs }
  };
  const trees = await readBounded(
    ForestWritingTreeModel.find(scope, TREE_PROJECTION),
    {
      session,
      limit: FOREST_AUTHORED_WRITING_TREE_NEIGHBORHOOD_LIMIT,
      dependencyName: 'ForestWritingTreeModel.find',
      sort: { writingTreeId: 1 }
    }
  );
  const markers = await readBounded(ForestAuthoredObjectModel.find({
    ...scope,
    state: 'active'
  }, MARKER_PROJECTION), {
    session,
    limit: FOREST_AUTHORED_MARKER_NEIGHBORHOOD_LIMIT,
    dependencyName: 'ForestAuthoredObjectModel.find',
    sort: { objectId: 1 }
  });
  const requested = { worldX, worldY };
  for (const tree of trees) {
    const collisionRadius = validateTree(tree, {
      ownerUserId,
      forestId: world.forestId
    });
    const requiredDistance = collisionRadius
      + FOREST_AUTHORED_MARKER_RADIUS
      + FOREST_AUTHORED_PLACEMENT_GAP;
    if (squaredDistance(requested, tree.placement) < requiredDistance ** 2) {
      fail(
        'AUTHORED_PLACEMENT_COLLISION',
        'The requested placement does not clear existing forest geography.'
      );
    }
  }
  let destinationPopulation = 0;
  for (const marker of markers) {
    const markerIndex = validateMarker(marker, {
      ownerUserId,
      forestId: world.forestId
    });
    if (marker.objectId === objectId) continue;
    if (
      markerIndex.cellX === destinationIndex.cellX
      && markerIndex.cellY === destinationIndex.cellY
    ) destinationPopulation += 1;
    if (
      squaredDistance(requested, marker.placement)
      < FOREST_AUTHORED_MARKER_MINIMUM_SPACING ** 2
    ) {
      fail(
        'AUTHORED_PLACEMENT_COLLISION',
        'The requested placement does not clear existing forest geography.'
      );
    }
  }
  if (enforceDensity && destinationPopulation >= FOREST_AUTHORED_ACTIVE_CELL_LIMIT) {
    fail(
      'AUTHORED_PLACEMENT_DENSITY',
      'The requested cell is at its provisional active-marker safety ceiling.'
    );
  }

  return Object.freeze({
    placementIndex: Object.freeze({ ...destinationIndex }),
    inspectedWritingTreeCount: trees.length,
    inspectedAuthoredObjectCount: markers.length,
    destinationPopulation
  });
}

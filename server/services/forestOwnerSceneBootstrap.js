import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import { FOREST_OWNER_WORLD_SCHEMA_VERSION } from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_GROUND_PRESENTATION_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION
} from '../../public/js/owner-forest-environment.js';
import {
  FOREST_OWNER_GROVE_PLACEMENT_VERSION
} from './forestOwnerGrovePlacement.js';
import {
  FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE,
  FOREST_OWNER_PLACEMENT_INDEX_VERSION
} from './forestOwnerPlacementNeighborhood.js';
import {
  FOREST_OWNER_REGION_MAX_ASSET_REQUEST
} from './forestOwnerRegionAssetDelivery.js';
import {
  FOREST_OWNER_REGION_DEFAULT_PAGE_SIZE
} from './forestOwnerRegionManifest.js';
import { FOREST_ASSET_TRANSPORT_RASTER } from './forestSceneAssetTransport.js';

export const FOREST_OWNER_SCENE_BOOTSTRAP_VERSION = 1;
export const FOREST_OWNER_SCENE_SPAWN = Object.freeze({
  worldX: 0,
  worldY: 0,
  radius: 11,
  movementSpeed: 108,
  interactionRadius: 48
});

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WORLD_SEED_PATTERN = /^[A-Za-z0-9_-]{32,80}$/;

export class ForestOwnerSceneBootstrapError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerSceneBootstrapError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerSceneBootstrapError(code, message);
}

function canonicalOwner(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail('INVALID_OWNER_SCENE_INPUT', 'ownerUserId must be a canonical ObjectId string.');
  }
  return ownerUserId;
}

function initialCells() {
  const cells = [];
  for (let cellY = -1; cellY <= 1; cellY += 1) {
    for (let cellX = -1; cellX <= 1; cellX += 1) cells.push({ cellX, cellY });
  }
  return cells;
}

function emptyBootstrap(status) {
  return {
    bootstrapVersion: FOREST_OWNER_SCENE_BOOTSTRAP_VERSION,
    status,
    spawn: FOREST_OWNER_SCENE_SPAWN,
    spatialIndex: {
      version: FOREST_OWNER_PLACEMENT_INDEX_VERSION,
      cellSize: FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE
    },
    environment: null,
    delivery: {
      regionPath: '/api/v1/forest/regions',
      assetPath: '/api/v1/forest/assets',
      inspectionPath: '/api/v1/forest/trees',
      initialCells: initialCells(),
      placementPageSize: FOREST_OWNER_REGION_DEFAULT_PAGE_SIZE,
      assetBatchSize: FOREST_OWNER_REGION_MAX_ASSET_REQUEST,
      transport: FOREST_ASSET_TRANSPORT_RASTER
    }
  };
}

function validateWorld(world, ownerUserId) {
  if (world.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || world.ownerUserId !== ownerUserId
    || world.worldRole !== 'primary'
    || !UUID_V4_PATTERN.test(world.forestId || '')
    || !WORLD_SEED_PATTERN.test(world.worldSeed || '')
    || world.placementPolicyVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || world.environmentPolicyVersion !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || world.environmentSchemaVersion !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || world.worldGenerationVersion !== FOREST_OWNER_WORLD_GENERATION_VERSION
    || !['idle', 'running'].includes(world.reconciliation?.state)) {
    fail('OWNER_SCENE_UNAVAILABLE', 'The owner world has unsupported scene identity.');
  }
  if (world.status !== 'active') {
    fail('OWNER_SCENE_UNAVAILABLE', 'The owner world is unavailable.');
  }
}

async function lean(query) {
  const result = query.lean();
  return typeof result.exec === 'function' ? result.exec() : result;
}

export function buildForestOwnerSceneBootstrapService({
  ForestOwnerWorldModel = ForestOwnerWorld
} = {}) {
  return async function readForestOwnerSceneBootstrap({ ownerUserId: ownerValue }) {
    const ownerUserId = canonicalOwner(ownerValue);
    const world = await lean(ForestOwnerWorldModel.findOne({
      ownerUserId,
      worldRole: 'primary'
    }, {
      _id: 0,
      schemaVersion: 1,
      forestId: 1,
      ownerUserId: 1,
      worldRole: 1,
      status: 1,
      worldSeed: 1,
      placementPolicyVersion: 1,
      environmentPolicyVersion: 1,
      environmentSchemaVersion: 1,
      worldGenerationVersion: 1,
      reconciliation: 1
    }));
    if (!world) return emptyBootstrap('not-established');
    validateWorld(world, ownerUserId);
    if (world.reconciliation.state === 'running') return emptyBootstrap('reconciling');
    return {
      ...emptyBootstrap('ready'),
      environment: {
        policyVersion: FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
        schemaVersion: FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
        worldGenerationVersion: FOREST_OWNER_WORLD_GENERATION_VERSION,
        groundPresentationVersion: FOREST_OWNER_GROUND_PRESENTATION_VERSION,
        grammarId: FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
        seed: world.worldSeed
      }
    };
  };
}

export const readForestOwnerSceneBootstrap = buildForestOwnerSceneBootstrapService();

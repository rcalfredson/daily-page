import { hashSeed } from './forest/v3/random.js';

export const FOREST_OWNER_ENVIRONMENT_POLICY_VERSION = 1;
export const FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION = 1;
export const FOREST_OWNER_WORLD_GENERATION_VERSION = 1;
export const FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID =
  'owner-grove-patchwork-v1';

export const FOREST_OWNER_ENVIRONMENT_CONFIG = Object.freeze({
  coarseCellSize: 1_920,
  fineCellSize: 640,
  coarseWeightPermille: 720,
  intergradeMinimumPermille: 420,
  rockyRegionMinimumPermille: 500,
  rockySurfaceMinimumPermille: 560,
  intergradeMaximumPermille: 580,
  groveTreeDensityPermille: 940,
  rockyTreeDensityPermille: 680,
});

const MAX_SEED_LENGTH = 80;
const MAX_COORDINATE_MAGNITUDE = 1_000_000_000;
const ENVIRONMENT_INPUT_FIELDS = new Set([
  'worldSeed',
  'worldX',
  'worldY',
  'policyVersion',
  'schemaVersion',
  'worldGenerationVersion',
]);

export class ForestOwnerEnvironmentResolverError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerEnvironmentResolverError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerEnvironmentResolverError(code, message);
}

function validateWorldSeed(value) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_SEED_LENGTH
  ) {
    fail(
      'INVALID_ENVIRONMENT_INPUT',
      `worldSeed must be a non-empty string of at most ${MAX_SEED_LENGTH} characters`,
    );
  }
  return value;
}

function validateCoordinate(value, fieldName) {
  if (
    !Number.isSafeInteger(value)
    || Math.abs(value) > MAX_COORDINATE_MAGNITUDE
  ) {
    fail(
      'INVALID_ENVIRONMENT_INPUT',
      `${fieldName} must be a signed safe integer from -${MAX_COORDINATE_MAGNITUDE} through ${MAX_COORDINATE_MAGNITUDE}`,
    );
  }
  return value;
}

function validateVersion(value, expected, fieldName) {
  if (value !== expected) {
    fail(
      'UNSUPPORTED_ENVIRONMENT_VERSION',
      `${fieldName} ${value} is not supported`,
    );
  }
  return value;
}

function unit(seed) {
  return hashSeed(seed) / 4_294_967_296;
}

function smoothstep(value) {
  return value * value * (3 - (2 * value));
}

function interpolate(left, right, amount) {
  return left + ((right - left) * amount);
}

function latticeUnit(worldSeed, scale, cellX, cellY) {
  return unit([
    FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
    worldSeed,
    scale,
    cellX,
    cellY,
  ].join(':'));
}

function valueNoise(worldSeed, worldX, worldY, cellSize, scale) {
  const cellX = Math.floor(worldX / cellSize);
  const cellY = Math.floor(worldY / cellSize);
  const localX = (worldX - (cellX * cellSize)) / cellSize;
  const localY = (worldY - (cellY * cellSize)) / cellSize;
  const blendX = smoothstep(localX);
  const blendY = smoothstep(localY);
  const far = interpolate(
    latticeUnit(worldSeed, scale, cellX, cellY),
    latticeUnit(worldSeed, scale, cellX + 1, cellY),
    blendX,
  );
  const near = interpolate(
    latticeUnit(worldSeed, scale, cellX, cellY + 1),
    latticeUnit(worldSeed, scale, cellX + 1, cellY + 1),
    blendX,
  );
  return interpolate(far, near, blendY);
}

function rockinessPermille(worldSeed, worldX, worldY) {
  const config = FOREST_OWNER_ENVIRONMENT_CONFIG;
  const coarse = valueNoise(
    worldSeed,
    worldX,
    worldY,
    config.coarseCellSize,
    'coarse',
  );
  const fine = valueNoise(
    worldSeed,
    worldX,
    worldY,
    config.fineCellSize,
    'fine',
  );
  const coarseWeight = config.coarseWeightPermille / 1_000;

  return Math.round((
    (coarse * coarseWeight)
    + (fine * (1 - coarseWeight))
  ) * 1_000);
}

function treeDensityPermille(rockiness) {
  const config = FOREST_OWNER_ENVIRONMENT_CONFIG;
  const transitionProgress = Math.max(0, Math.min(
    1,
    (rockiness - config.intergradeMinimumPermille)
      / (config.intergradeMaximumPermille
        - config.intergradeMinimumPermille),
  ));

  return Math.round(interpolate(
    config.groveTreeDensityPermille,
    config.rockyTreeDensityPermille,
    smoothstep(transitionProgress),
  ));
}

function originatingEnvironment({
  policyVersion,
  schemaVersion,
  worldGenerationVersion,
  regionId,
  habitatId,
  groundSurfaceId,
  transitionState,
}) {
  return Object.freeze({
    policyVersion,
    schemaVersion,
    worldGenerationVersion,
    regionId,
    habitatId,
    groundSurfaceId,
    transitionState,
  });
}

export function resolveForestOwnerEnvironment(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('INVALID_ENVIRONMENT_INPUT', 'environment input must be an object');
  }
  if (Object.keys(input).some(field => !ENVIRONMENT_INPUT_FIELDS.has(field))) {
    fail(
      'INVALID_ENVIRONMENT_INPUT',
      'environment input contains an unsupported field',
    );
  }
  const {
    worldSeed,
    worldX,
    worldY,
    policyVersion = FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
    schemaVersion = FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
    worldGenerationVersion = FOREST_OWNER_WORLD_GENERATION_VERSION,
  } = input;
  const seed = validateWorldSeed(worldSeed);
  const x = validateCoordinate(worldX, 'worldX');
  const y = validateCoordinate(worldY, 'worldY');
  const policy = validateVersion(
    policyVersion,
    FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
    'policyVersion',
  );
  const schema = validateVersion(
    schemaVersion,
    FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
    'schemaVersion',
  );
  const generation = validateVersion(
    worldGenerationVersion,
    FOREST_OWNER_WORLD_GENERATION_VERSION,
    'worldGenerationVersion',
  );
  const config = FOREST_OWNER_ENVIRONMENT_CONFIG;
  const rockiness = rockinessPermille(seed, x, y);
  const rocky = rockiness >= config.rockyRegionMinimumPermille;
  const intergrade = rockiness > config.intergradeMinimumPermille
    && rockiness < config.intergradeMaximumPermille;
  const density = treeDensityPermille(rockiness);
  const suitabilityRollPermille = Math.floor(unit([
    FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
    seed,
    'tree-suitability',
    x,
    y,
  ].join(':')) * 1_000);
  const treeAllowed = suitabilityRollPermille < density;

  return Object.freeze({
    policyVersion: policy,
    schemaVersion: schema,
    worldGenerationVersion: generation,
    grammarId: FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
    originatingEnvironment: originatingEnvironment({
      policyVersion: policy,
      schemaVersion: schema,
      worldGenerationVersion: generation,
      regionId: rocky ? 'rocky-rise' : 'calm-grove',
      habitatId: rocky ? 'rocky-edge' : 'neutral-grove',
      groundSurfaceId: rockiness >= config.rockySurfaceMinimumPermille
        ? 'weathered-rock-grass'
        : 'grove-moss',
      transitionState: intergrade
        ? 'intergrade'
        : rocky ? 'rocky-core' : 'grove-core',
    }),
    ecology: Object.freeze({
      rockinessPermille: rockiness,
      treeDensityPermille: density,
    }),
    suitability: Object.freeze({
      treeAllowed,
      reason: treeAllowed ? 'suitable' : 'habitat-density',
    }),
  });
}

export function forestOwnerEnvironmentExcludesTree(environment) {
  if (typeof environment?.suitability?.treeAllowed !== 'boolean') {
    fail(
      'INVALID_ENVIRONMENT_INPUT',
      'environment must be an owner environment resolution',
    );
  }
  return !environment.suitability.treeAllowed;
}

export function buildForestOwnerEnvironmentPlacementExclusion({
  worldSeed,
  policyVersion = FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  schemaVersion = FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  worldGenerationVersion = FOREST_OWNER_WORLD_GENERATION_VERSION,
}) {
  const seed = validateWorldSeed(worldSeed);
  validateVersion(
    policyVersion,
    FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
    'policyVersion',
  );
  validateVersion(
    schemaVersion,
    FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
    'schemaVersion',
  );
  validateVersion(
    worldGenerationVersion,
    FOREST_OWNER_WORLD_GENERATION_VERSION,
    'worldGenerationVersion',
  );

  return function isExcluded(candidate) {
    return forestOwnerEnvironmentExcludesTree(resolveForestOwnerEnvironment({
      worldSeed: seed,
      worldX: candidate?.worldX,
      worldY: candidate?.worldY,
      policyVersion,
      schemaVersion,
      worldGenerationVersion,
    }));
  };
}

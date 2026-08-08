import {
  FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION,
  sampleOwnerForestEnvironment
} from '../../public/js/owner-forest-environment.js';

export {
  FOREST_OWNER_ENVIRONMENT_CONFIG,
  FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION
} from '../../public/js/owner-forest-environment.js';

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
  const sample = sampleOwnerForestEnvironment({ worldSeed: seed, worldX: x, worldY: y });

  return Object.freeze({
    policyVersion: policy,
    schemaVersion: schema,
    worldGenerationVersion: generation,
    grammarId: FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
    originatingEnvironment: originatingEnvironment({
      policyVersion: policy,
      schemaVersion: schema,
      worldGenerationVersion: generation,
      regionId: sample.regionId,
      habitatId: sample.habitatId,
      groundSurfaceId: sample.groundSurfaceId,
      transitionState: sample.transitionState,
    }),
    ecology: Object.freeze({
      rockinessPermille: sample.rockinessPermille,
      treeDensityPermille: sample.treeDensityPermille,
    }),
    suitability: Object.freeze({
      treeAllowed: sample.treeAllowed,
      reason: sample.treeAllowed ? 'suitable' : 'habitat-density',
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

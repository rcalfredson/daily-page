export const FOREST_OWNER_ENVIRONMENT_POLICY_VERSION = 1;
export const FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION = 1;
export const FOREST_OWNER_WORLD_GENERATION_VERSION = 1;
export const FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID = 'owner-grove-patchwork-v1';
export const FOREST_OWNER_GROUND_PRESENTATION_VERSION = 1;

export const FOREST_OWNER_ENVIRONMENT_CONFIG = Object.freeze({
  coarseCellSize: 1_920,
  fineCellSize: 640,
  coarseWeightPermille: 720,
  intergradeMinimumPermille: 420,
  rockyRegionMinimumPermille: 500,
  rockySurfaceMinimumPermille: 560,
  intergradeMaximumPermille: 580,
  groveTreeDensityPermille: 940,
  rockyTreeDensityPermille: 680
});

const MAX_SEED_LENGTH = 80;
const MAX_COORDINATE_MAGNITUDE = 1_000_000_000;

function hash(value) {
  let result = 2166136261;
  for (const character of String(value || '')) {
    result ^= character.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function unit(seed) {
  return hash(seed) / 4_294_967_296;
}

function smoothstep(value) {
  return value * value * (3 - (2 * value));
}

function interpolate(left, right, amount) {
  return left + ((right - left) * amount);
}

function latticeUnit(worldSeed, scale, cellX, cellY) {
  return unit([
    FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID, worldSeed, scale, cellX, cellY
  ].join(':'));
}

function valueNoise(worldSeed, worldX, worldY, cellSize, scale) {
  const cellX = Math.floor(worldX / cellSize);
  const cellY = Math.floor(worldY / cellSize);
  const localX = (worldX - (cellX * cellSize)) / cellSize;
  const localY = (worldY - (cellY * cellSize)) / cellSize;
  const blendX = smoothstep(localX);
  const blendY = smoothstep(localY);
  const far = interpolate(latticeUnit(worldSeed, scale, cellX, cellY),
    latticeUnit(worldSeed, scale, cellX + 1, cellY), blendX);
  const near = interpolate(latticeUnit(worldSeed, scale, cellX, cellY + 1),
    latticeUnit(worldSeed, scale, cellX + 1, cellY + 1), blendX);
  return interpolate(far, near, blendY);
}

function rockinessPermille(worldSeed, worldX, worldY) {
  const config = FOREST_OWNER_ENVIRONMENT_CONFIG;
  const coarse = valueNoise(worldSeed, worldX, worldY, config.coarseCellSize, 'coarse');
  const fine = valueNoise(worldSeed, worldX, worldY, config.fineCellSize, 'fine');
  const coarseWeight = config.coarseWeightPermille / 1_000;
  return Math.round(((coarse * coarseWeight) + (fine * (1 - coarseWeight))) * 1_000);
}

function treeDensityPermille(rockiness) {
  const config = FOREST_OWNER_ENVIRONMENT_CONFIG;
  const progress = Math.max(0, Math.min(1,
    (rockiness - config.intergradeMinimumPermille)
      / (config.intergradeMaximumPermille - config.intergradeMinimumPermille)));
  return Math.round(interpolate(config.groveTreeDensityPermille,
    config.rockyTreeDensityPermille, smoothstep(progress)));
}

export function sampleOwnerForestEnvironment({ worldSeed, worldX, worldY }) {
  if (typeof worldSeed !== 'string' || !worldSeed.length || worldSeed.length > MAX_SEED_LENGTH
    || !Number.isSafeInteger(worldX) || Math.abs(worldX) > MAX_COORDINATE_MAGNITUDE
    || !Number.isSafeInteger(worldY) || Math.abs(worldY) > MAX_COORDINATE_MAGNITUDE) {
    throw new Error('Owner forest environment sample is invalid.');
  }
  const config = FOREST_OWNER_ENVIRONMENT_CONFIG;
  const rockiness = rockinessPermille(worldSeed, worldX, worldY);
  const rocky = rockiness >= config.rockyRegionMinimumPermille;
  const intergrade = rockiness > config.intergradeMinimumPermille
    && rockiness < config.intergradeMaximumPermille;
  const density = treeDensityPermille(rockiness);
  const suitabilityRoll = Math.floor(unit([
    FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID, worldSeed, 'tree-suitability', worldX, worldY
  ].join(':')) * 1_000);
  return Object.freeze({
    regionId: rocky ? 'rocky-rise' : 'calm-grove',
    habitatId: rocky ? 'rocky-edge' : 'neutral-grove',
    groundSurfaceId: rockiness >= config.rockySurfaceMinimumPermille
      ? 'weathered-rock-grass' : 'grove-moss',
    transitionState: intergrade ? 'intergrade' : rocky ? 'rocky-core' : 'grove-core',
    rockinessPermille: rockiness,
    treeDensityPermille: density,
    treeAllowed: suitabilityRoll < density
  });
}

export const FOREST_OWNER_ENVIRONMENT_POLICY_VERSION = 1;
export const FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION = 1;
export const FOREST_OWNER_WORLD_GENERATION_VERSION = 1;
export const FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID = 'owner-grove-patchwork-v1';
export const FOREST_OWNER_GROUND_PRESENTATION_VERSION = 2;

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

export const FOREST_OWNER_GROUND_PRESENTATION_CONFIG = Object.freeze({
  tileSize: 48,
  originClearingInnerRadius: 240,
  originClearingOuterRadius: 760,
  detailDensityPermille: 300
});

const GROUND_GROVE_COLOR = Object.freeze([82, 119, 72]);
const GROUND_ROCKY_COLOR = Object.freeze([112, 108, 84]);
const GROUND_ORIGIN_COLOR = Object.freeze([96, 130, 80]);

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

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
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

function originClearingPermille(worldX, worldY) {
  const config = FOREST_OWNER_GROUND_PRESENTATION_CONFIG;
  const distance = Math.hypot(worldX, worldY);
  const progress = clamp(
    (distance - config.originClearingInnerRadius)
      / (config.originClearingOuterRadius - config.originClearingInnerRadius),
    0,
    1
  );
  return Math.round((1 - smoothstep(progress)) * 1_000);
}

function groundDetail({ worldSeed, worldX, worldY, rockinessPermille, clearingPermille }) {
  const detailRoll = Math.floor(unit([
    FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID, worldSeed, 'ground-detail', worldX, worldY
  ].join(':')) * 1_000);
  const clearingReduction = Math.round(clearingPermille * 0.12);
  if (detailRoll >= FOREST_OWNER_GROUND_PRESENTATION_CONFIG.detailDensityPermille
    - clearingReduction) return null;

  const variantRoll = Math.floor(unit([
    FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID, worldSeed, 'ground-detail-kind', worldX, worldY
  ].join(':')) * 1_000);
  let kind;
  if (rockinessPermille >= 560) kind = variantRoll < 380 ? 'stone' : 'pebbles';
  else if (rockinessPermille >= 420) kind = variantRoll < 460 ? 'pebbles' : 'grass';
  else kind = variantRoll < 320 ? 'moss' : 'grass';

  const offset = axis => Math.round((unit([
    FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID, worldSeed, `ground-detail-${axis}`, worldX, worldY
  ].join(':')) - 0.5) * 560);
  const scalePermille = 720 + Math.floor(unit([
    FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID, worldSeed, 'ground-detail-scale', worldX, worldY
  ].join(':')) * 520);
  return Object.freeze({
    kind,
    offsetXPermille: offset('x'),
    offsetYPermille: offset('y'),
    scalePermille
  });
}

export function sampleOwnerForestGroundPresentation({ worldSeed, worldX, worldY }) {
  const environment = sampleOwnerForestEnvironment({ worldSeed, worldX, worldY });
  const clearingPermille = originClearingPermille(worldX, worldY);
  const clearing = clearingPermille / 1_000;
  const softenedRockiness = Math.min(environment.rockinessPermille, 320);
  const presentedRockiness = Math.round(interpolate(
    environment.rockinessPermille,
    softenedRockiness,
    clearing * 0.72
  ));
  const rocky = presentedRockiness / 1_000;
  const clearingColorAmount = clearing * 0.34;
  const color = GROUND_GROVE_COLOR.map((channel, index) => Math.round(interpolate(
    interpolate(channel, GROUND_ROCKY_COLOR[index], rocky),
    GROUND_ORIGIN_COLOR[index],
    clearingColorAmount
  )));
  const detail = groundDetail({
    worldSeed,
    worldX,
    worldY,
    rockinessPermille: presentedRockiness,
    clearingPermille
  });
  return Object.freeze({
    presentationVersion: FOREST_OWNER_GROUND_PRESENTATION_VERSION,
    color: Object.freeze({ red: color[0], green: color[1], blue: color[2] }),
    rockinessPermille: presentedRockiness,
    originClearingPermille: clearingPermille,
    detail
  });
}

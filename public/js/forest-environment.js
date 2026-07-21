export const FOREST_ENVIRONMENT_SCHEMA_VERSION = 1;
export const FOREST_WORLD_GENERATION_VERSION = 1;
export const FOREST_GROUND_PRESENTATION_VERSION = 3;
export const FOREST_ENVIRONMENT_GRAMMAR_ID = 'grove-and-rocky-rise';
export const FOREST_GROUND_DETAIL_VERSION = 1;
export const FOREST_GROUND_DETAIL_CELL_SIZE = 48;
export const FOREST_BOULDER_TYPE = 'generated-boulder';
export const FOREST_ROCK_PALETTES = Object.freeze([
  Object.freeze({
    id: 'mossed-green', weight: 40,
    colors: Object.freeze({
      dark: '#465147', mid: '#68705c', light: '#85876a', highlight: '#9a9b76',
      accent: '#61734f', accentLight: '#81905b'
    })
  }),
  Object.freeze({
    id: 'granite-grey', weight: 34,
    colors: Object.freeze({
      dark: '#4c5252', mid: '#707675', light: '#929794', highlight: '#b7bab2',
      accent: '#66705d', accentLight: '#849071'
    })
  }),
  Object.freeze({
    id: 'warm-stone', weight: 16,
    colors: Object.freeze({
      dark: '#574d43', mid: '#796957', light: '#9a866c', highlight: '#bfaa87',
      accent: '#74714c', accentLight: '#92905f'
    })
  }),
  Object.freeze({
    id: 'blue-slate', weight: 10,
    colors: Object.freeze({
      dark: '#3f4b50', mid: '#5d696d', light: '#7d8989', highlight: '#a8afaa',
      accent: '#586e64', accentLight: '#718c76'
    })
  })
]);

export const FOREST_ENVIRONMENT_REGIONS = Object.freeze([
  'calm-grove', 'rocky-rise'
]);
export const FOREST_GROUND_SURFACES = Object.freeze([
  'grove-moss', 'weathered-rock-grass'
]);
export const FOREST_ENVIRONMENT_HABITATS = Object.freeze([
  'neutral-grove', 'rocky-edge'
]);

const MANIFEST_KEYS = Object.freeze([
  'schemaVersion', 'worldGenerationVersion', 'groundPresentationVersion',
  'grammarId', 'seed', 'world', 'rockyRise'
]);
const WORLD_KEYS = Object.freeze(['width', 'height']);
const RISE_KEYS = Object.freeze([
  'centerX', 'centerY', 'radiusX', 'radiusY', 'transitionWidth', 'phaseX', 'phaseY'
]);
const POSITION_KEYS = Object.freeze(['worldX', 'worldY']);
const CELL_KEYS = Object.freeze(['column', 'row']);

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === expected.length
    && expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function boundedInteger(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function unit(seed) {
  return hash(seed) / 4294967296;
}

function validateWorld(world) {
  if (!exactKeys(world, WORLD_KEYS)
    || !boundedInteger(world.width, 800, 10000)
    || !boundedInteger(world.height, 600, 10000)) {
    throw new Error('Environment world must contain bounded integer width and height.');
  }
}

export function validateForestEnvironmentManifest(manifest) {
  if (!exactKeys(manifest, MANIFEST_KEYS)) {
    throw new Error('Forest environment manifest has an unsupported shape.');
  }
  if (manifest.schemaVersion !== FOREST_ENVIRONMENT_SCHEMA_VERSION
    || manifest.worldGenerationVersion !== FOREST_WORLD_GENERATION_VERSION
    || manifest.groundPresentationVersion !== FOREST_GROUND_PRESENTATION_VERSION) {
    throw new Error('Forest environment manifest uses an unsupported version.');
  }
  if (manifest.grammarId !== FOREST_ENVIRONMENT_GRAMMAR_ID) {
    throw new Error('Forest environment manifest uses an unknown grammar.');
  }
  if (typeof manifest.seed !== 'string' || !manifest.seed.length || manifest.seed.length > 80) {
    throw new Error('Environment seed must be a non-empty string of at most 80 characters.');
  }
  validateWorld(manifest.world);
  const rise = manifest.rockyRise;
  if (!exactKeys(rise, RISE_KEYS)
    || !boundedInteger(rise.centerX, 0, manifest.world.width)
    || !boundedInteger(rise.centerY, 0, manifest.world.height)
    || !boundedInteger(rise.radiusX, 200, manifest.world.width)
    || !boundedInteger(rise.radiusY, 200, manifest.world.height)
    || !boundedInteger(rise.transitionWidth, 80, 500)
    || !boundedInteger(rise.phaseX, 0, 6283)
    || !boundedInteger(rise.phaseY, 0, 6283)) {
    throw new Error('Forest environment rocky-rise grammar is malformed.');
  }
  return manifest;
}

export function createForestEnvironmentManifest({ seed, world }) {
  if (!exactKeys({ seed, world }, ['seed', 'world'])) {
    throw new Error('Environment creation requires only seed and world.');
  }
  if (typeof seed !== 'string' || !seed.length || seed.length > 80) {
    throw new Error('Environment seed must be a non-empty string of at most 80 characters.');
  }
  validateWorld(world);
  const manifest = {
    schemaVersion: FOREST_ENVIRONMENT_SCHEMA_VERSION,
    worldGenerationVersion: FOREST_WORLD_GENERATION_VERSION,
    groundPresentationVersion: FOREST_GROUND_PRESENTATION_VERSION,
    grammarId: FOREST_ENVIRONMENT_GRAMMAR_ID,
    seed,
    world: { width: world.width, height: world.height },
    rockyRise: {
      centerX: Math.round(world.width * (0.72 + ((unit(`${seed}:center-x`) - 0.5) * 0.04))),
      centerY: Math.round(world.height * (0.43 + ((unit(`${seed}:center-y`) - 0.5) * 0.06))),
      radiusX: Math.round(world.width * (0.265 + (unit(`${seed}:radius-x`) * 0.025))),
      radiusY: Math.round(world.height * (0.34 + (unit(`${seed}:radius-y`) * 0.035))),
      transitionWidth: Math.round(190 + (unit(`${seed}:transition`) * 55)),
      phaseX: Math.floor(unit(`${seed}:phase-x`) * 6284),
      phaseY: Math.floor(unit(`${seed}:phase-y`) * 6284)
    }
  };
  validateForestEnvironmentManifest(manifest);
  return JSON.parse(JSON.stringify(manifest));
}

function smoothstep(value) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - (2 * bounded));
}

export function forestEnvironmentAt(manifest, position) {
  validateForestEnvironmentManifest(manifest);
  if (!exactKeys(position, POSITION_KEYS)
    || !Number.isSafeInteger(position.worldX) || !Number.isSafeInteger(position.worldY)
    || position.worldX < 0 || position.worldX > manifest.world.width
    || position.worldY < 0 || position.worldY > manifest.world.height) {
    throw new Error('Environment position must be an in-world safe-integer coordinate.');
  }
  const rise = manifest.rockyRise;
  const dx = position.worldX - rise.centerX;
  const dy = position.worldY - rise.centerY;
  const phaseX = rise.phaseX / 1000;
  const phaseY = rise.phaseY / 1000;
  const irregularity = (Math.sin((position.worldY / 137) + phaseX) * 0.085)
    + (Math.sin((position.worldX / 211) + phaseY) * 0.055)
    + (Math.sin(((position.worldX + position.worldY) / 317) + phaseX - phaseY) * 0.035);
  const ellipseDistance = Math.hypot(dx / rise.radiusX, dy / rise.radiusY) + irregularity;
  const normalizedBand = rise.transitionWidth / Math.min(rise.radiusX, rise.radiusY);
  const rockyBlend = smoothstep((1 + normalizedBand - ellipseDistance) / (normalizedBand * 2));
  const rockyPermille = Math.round(rockyBlend * 1000);
  const rocky = rockyPermille >= 500;
  const transition = rockyPermille > 0 && rockyPermille < 1000;
  const treeDensityPermille = Math.round(1000 - (rockyBlend * 330));

  return {
    schemaVersion: manifest.schemaVersion,
    worldGenerationVersion: manifest.worldGenerationVersion,
    dominantRegionId: rocky ? 'rocky-rise' : 'calm-grove',
    groundSurfaceId: rocky ? 'weathered-rock-grass' : 'grove-moss',
    habitatId: rocky ? 'rocky-edge' : 'neutral-grove',
    transition: {
      state: transition ? 'intergrade' : rocky ? 'rocky-core' : 'grove-core',
      rockyBlendPermille: rockyPermille
    },
    suitability: {
      treeDensityPermille,
      discoveries: 'either-surface',
      clearingObjects: 'either-surface'
    }
  };
}

export function forestGroundDetailAt(manifest, cell) {
  validateForestEnvironmentManifest(manifest);
  const maximumColumn = Math.ceil(manifest.world.width / FOREST_GROUND_DETAIL_CELL_SIZE) - 1;
  const maximumRow = Math.ceil(manifest.world.height / FOREST_GROUND_DETAIL_CELL_SIZE) - 1;
  if (!exactKeys(cell, CELL_KEYS)
    || !boundedInteger(cell.column, 0, maximumColumn)
    || !boundedInteger(cell.row, 0, maximumRow)) {
    throw new Error('Ground detail cell must be a bounded in-world integer cell.');
  }
  const decision = [
    manifest.seed, `ground-detail-v${FOREST_GROUND_DETAIL_VERSION}`, cell.column, cell.row
  ].join(':');
  const worldX = Math.min(manifest.world.width, Math.round(
    (cell.column * FOREST_GROUND_DETAIL_CELL_SIZE) + 8 + (unit(`${decision}:x`) * 32)
  ));
  const worldY = Math.min(manifest.world.height, Math.round(
    (cell.row * FOREST_GROUND_DETAIL_CELL_SIZE) + 8 + (unit(`${decision}:y`) * 32)
  ));
  const environment = forestEnvironmentAt(manifest, { worldX, worldY });
  const rockyBlend = environment.transition.rockyBlendPermille / 1000;
  const stoneChance = 0.012 + (rockyBlend * 0.17);
  const gravelChance = 0.035 + (rockyBlend * 0.29);
  const tuftChance = 0.38 - (rockyBlend * 0.11);
  const soilChance = 0.07 + ((1 - rockyBlend) * 0.04);
  const selection = unit(`${decision}:type`);
  let type = null;
  if (selection < stoneChance) type = 'small-stone';
  else if (selection < stoneChance + gravelChance) type = 'gravel-patch';
  else if (selection < stoneChance + gravelChance + tuftChance) type = 'grass-tuft';
  else if (selection < stoneChance + gravelChance + tuftChance + soilChance) type = 'bare-soil';
  if (!type) return null;
  const paletteTotal = FOREST_ROCK_PALETTES.reduce((sum, palette) => sum + palette.weight, 0);
  let paletteChoice = unit(`${decision}:rock-palette`) * paletteTotal;
  const rockPalette = FOREST_ROCK_PALETTES.find((palette) => {
    paletteChoice -= palette.weight;
    return paletteChoice < 0;
  }) || FOREST_ROCK_PALETTES[0];
  return {
    version: FOREST_GROUND_DETAIL_VERSION,
    cellColumn: cell.column,
    cellRow: cell.row,
    worldX,
    worldY,
    type,
    variant: Math.floor(unit(`${decision}:variant`) * 4),
    rockPaletteId: ['small-stone', 'gravel-patch'].includes(type) ? rockPalette.id : null,
    rockyBlendPermille: environment.transition.rockyBlendPermille
  };
}

export function resolveForestRockPalette(paletteId) {
  return FOREST_ROCK_PALETTES.find(({ id }) => id === paletteId) || null;
}

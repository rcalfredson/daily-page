import {
  FOREST_BOULDER_TYPE,
  FOREST_BRIDGE_TYPE,
  FOREST_CROSSING_GENERATION_VERSION,
  FOREST_CROSSING_SCHEMA_VERSION,
  FOREST_ROCK_PALETTES,
  forestBridgeContains,
  forestEnvironmentAt,
  forestStreamCenterY,
  validateForestStreamCrossing
} from '../../public/js/forest-environment.js';
import { createRandom, hashSeed } from './forest/v3/random.js';
import { FOREST_BRIDGE_DEFINITION_ID } from '../../public/js/forest-bridges.js';

export { FOREST_CROSSING_GENERATION_VERSION, FOREST_CROSSING_SCHEMA_VERSION };

export const FOREST_TERRAIN_FEATURE_SCHEMA_VERSION = 2;
export const FOREST_TERRAIN_FEATURE_GENERATION_VERSION = 5;
export const FOREST_TERRAIN_FEATURE_CELL_SIZE = 160;
const FOREST_TERRAIN_FEATURE_PLACEMENT_VERSION = 1;

const BOULDER_VARIANTS = Object.freeze([
  Object.freeze({ id: 'low', collisionRadius: 15, width: 34, height: 20 }),
  Object.freeze({ id: 'shouldered', collisionRadius: 21, width: 46, height: 30 }),
  Object.freeze({ id: 'mossy-outcrop', collisionRadius: 28, width: 62, height: 42 })
]);

function decisionUnit(seed, column, row, decision) {
  return createRandom(hashSeed([
    `forest-terrain-features-v${FOREST_TERRAIN_FEATURE_PLACEMENT_VERSION}`,
    seed, column, row, decision
  ].join(':')))();
}

function rockPalette(seed, column, row) {
  const paletteTotal = FOREST_ROCK_PALETTES.reduce(
    (sum, palette) => sum + palette.weight, 0
  );
  let paletteChoice = decisionUnit(seed, column, row, 'rock-palette') * paletteTotal;
  return FOREST_ROCK_PALETTES.find((candidate) => {
    paletteChoice -= candidate.weight;
    return paletteChoice < 0;
  }) || FOREST_ROCK_PALETTES[0];
}

export function generateForestStreamCrossing(scene, corridorCenterAt) {
  if (!scene?.environment || typeof corridorCenterAt !== 'function') {
    throw new Error('A stream crossing requires an environment and corridor query.');
  }
  let best = null;
  for (let worldY = 80; worldY <= scene.world.height - 80; worldY += 1) {
    const worldX = Math.round(corridorCenterAt(worldY));
    const difference = Math.abs(worldY - forestStreamCenterY(scene.environment, worldX));
    if (!best || difference < best.difference) best = { worldX, worldY, difference };
  }
  const halfLength = scene.environment.stream.halfWidth
    + scene.environment.stream.bankWidth + 34;
  return validateForestStreamCrossing({
    schemaVersion: FOREST_CROSSING_SCHEMA_VERSION,
    generationVersion: FOREST_CROSSING_GENERATION_VERSION,
    id: 'forest-crossing-v6-stream-footbridge-primary',
    type: FOREST_BRIDGE_TYPE,
    worldX: best.worldX,
    worldY: best.worldY,
    orientation: 'world-angle',
    angleMilliradians: 1100 + Math.floor(decisionUnit(
      scene.environment.seed, best.worldX, best.worldY, 'bridge-angle'
    ) * 100),
    definitionId: FOREST_BRIDGE_DEFINITION_ID,
    halfWidth: 31,
    halfLength,
    maximumElevationPixels: 24
  }, scene.world);
}

export function generateForestStreamCrossings(scene, corridorCenterAt) {
  const primary = generateForestStreamCrossing(scene, corridorCenterAt);
  const angleMilliradians = 2020 + Math.floor(decisionUnit(
    scene.environment.seed, primary.worldX, primary.worldY, 'second-bridge-angle'
  ) * 100);
  const angle = angleMilliradians / 1000;
  const requiredSpan = scene.environment.stream.halfWidth
    + scene.environment.stream.bankWidth + 34;
  const halfLength = Math.min(160, Math.ceil(requiredSpan / Math.abs(Math.sin(angle))));
  const targetX = Math.round(scene.world.width * 0.74);
  const offsets = [0, 170, -170, 340, -340, 510, -510, 680, -680];
  for (const offset of offsets) {
    const worldX = Math.max(180, Math.min(scene.world.width - 180, targetX + offset));
    if (Math.abs(worldX - primary.worldX) < 420) continue;
    const candidate = validateForestStreamCrossing({
      schemaVersion: FOREST_CROSSING_SCHEMA_VERSION,
      generationVersion: FOREST_CROSSING_GENERATION_VERSION,
      id: 'forest-crossing-v6-stream-footbridge-secondary',
      type: FOREST_BRIDGE_TYPE,
      worldX,
      worldY: forestStreamCenterY(scene.environment, worldX),
      orientation: 'world-angle',
      angleMilliradians,
      definitionId: FOREST_BRIDGE_DEFINITION_ID,
      halfWidth: 29,
      halfLength,
      maximumElevationPixels: 20
    }, scene.world);
    const overlapsTree = scene.placements.some(placement => forestBridgeContains(
      candidate, placement, 42
    ));
    if (!overlapsTree) return [primary, candidate];
  }
  throw new Error('Could not place the second stream footbridge clear of generated trees.');
}

export function generateForestTerrainFeatures(scene, corridorCenterAt) {
  if (!scene?.environment || !scene?.world || !Array.isArray(scene.placements)
    || typeof corridorCenterAt !== 'function') {
    throw new Error('Terrain features require an environment scene and corridor query.');
  }
  const features = [];
  const columns = Math.ceil(scene.world.width / FOREST_TERRAIN_FEATURE_CELL_SIZE);
  const rows = Math.ceil(scene.world.height / FOREST_TERRAIN_FEATURE_CELL_SIZE);
  const spawn = {
    worldX: Math.round(corridorCenterAt(scene.world.height - 180)),
    worldY: scene.world.height - 180
  };

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const worldX = Math.min(scene.world.width - 1, Math.round(
        (column * FOREST_TERRAIN_FEATURE_CELL_SIZE) + 28
          + (decisionUnit(scene.environment.seed, column, row, 'x') * 104)
      ));
      const worldY = Math.min(scene.world.height - 1, Math.round(
        (row * FOREST_TERRAIN_FEATURE_CELL_SIZE) + 28
          + (decisionUnit(scene.environment.seed, column, row, 'y') * 104)
      ));
      const environment = forestEnvironmentAt(scene.environment, { worldX, worldY });
      if (environment.hydrology.state !== 'land') continue;
      const rockyBlend = environment.transition.rockyBlendPermille / 1000;
      const chance = 0.018 + (rockyBlend * 0.38);
      if (decisionUnit(scene.environment.seed, column, row, 'presence') >= chance) continue;
      const variantIndex = Math.min(BOULDER_VARIANTS.length - 1, Math.floor(
        decisionUnit(scene.environment.seed, column, row, 'variant')
          * BOULDER_VARIANTS.length
      ));
      const variant = BOULDER_VARIANTS[variantIndex];
      const palette = rockPalette(scene.environment.seed, column, row);
      if (Math.abs(worldX - corridorCenterAt(worldY))
        < scene.corridor.halfWidth + variant.collisionRadius + 24) continue;
      if (scene.crossings.some(crossing => forestBridgeContains(
        crossing, { worldX, worldY }, variant.collisionRadius + 20
      ))) continue;
      if (Math.hypot(worldX - spawn.worldX, worldY - spawn.worldY)
        < variant.collisionRadius + 78) continue;
      if (scene.placements.some(placement => Math.hypot(
        placement.worldX - worldX, placement.worldY - worldY
      ) < variant.collisionRadius + 42)) continue;
      if (features.some(feature => Math.hypot(
        feature.worldX - worldX, feature.worldY - worldY
      ) < feature.collisionRadius + variant.collisionRadius + 32)) continue;

      features.push({
        schemaVersion: FOREST_TERRAIN_FEATURE_SCHEMA_VERSION,
        generationVersion: FOREST_TERRAIN_FEATURE_GENERATION_VERSION,
        id: `forest-boulder-v1-${column}-${row}`,
        type: FOREST_BOULDER_TYPE,
        terrainRole: 'land-boulder',
        variantId: variant.id,
        rockPaletteId: palette.id,
        worldX,
        worldY,
        collisionRadius: variant.collisionRadius,
        width: variant.width,
        height: variant.height,
        originatingRegionId: environment.dominantRegionId,
        rockyBlendPermille: environment.transition.rockyBlendPermille
      });
    }
  }
  const streamBoulderCount = 8;
  for (let ordinal = 0; ordinal < streamBoulderCount; ordinal += 1) {
    const column = 100 + ordinal;
    const worldX = Math.round(260 + ((ordinal + 0.5) * (
      (scene.world.width - 520) / streamBoulderCount
    )) + ((decisionUnit(scene.environment.seed, column, 0, 'stream-x') - 0.5) * 90));
    if (scene.crossings.some(crossing => Math.abs(worldX - crossing.worldX) < 135)) continue;
    const centerY = forestStreamCenterY(scene.environment, worldX);
    const lane = decisionUnit(scene.environment.seed, column, 0, 'stream-lane') < 0.5 ? -1 : 1;
    const worldY = Math.round(centerY + (lane * (8
      + (decisionUnit(scene.environment.seed, column, 0, 'stream-offset') * 18))));
    const large = decisionUnit(scene.environment.seed, column, 0, 'stream-size') > 0.62;
    const variant = large ? BOULDER_VARIANTS[1] : BOULDER_VARIANTS[0];
    const palette = rockPalette(scene.environment.seed, column, 0);
    if (features.some(feature => Math.hypot(
      feature.worldX - worldX, feature.worldY - worldY
    ) < feature.collisionRadius + variant.collisionRadius + 36)) continue;
    features.push({
      schemaVersion: FOREST_TERRAIN_FEATURE_SCHEMA_VERSION,
      generationVersion: FOREST_TERRAIN_FEATURE_GENERATION_VERSION,
      id: `forest-stream-boulder-v1-${String(ordinal + 1).padStart(2, '0')}`,
      type: FOREST_BOULDER_TYPE,
      terrainRole: 'stream-boulder',
      variantId: variant.id,
      rockPaletteId: palette.id,
      worldX,
      worldY,
      collisionRadius: variant.collisionRadius,
      width: variant.width,
      height: variant.height,
      originatingRegionId: forestEnvironmentAt(
        scene.environment, { worldX, worldY }
      ).dominantRegionId,
      rockyBlendPermille: forestEnvironmentAt(
        scene.environment, { worldX, worldY }
      ).transition.rockyBlendPermille
    });
  }
  const bankBoulderCount = 14;
  for (let ordinal = 0; ordinal < bankBoulderCount; ordinal += 1) {
    const column = 200 + ordinal;
    const worldX = Math.round(180 + ((ordinal + 0.5) * (
      (scene.world.width - 360) / bankBoulderCount
    )) + ((decisionUnit(scene.environment.seed, column, 0, 'bank-x') - 0.5) * 72));
    if (scene.crossings.some(crossing => Math.abs(worldX - crossing.worldX) < 150)) continue;
    const centerY = forestStreamCenterY(scene.environment, worldX);
    const side = decisionUnit(scene.environment.seed, column, 0, 'bank-side') < 0.5 ? -1 : 1;
    const worldY = Math.round(centerY + (side * (scene.environment.stream.halfWidth
      + 5 + (decisionUnit(scene.environment.seed, column, 0, 'bank-offset')
        * Math.max(1, scene.environment.stream.bankWidth - 9)))));
    const environment = forestEnvironmentAt(scene.environment, { worldX, worldY });
    if (environment.hydrology.state !== 'bank') continue;
    const variant = decisionUnit(scene.environment.seed, column, 0, 'bank-size') > 0.76
      ? BOULDER_VARIANTS[1] : BOULDER_VARIANTS[0];
    if (Math.abs(worldX - corridorCenterAt(worldY))
      < scene.corridor.halfWidth + variant.collisionRadius + 24) continue;
    if (scene.placements.some(placement => Math.hypot(
      placement.worldX - worldX, placement.worldY - worldY
    ) < variant.collisionRadius + 42)) continue;
    if (features.some(feature => Math.hypot(
      feature.worldX - worldX, feature.worldY - worldY
    ) < feature.collisionRadius + variant.collisionRadius + 24)) continue;
    const palette = rockPalette(scene.environment.seed, column, 0);
    features.push({
      schemaVersion: FOREST_TERRAIN_FEATURE_SCHEMA_VERSION,
      generationVersion: FOREST_TERRAIN_FEATURE_GENERATION_VERSION,
      id: `forest-bank-boulder-v1-${String(ordinal + 1).padStart(2, '0')}`,
      type: FOREST_BOULDER_TYPE,
      terrainRole: 'bank-boulder',
      variantId: variant.id,
      rockPaletteId: palette.id,
      worldX,
      worldY,
      collisionRadius: variant.collisionRadius,
      width: variant.width,
      height: variant.height,
      originatingRegionId: environment.dominantRegionId,
      rockyBlendPermille: environment.transition.rockyBlendPermille
    });
  }
  return features;
}

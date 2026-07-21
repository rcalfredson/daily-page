import {
  FOREST_BOULDER_TYPE,
  FOREST_ROCK_PALETTES,
  forestEnvironmentAt
} from '../../public/js/forest-environment.js';
import { createRandom, hashSeed } from './forest/v3/random.js';

export const FOREST_TERRAIN_FEATURE_SCHEMA_VERSION = 1;
export const FOREST_TERRAIN_FEATURE_GENERATION_VERSION = 2;
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
      const rockyBlend = environment.transition.rockyBlendPermille / 1000;
      const chance = 0.018 + (rockyBlend * 0.38);
      if (decisionUnit(scene.environment.seed, column, row, 'presence') >= chance) continue;
      const variantIndex = Math.min(BOULDER_VARIANTS.length - 1, Math.floor(
        decisionUnit(scene.environment.seed, column, row, 'variant')
          * BOULDER_VARIANTS.length
      ));
      const variant = BOULDER_VARIANTS[variantIndex];
      const paletteTotal = FOREST_ROCK_PALETTES.reduce(
        (sum, palette) => sum + palette.weight, 0
      );
      let paletteChoice = decisionUnit(
        scene.environment.seed, column, row, 'rock-palette'
      ) * paletteTotal;
      const palette = FOREST_ROCK_PALETTES.find((candidate) => {
        paletteChoice -= candidate.weight;
        return paletteChoice < 0;
      }) || FOREST_ROCK_PALETTES[0];
      if (Math.abs(worldX - corridorCenterAt(worldY))
        < scene.corridor.halfWidth + variant.collisionRadius + 24) continue;
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
  return features;
}

import { forestCorridorCenter } from './forestSceneLayout.js';
import { hashSeed } from './forest/v3/random.js';

export const FOREST_PLAYER_RADIUS = 10;
export const FOREST_PLAYER_SPEED = 150;
export const FOREST_INTERACTION_RADIUS = 70;

const FIXTURES = Object.freeze([
  ['storm-notes', 'Notes from a Summer Thunderstorm', 'Daily Inspiration', '2025-07-14',
    'Rain arrived softly at first, silvering the porch steps before the whole sky opened.'],
  ['quiet-repair', 'The Quiet Work of Repair', 'History', '2024-11-08',
    'Some repairs announce themselves. Others simply let a familiar thing remain in the world.'],
  ['bird-names', 'On Learning the Names of Birds', 'Daily Inspiration', '2026-04-19',
    'The names did not make the birds less mysterious; they made attention easier to practice.'],
  ['winter-harbor', 'Postcard from a Winter Harbor', 'United States', '2025-01-23',
    'At low tide the boats leaned together, their ropes drawing patient lines across the cold air.'],
  ['memory-recipe', 'A Recipe Written from Memory', 'Daily Inspiration', '2024-09-12',
    'There were no measurements in the kitchen, only the old blue bowl and the sound of the spoon.'],
  ['kindness-map', 'A Map of Neighborhood Kindness', 'United States', '2026-02-07',
    'A map can hold more than streets: the borrowed ladder, the soup left quietly at a door.']
].map(([id, title, roomName, createdAt, excerpt]) => ({
  id: `forest-fixture-${id}`, title, roomName, createdAt, excerpt
})));

export function forestPlacementCollisionRadius(placement) {
  const phenotypeRadius = placement.phenotypeId === 'sunset-lanternwood' ? 13 : 11;
  return phenotypeRadius * placement.scale;
}

export function createForestExploration(scene) {
  const spawn = {
    worldX: Math.round(forestCorridorCenter(scene.world.height - 180, scene.world.width)),
    worldY: scene.world.height - 180,
    radius: FOREST_PLAYER_RADIUS,
    facing: 'down',
    movementSpeed: FOREST_PLAYER_SPEED
  };
  const fixtures = FIXTURES.map((fixture) => ({ ...fixture }));
  const placements = scene.placements.map((placement) => ({
    ...placement,
    collisionRadius: forestPlacementCollisionRadius(placement),
    fixtureId: fixtures[hashSeed(`forest-fixture:${placement.id}`) % fixtures.length].id
  }));

  return {
    ...scene,
    placements,
    exploration: {
      spawn,
      interactionRadius: FOREST_INTERACTION_RADIUS,
      fixtures
    }
  };
}

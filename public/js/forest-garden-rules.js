// Version 1: independent of terrain generation and writing-tree appearance.
export const GARDEN_VERSION = 1;
export const GARDEN_CAPACITY = 24;
export const CUTTING_CAPACITY = 8;
export const SPROUT_MS = 2 * 60 * 1000;
export const BLOOM_MS = 20 * 60 * 1000;
export const HARVEST_MS = 4 * 60 * 60 * 1000;
export const WILD_LANTERNBELL = Object.freeze({ worldX: 40, worldY: 20 });
export function gardenStage(plant, now) {
  const age = now - new Date(plant.plantedAt).getTime();
  return age >= BLOOM_MS ? 'flowering' : age >= SPROUT_MS ? 'sprout' : 'rooted';
}
export function gardenReady(plant, now) {
  return now >= new Date(plant.readyAt).getTime();
}
export function gardenIntersects(plants, worldX, worldY, radius = 9, exceptId = null) {
  return plants.some(p => p.plantId !== exceptId
    && Math.hypot(worldX - p.worldX, worldY - p.worldY) < radius + 9 + 8);
}

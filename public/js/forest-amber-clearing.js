import { terrainPointSegmentDistance } from './owner-forest-terrain.js';

export function amberClearingStone(route) {
  const end = route.at(-1), previous = route.at(-2);
  // Put the stone on the shoulder, inside the reservation and clear of the parking centerline.
  return { x: end.x + (end.x === previous.x ? 56 : 0),
    y: end.y - (end.y === previous.y ? 56 : 0) };
}

export function amberClearingStoneFootprint(stone) {
  // Only the rock's ground contact is solid. Reeds, loose chips and the shadow are walkable.
  return { minX: stone.x - 25, maxX: stone.x + 23, minY: stone.y - 9, maxY: stone.y + 5 };
}

export function amberClearingBend(route, player, returning) {
  if (route.length !== 3) return null;
  const [home, bend, clearing] = route;
  const point = { x: player.worldX, y: player.worldY };
  const before = terrainPointSegmentDistance(point, returning ? clearing : home, bend);
  const after = terrainPointSegmentDistance(point, bend, returning ? home : clearing);
  // Switch to the endpoint inside the turn so steering can round it without chasing its center.
  return before <= 84 && before < after && Math.hypot(point.x - bend.x, point.y - bend.y) > 24
    ? { worldX: bend.x, worldY: bend.y } : null;
}

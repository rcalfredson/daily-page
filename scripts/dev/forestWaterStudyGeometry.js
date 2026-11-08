// Isolated landscape study, NOT a published owner-terrain generation.
// Complete world-space features are generated once, never capped at a camera/region edge.
import { buildRiverLakeLayout, riverLakeHash } from '../../public/js/forest-river-lake.js';
import { terrainPointSegmentDistance } from '../../public/js/owner-forest-terrain.js';

export const WATER_STUDY_ID = 'river-lake-study-1';
export const WATER_STUDY_SPEED = 108;
export const studyHash = riverLakeHash;
function contains(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y)
      && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function studyWaterDistance(scene, p) {
  if (scene.polygons.some(poly => contains(p, poly))) return 0;
  return Math.min(...scene.polygons.flatMap(poly => poly.map((a, i) =>
    terrainPointSegmentDistance(p, a, poly[(i + 1) % poly.length]))));
}
export function studySample(scene, p, radius = 11) {
  const b = scene.bridge;
  const dx = p.x - b.worldX, dy = p.y - b.worldY;
  const angle = b.angleMilliradians / 1000;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  const across = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const bridge = Math.abs(along) <= b.halfLength && Math.abs(across) <= b.halfWidth - radius;
  const waterDistance = studyWaterDistance(scene, p);
  const rock = scene.rocks.some(r => Math.hypot(r.x - p.x, r.y - p.y) <= r.radius + radius);
  return { walkable: !rock && (bridge || waterDistance > radius),
    placeable: !rock && waterDistance > radius + 24
      && !(Math.abs(along) < b.halfLength + 35 + radius && Math.abs(across) < 48 + radius),
    surface: rock ? 'rock' : bridge ? 'bridge' : waterDistance <= radius ? 'water' : 'land', along };
}
export function studyCanMove(scene, from, to, radius = 11) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (!Number.isFinite(length) || length > 256) throw new Error('Study movement bound exceeded.');
  const steps = Math.max(1, Math.ceil(length / 4));
  for (let i = 0; i <= steps; i++) {
    if (!studySample(scene, { x: from.x + (to.x - from.x) * i / steps,
      y: from.y + (to.y - from.y) * i / steps }, radius).walkable) return false;
  }
  return true;
}
export function buildWaterStudy(seed = 'alder') {
  const { westBay, neckIndex, main, ...scene } = buildRiverLakeLayout(seed);
  const { points, widths, bridge } = scene;
  // A real bank-following route, sampled alongside the ribbon, at unchanged live walking speed.
  scene.route = points.flatMap((p, i) => i >= 50 && i <= neckIndex ? [{
    x: p.x + (main[i].x - p.x) / widths[i] * (widths[i] + 45),
    y: p.y + (main[i].y - p.y) / widths[i] * (widths[i] + 45)
  }] : []);
  const shoreRoute = westBay.map((p, i) => {
    const a = westBay[Math.max(0, i - 1)], b = westBay[Math.min(westBay.length - 1, i + 1)];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: p.x + (b.y - a.y) / length * 45, y: p.y - (b.x - a.x) / length * 45 };
  }).reverse();
  scene.route.push(...shoreRoute.slice(1));
  // main's first side is west, outside the tributary junction.
  scene.routeLength = scene.route.slice(1).reduce((sum, p, i) =>
    sum + Math.hypot(p.x - scene.route[i].x, p.y - scene.route[i].y), 0);
  for (let i = 0; i < 180; i++) {
    const x = Math.round((studyHash(`${seed}:x:${i}`) - 0.5) * 4400);
    const y = Math.round(-9700 + studyHash(`${seed}:y:${i}`) * 12800);
    const radius = 18 + Math.floor(studyHash(`${seed}:r:${i}`) * 13);
    if (studyWaterDistance(scene, { x, y }) < radius + 65
      || scene.route.some(p => Math.hypot(p.x - x, p.y - y) < radius + 45)
      || Math.hypot(x - bridge.worldX, y - bridge.worldY) < 220) continue;
    scene.rocks.push({ id: `${seed}:rock:${i}`, x, y, radius });
  }
  return scene;
}

// A bounded ownership/reach experiment: one complete feature, selected by influence intersection.
// This is intentionally not an infinite regional network or the production transport protocol.
export function queryWaterStudy(scene, bounds) {
  if (!bounds || !['minX', 'minY', 'maxX', 'maxY'].every(k => Number.isFinite(bounds[k]))
    || bounds.minX > bounds.maxX || bounds.minY > bounds.maxY
    || bounds.maxX - bounds.minX > 6000 || bounds.maxY - bounds.minY > 6000) {
    throw new Error('Study query bound exceeded.');
  }
  return scene.polygons.filter(poly => Math.min(...poly.map(p => p.x)) - 24 <= bounds.maxX
    && Math.max(...poly.map(p => p.x)) + 24 >= bounds.minX
    && Math.min(...poly.map(p => p.y)) - 24 <= bounds.maxY
    && Math.max(...poly.map(p => p.y)) + 24 >= bounds.minY);
}

// Shared spatial contract. Publication/ownership/terrain checks belong to the server transaction.
import { constructionHomeFootprint, DEFAULT_HOME_DESIGN } from './forest-construction-design.js';
import { orchardPlacementAllowed, orchardYardContains, ORCHARD_PLANTING_RADIUS } from './forest-orchard.js';

export const HOME_LAYOUT_VERSION = 1;
const point = p => p && Object.keys(p).length === 2 && ['x', 'y'].every(k =>
  Number.isSafeInteger(p[k]) && Math.abs(p[k]) <= 1e9 - 4000);
const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const rectDistance = (p, r) => Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX),
  Math.max(r.minY - p.y, 0, p.y - r.maxY));

export function validateHomeLayout(layout) {
  if (!layout || Object.keys(layout).length !== 5 || layout.version !== HOME_LAYOUT_VERSION
    || !point(layout.home) || !point(layout.parking) || !Array.isArray(layout.approach)
    || !Array.isArray(layout.route)) return false;
  const { home, parking, approach, route } = layout;
  if (parking.x !== home.x || parking.y !== home.y + 90) return false;
  for (const [path, maximum] of [[approach, 5], [route, 3]]) {
    if (path.length < 2 || path.length > maximum || !path.every(point)) return false;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      if ((a.x === b.x) === (a.y === b.y) || Math.hypot(a.x - b.x, a.y - b.y) > 7200) return false;
    }
  }
  return approach.at(-1).x === parking.x && approach.at(-1).y === parking.y
    && route[0].x === parking.x && route[0].y === parking.y;
}

export function homeLayoutFromPlan(plan) {
  if (plan?.status !== 'ready') throw new Error('HOME_SITE_UNAVAILABLE');
  const layout = { version: HOME_LAYOUT_VERSION, home: { ...plan.home }, parking: { ...plan.parking },
    approach: plan.approach.map(p => ({ ...p })), route: plan.route.map(p => ({ ...p })) };
  if (!validateHomeLayout(layout)) throw new Error('HOME_LAYOUT_UNSUPPORTED');
  return layout;
}

// A terrain reservation captures continuity; it is not a blanket ban on owner gardening.
// Callers must distinguish generated writing from owner-authored placement.
export function homePlacementAllowed(layout, { x, y, radius, writer }) {
  if (!validateHomeLayout(layout)) throw new Error('HOME_LAYOUT_UNSUPPORTED');
  if (!['writing', 'garden', 'marker'].includes(writer) || ![x, y, radius].every(Number.isFinite)
    || radius < 0 || radius > 256) throw new Error('HOME_RESERVATION_INVALID_QUERY');
  const p = { x, y }, { home, parking } = layout;
  const structure = constructionHomeFootprint(home, DEFAULT_HOME_DESIGN);
  if (rectDistance(p, structure) <= radius) return false;
  if (Math.hypot(x - parking.x, y - parking.y) <= 84 + radius) return false;
  for (const [path, width] of [[[{ x: 0, y: 0 }, ...layout.approach], 12], [layout.route, 84]]) {
    if (path.slice(1).some((b, i) => distanceToSegment(p, path[i], b) <= width + radius)) return false;
  }
  // New generated trees also stay out of the wider home yard. Gardening and markers may use it.
  return writer !== 'writing' || rectDistance(p, { minX: home.x - 160, maxX: home.x + 160,
    minY: home.y - 180, maxY: home.y + 180 }) > radius;
}

export function homeTerrainBounds(layout) {
  if (!validateHomeLayout(layout)) throw new Error('HOME_LAYOUT_UNSUPPORTED');
  const points = [...layout.approach, ...layout.route];
  return { minX: Math.min(layout.home.x - 160, ...points.map(p => p.x - 84)),
    maxX: Math.max(layout.home.x + 160, ...points.map(p => p.x + 84)),
    minY: Math.min(layout.home.y - 180, ...points.map(p => p.y - 84)),
    maxY: Math.max(layout.home.y + 180, ...points.map(p => p.y + 84)) };
}

export function orchardPlantingSpace(layout, parking, orchard, point) {
  const radius = ORCHARD_PLANTING_RADIUS;
  return orchardYardContains(layout.home, point)
    && homePlacementAllowed(layout, { ...point, radius, writer: 'garden' })
    && Math.hypot(point.x - parking.worldX, point.y - parking.worldY) > 110 + radius
    && (!orchard || orchardPlacementAllowed(layout, orchard, point, radius));
}

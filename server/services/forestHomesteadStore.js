import ForestHomestead from '../db/models/ForestHomestead.js';
import { validateHomestead, ForestHomesteadError } from './forestHomesteadRecord.js';
import { homePlacementAllowed } from '../../public/js/forest-home-reservations.js';
import { orchardPaths, orchardPlacementAllowed, orchardPlanting, orchardRoad } from '../../public/js/forest-orchard.js';

export async function readForestHomesteadStore({ ownerUserId, world, session = null, HomeModel = ForestHomestead }) {
  if (world.schemaVersion === 1) return null;
  if (world.schemaVersion !== 2) throw new ForestHomesteadError('HOME_MIGRATION_REQUIRED');
  const scope = { ownerUserId, forestId: world.forestId };
  let query = HomeModel.findOne(scope);
  if (session) query = query.session(session);
  const home = validateHomestead(await query.lean(), scope);
  if (!home) throw new ForestHomesteadError('HOME_UNAVAILABLE');
  return home;
}

export function homesteadPlacementAllowed(home, { worldX, worldY, radius = 17, writer = 'marker' }) {
  if (!home) return true;
  // This apron covers the entire compound cart AND every supported dismount path.
  return Math.hypot(worldX - home.parking.worldX, worldY - home.parking.worldY) > 110 + radius
    && homePlacementAllowed(home.layout, { x: worldX, y: worldY, radius, writer })
    && (!home.orchard || orchardPlacementAllowed(home.layout, home.orchard, { x: worldX, y: worldY }, radius));
}

export async function inspectForestHomesteadReservation({ ownerUserId, world, session, ...candidate }) {
  return homesteadPlacementAllowed(await readForestHomesteadStore({ ownerUserId, world, session }), candidate);
}

// An explicit conservative circle cover: spacing 120, radius 120 covers corridor width 84
// (sqrt(60² + 84²) < 120); the yard grid covers every corner, not just a center sample.
// Captured ONLY into a new activation, never added to already published terrain.
export function homesteadTerrainProtections(home) {
  if (!home) return [];
  const points = [], { layout } = home;
  const add = (x, y, radius = 120) => points.push({ id: `home:${home.layoutId}:${points.length}`, x, y, radius });
  for (let x = -160; x <= 160; x += 80) for (let y = -180; y <= 180; y += 90) add(layout.home.x + x, layout.home.y + y);
  const orchard = home.orchard ? orchardPaths(layout, home.orchard.site) : [];
  for (const path of [layout.approach, layout.route, ...orchard]) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 120);
    for (let j = 0; j <= n; j++) add(Math.round(a.x + (b.x - a.x) * j / n), Math.round(a.y + (b.y - a.y) * j / n));
  }
  if (home.orchard) for (const index of [0, 1]) {
    const tree = orchardPlanting(home.orchard, index);
    if (tree) add(tree.x, tree.y);
  }
  add(Math.round(home.parking.worldX), Math.round(home.parking.worldY));
  if (home.orchard) {
    const { cairn } = orchardRoad(layout, home.orchard.site);
    add(cairn.x, cairn.y, 24);
  }
  return points;
}

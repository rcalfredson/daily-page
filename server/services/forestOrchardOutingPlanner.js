import { amberClearingStone } from '../../public/js/forest-amber-clearing.js';
import { orchardRoad } from '../../public/js/forest-orchard.js';
import { ORCHARD_SPUR_LENGTHS, OUTING_TURN_RADIUS, provisionerSite,
  walledOrchardSite, worldPoint } from '../../public/js/forest-orchard-outing.js';
import { terrainPointSegmentDistance } from '../../public/js/owner-forest-terrain.js';

export function outingBounds(points, margin) {
  return { minX: Math.min(...points.map(p => p.x)) - margin, maxX: Math.max(...points.map(p => p.x)) + margin,
    minY: Math.min(...points.map(p => p.y)) - margin, maxY: Math.max(...points.map(p => p.y)) + margin };
}

function areaClear(land, { a, b, width }, authored = []) {
  const distance = p => a === b ? Math.hypot(p.x - a.x, p.y - a.y) : terrainPointSegmentDistance(p, a, b);
  if ([...land.obstacles, ...authored].some(p => distance(p) <= width + p.radius)) return false;
  const bounds = outingBounds([a, b], width);
  // Sample the capsule with overlapping terrain discs, including both center points.
  if (![a, b].every(p => land.terrainAt(worldPoint(p, 18)).walkable)) return false;
  for (let x = bounds.minX; x <= bounds.maxX + 12; x += 18) {
    for (let y = bounds.minY; y <= bounds.maxY + 12; y += 18) {
      if (distance({ x, y }) <= width + 12 && !land.terrainAt(worldPoint({ x, y }, 18)).walkable) return false;
    }
  }
  return true;
}

const placesSolids = (land, solids) => solids.every(disc => land.terrainAt(disc).placeable
  && land.obstacles.every(o => Math.hypot(o.x - disc.worldX, o.y - disc.worldY) > o.radius + disc.radius));

export function provisionerFits(stall, land) {
  return stall && placesSolids(land, stall.solids) && areaClear(land, stall.road) && areaClear(land, stall.footpath)
    && [stall.turn, stall.bay].every(p => areaClear(land, { a: p, b: p, width: OUTING_TURN_RADIUS }));
}

export function hearthFits(hearth, stall, land) {
  const stalls = stall.solids.map(({ worldX: x, worldY: y, radius }) => ({ x, y, radius }));
  return placesSolids(land, [hearth.solid])
    && hearth.reservations.every(reservation => areaClear(land, reservation, stalls));
}

export function hearthObstacleDiscs({ reservations }) {
  return reservations.flatMap(({ a, b, width }) => {
    if (a === b) return [{ ...a, radius: width }];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 16);
    return Array.from({ length: steps + 1 }, (_, i) => ({
      x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps, radius: width + 2
    }));
  });
}

export function planWalledOrchard(layout, site, stall, land) {
  const road = orchardRoad(layout, site);
  const authored = [{ ...amberClearingStone(layout.route), radius: 27 }, { ...road.cairn, radius: 16 },
    ...road.branches.map(({ tree }) => ({ ...tree, radius: 16 }))];
  return ORCHARD_SPUR_LENGTHS.find(length => {
    const orchard = walledOrchardSite(layout, site, length);
    const art = [...authored, ...stall.solids.map(d => ({ x: d.worldX, y: d.worldY, radius: d.radius }))];
    return placesSolids(land, orchard.solids)
      && areaClear(land, orchard.road, art)
      && areaClear(land, { a: orchard.apron, b: orchard.apron, width: OUTING_TURN_RADIUS }, art)
      && orchard.footpath.every(path => areaClear(land, path, art));
  });
}

export function walledOrchardBounds(layout, site) {
  return outingBounds(ORCHARD_SPUR_LENGTHS.flatMap(length => {
    const orchard = walledOrchardSite(layout, site, length);
    return [orchard.fork, orchard.apron, ...orchard.stones];
  }), 110);
}

export function provisionerBounds(layout, side) {
  const stall = provisionerSite(layout, side);
  return stall && outingBounds([stall.turn, stall.bay, stall.stall,
    ...stall.footprint.map(d => ({ x: d.worldX, y: d.worldY }))], 110);
}

import { terrainPointSegmentDistance } from '../../public/js/owner-forest-terrain.js';
import { orchardPlantingSpace } from '../../public/js/forest-home-reservations.js';
import { orchardForkFits, orchardRoad, ORCHARD_FORK_CANDIDATES, ORCHARD_BRANCH_CANDIDATES, ORCHARD_BRANCH_WIDTH,
  ORCHARD_TRUNK_WIDTH, ORCHARD_ROAD_WIDTH, ORCHARD_PLANTING_RADIUS, ORCHARD_CAIRN_RADIUS,
  ORCHARD_TREE_RADIUS } from '../../public/js/forest-orchard.js';

const disc = (point, radius) => ({ worldX: point.x, worldY: point.y, radius });

export function orchardGroundAllows(land, point, radius = ORCHARD_PLANTING_RADIUS) {
  return land.terrainAt(disc(point, radius)).placeable
    && land.obstacles.every(o => Math.hypot(o.x - point.x, o.y - point.y) > (o.collisionRadius ?? o.radius) + radius);
}

export function planForestOrchard(layout, parking, roadLand, yardLand) {
  const plotCandidates = [1, -1].flatMap(sign => [125, 140, 105, 82, 58, 32, 0].flatMap(x =>
    [-54, -106, 0, 43, -151, 144].map(y => ({ x: layout.home.x + sign * x, y: layout.home.y + y }))));
  const plots = plotCandidates.filter(p => orchardPlantingSpace(layout, parking, null, p) && orchardGroundAllows(yardLand, p));
  if (!plots.some(p => plots.some(q => Math.hypot(p.x - q.x, p.y - q.y) >= 52))) return null;

  function clearRoad(a, b, width) {
    if (roadLand.obstacles.some(o => terrainPointSegmentDistance(o, a, b) <= o.radius + width)) return false;
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    const steps = Math.ceil(distance / 24), columns = Math.ceil(width * 2 / 24);
    for (let step = 0; step <= steps; step++) {
      for (let col = 0; col <= columns; col++) {
        const across = -width + 2 * width * col / columns;
        const point = { x: a.x + dx * step / steps - dy * across / distance,
          y: a.y + dy * step / steps + dx * across / distance };
        if (!roadLand.terrainAt(disc(point, 18)).walkable) return false;
      }
    }
    return true;
  }

  function clearApron(p) {
    if (roadLand.obstacles.some(o => Math.hypot(o.x - p.x, o.y - p.y) <= o.radius + ORCHARD_ROAD_WIDTH)) return false;
    for (let dx = -84; dx <= 84; dx += 21) for (let dy = -84; dy <= 84; dy += 21) {
      if (Math.hypot(dx, dy) <= ORCHARD_ROAD_WIDTH
        && !roadLand.terrainAt(disc({ x: p.x + dx, y: p.y + dy }, 18)).walkable) return false;
    }
    return true;
  }

  for (const forkDistance of ORCHARD_FORK_CANDIDATES) {
    if (!orchardForkFits(layout, forkDistance)) continue;
    const road = orchardRoad(layout, { forkDistance, branchDistance: ORCHARD_BRANCH_CANDIDATES[0] });
    const { end, fork } = road;
    if ((road.extendsAmber && !clearRoad(end, fork, ORCHARD_TRUNK_WIDTH)) || !clearApron(fork)
      || !orchardGroundAllows(roadLand, road.cairn, ORCHARD_CAIRN_RADIUS)) continue;
    const branchDistances = [0, 1].map(index => ORCHARD_BRANCH_CANDIDATES.find(branchDistance => {
      const { apron, tree } = orchardRoad(layout, { forkDistance, branchDistance }).branches[index];
      return clearRoad(fork, tree, ORCHARD_BRANCH_WIDTH) && clearApron(apron)
        && roadLand.terrainAt(disc(tree, ORCHARD_TREE_RADIUS)).placeable;
    }));
    if (!branchDistances.every(Boolean)) continue;
    const site = { version: 2, forkDistance, branchDistances, plots: [] };
    const available = plots.filter(p => orchardPlantingSpace(layout, parking, { site, stages: [] }, p));
    const first = available.find(p => available.some(q => Math.hypot(p.x - q.x, p.y - q.y) >= 52));
    if (first) return { ...site, plots: [first, available.find(p => Math.hypot(p.x - first.x, p.y - first.y) >= 52)] };
  }
  return null;
}

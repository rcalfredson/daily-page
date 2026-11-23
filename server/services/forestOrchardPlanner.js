import { terrainPointSegmentDistance } from '../../public/js/owner-forest-terrain.js';
import { homePlacementAllowed } from '../../public/js/forest-home-reservations.js';
import { orchardPlotLane, orchardRoad, ORCHARD_FORK_DISTANCES, ORCHARD_BRANCH_DISTANCES, ORCHARD_ROAD_WIDTH,
  ORCHARD_TREE_RADIUS } from '../../public/js/forest-orchard.js';

const disc = (point, radius) => ({ worldX: point.x, worldY: point.y, radius });

export function planForestOrchard(layout, parking, roadLand, yardLand) {
  function clearYardLane(plot) {
    const lane = orchardPlotLane(layout.home, plot);
    return lane.slice(1).every((b, i) => {
      const a = lane[i], steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 18);
      if (yardLand.obstacles.some(o => terrainPointSegmentDistance(o, a, b) <= o.radius + 18)) return false;
      for (let step = 0; step <= steps; step++) {
        const p = { x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps };
        if (!yardLand.terrainAt(disc(p, 22)).walkable) return false;
      }
      return true;
    });
  }
  const clearPlot = p => homePlacementAllowed(layout, { ...p, radius: 25, writer: 'garden' })
    && Math.hypot(p.x - parking.worldX, p.y - parking.worldY) > 135
    && yardLand.terrainAt(disc(p, 24)).placeable
    && yardLand.obstacles.every(o => Math.hypot(o.x - p.x, o.y - p.y) > o.radius + 25) && clearYardLane(p);
  const plotCandidates = [1, -1].flatMap(sign => [125, 140].flatMap(x => [0, -54, -106, 43].map(y =>
    ({ x: layout.home.x + sign * x, y: layout.home.y + y })))).filter(clearPlot);
  const first = plotCandidates[0], second = first && plotCandidates.find(p => Math.hypot(p.x - first.x, p.y - first.y) >= 52);
  if (!second) return null;

  function clearRoad(a, b) {
    if (roadLand.obstacles.some(o => terrainPointSegmentDistance(o, a, b) <= o.radius + ORCHARD_ROAD_WIDTH)) return false;
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    const steps = Math.ceil(distance / 24);
    for (let step = 0; step <= steps; step++) {
      for (const across of [-84, -60, -36, -12, 12, 36, 60, 84]) {
        const point = { x: a.x + dx * step / steps - dy * across / distance,
          y: a.y + dy * step / steps + dx * across / distance };
        if (!roadLand.terrainAt(disc(point, 18)).walkable) return false;
      }
    }
    return true;
  }

  function clearApron(p) {
    return [-72, -48, -24, 0, 24, 48, 72].every(dx => [-72, -48, -24, 0, 24, 48, 72]
      .every(dy => roadLand.terrainAt(disc({ x: p.x + dx, y: p.y + dy }, 18)).walkable));
  }
  for (const forkDistance of ORCHARD_FORK_DISTANCES) {
    for (const branchDistance of ORCHARD_BRANCH_DISTANCES) {
      const site = { version: 1, forkDistance, branchDistance, plots: [first, second] };
      const { end, fork, branches } = orchardRoad(layout, site);
      if (!clearRoad(end, fork) || !clearApron(fork)) break;
      if (branches.every(({ apron, tree }) => clearRoad(fork, tree) && clearApron(apron)
        && roadLand.terrainAt(disc(tree, ORCHARD_TREE_RADIUS)).placeable)) return site;
    }
  }
  return null;
}

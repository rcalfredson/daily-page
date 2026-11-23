import { terrainPointSegmentDistance } from './owner-forest-terrain.js';

export const ORCHARD_FORK_DISTANCES = [840, 1060, 680];
export const ORCHARD_BRANCH_DISTANCES = [490, 660, 390];
export const ORCHARD_ROAD_WIDTH = 84;
export const ORCHARD_TREE_RADIUS = 16;
export const ORCHARD_STAGES = ['undiscovered', 'seed', 'planted', 'harvested'];
export const ORCHARD_ACTIONS = ['orchard-survey', 'orchard-collect', 'orchard-plant', 'orchard-harvest'];

const families = [
  { name: 'Quince', leaf: ['#66744b', '#87904d', '#a0a168'], varieties: [
    ['Copper quince', 'quince-copper', ['#c9895d', '#a56143', '#e6ad75']],
    ['Honey quince', 'quince-honey', ['#e9c96c', '#af821e', '#ffe49b']],
    ['Rose quince', 'quince-rose', ['#cf8c86', '#a96266', '#efaea1']]
  ] },
  { name: 'Damson', leaf: ['#3f615a', '#557b62', '#729584'], varieties: [
    ['Ink damson', 'damson-ink', ['#777ca9', '#525b84', '#a2abcb']],
    ['Mulberry damson', 'damson-mulberry', ['#92749a', '#73547f', '#b99fb9']],
    ['Silver damson', 'damson-silver', ['#d7d8d4', '#9b9d99', '#efeee9']]
  ] }
];

const variants = families.flatMap(family => family.varieties);
export const ORCHARD_DYE_OPTIONS = variants.map(([name, id]) => [id, name]);
export const ORCHARD_DYE_PALETTES = Object.fromEntries(variants.map(([, id, palette]) => [id, palette]));

function orchardHash(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function orchardVariety(forestId, index) {
  const family = families[index], variant = orchardHash(`${forestId}:orchard:${index}`) % family.varieties.length;
  const [name, dye, palette] = family.varieties[variant];
  return { name, dye, palette, leaf: family.leaf, variant };
}

export function orchardTreeForm(forestId, index, point) {
  const seed = orchardHash(`${forestId}:orchard-tree:${index}:${point.x}:${point.y}`);
  return { width: .89 + (seed & 255) / 255 * .22, height: .9 + ((seed >>> 8) & 255) / 255 * .2,
    lean: (((seed >>> 16) & 255) / 255 - .5) * .2 };
}

export function availableOrchardDyes(record) {
  return (record?.orchard?.stages || []).flatMap((stage, index) =>
    stage === 'harvested' ? [orchardVariety(record.forestId, index).dye] : []);
}

const offset = (point, direction, length) => ({ x: point.x + direction.x * length, y: point.y + direction.y * length });

export function orchardRoad(layout, { forkDistance, branchDistance }) {
  const end = layout.route.at(-1), before = layout.route.at(-2);
  const direction = { x: Math.sign(end.x - before.x), y: Math.sign(end.y - before.y) };
  const fork = offset(end, direction, forkDistance);
  const branches = [1, -1].map(sign => {
    const side = { x: sign * direction.y, y: -sign * direction.x };
    return { cue: offset(offset(fork, side, 123), direction, 37), apron: offset(fork, side, branchDistance),
      tree: offset(fork, side, branchDistance + 113) };
  });
  return { end, fork, branches, route: [...layout.route.slice(0, -1), fork] };
}

export function orchardPaths(layout, site) {
  const { end, fork, branches } = orchardRoad(layout, site);
  return [[end, fork], ...branches.map(({ tree }) => [fork, tree])];
}

export function orchardPlotLane(home, plot) {
  const side = Math.sign(plot.x - home.x), edge = plot.x + side * 54;
  return [{ x: home.x + side * 92, y: home.y + 90 }, { x: edge, y: home.y + 90 }, { x: edge, y: plot.y }];
}

export function orchardPlacementAllowed(layout, site, point, radius) {
  return site.plots.every(plot => {
    const lane = orchardPlotLane(layout.home, plot);
    return Math.hypot(plot.x - point.x, plot.y - point.y) > 25 + radius
      && lane.slice(1).every((b, i) => terrainPointSegmentDistance(point, lane[i], b) > 18 + radius);
  })
    && orchardPaths(layout, site).every(([a, b]) =>
      terrainPointSegmentDistance(point, a, b) > ORCHARD_ROAD_WIDTH + radius);
}

export function orchardTreeBlocks(tree, disc, from) {
  const limit = ORCHARD_TREE_RADIUS + disc.radius;
  const distance = Math.hypot(tree.x - disc.worldX, tree.y - disc.worldY);
  if (distance > limit) return false;
  // A tree may be planted under the player. An overlapping walker may step outward.
  const before = from ? Math.hypot(tree.x - from.worldX, tree.y - from.worldY) : Infinity;
  return before > limit || distance <= before;
}

export function orchardPlotApproach(home, plot, player) {
  if (Math.hypot(plot.x - player.worldX, plot.y - player.worldY) <= 49 || player.worldY < plot.y + 28) return null;
  const side = Math.sign(plot.x - home.x), yardFront = home.y + 22;
  // Approach the row from the open side, so the first tree and house cannot hide the second plot.
  if (side * (player.worldX - plot.x) < 48) {
    return player.worldY < yardFront - 10
      ? { worldX: player.worldX, worldY: yardFront, label: 'Yard edge' }
      : { worldX: plot.x + side * 62, worldY: player.worldY, label: 'Yard edge' };
  }
  return { worldX: player.worldX, worldY: plot.y, label: 'Yard edge' };
}

export function orchardReturnWaypoint(road, player) {
  const point = { x: player.worldX, y: player.worldY };
  if (Math.hypot(point.x - road.fork.x, point.y - road.fork.y) <= 27) return null;
  const trunkDistance = terrainPointSegmentDistance(point, road.end, road.fork);
  return road.branches.some(({ tree }) => {
    const distance = terrainPointSegmentDistance(point, road.fork, tree);
    return distance <= ORCHARD_ROAD_WIDTH && distance < trunkDistance;
  }) ? { worldX: road.fork.x, worldY: road.fork.y, label: 'Fork' } : null;
}

export function orchardStonePassage(road, player, returning) {
  const dx = Math.sign(road.fork.x - road.end.x), dy = Math.sign(road.fork.y - road.end.y);
  const relativeX = player.worldX - road.end.x, relativeY = player.worldY - road.end.y;
  const along = relativeX * dx + relativeY * dy;
  const lateral = relativeX * Math.abs(dy) - relativeY * Math.abs(dx);
  const progress = returning ? -along : along;
  // Ease onto the open shoulder early, then hold the heading until the animal and cart have passed.
  if (progress < -370 || progress > 95 || Math.abs(lateral) > ORCHARD_ROAD_WIDTH) return null;
  const side = Math.min(-37, lateral), lead = lateral <= -20 ? 75 : 30;
  const guide = offset({ x: road.end.x + Math.abs(dy) * side, y: road.end.y - Math.abs(dx) * side },
    { x: dx, y: dy }, along + (returning ? -lead : lead));
  return { worldX: guide.x, worldY: guide.y, label: 'Trail' };
}

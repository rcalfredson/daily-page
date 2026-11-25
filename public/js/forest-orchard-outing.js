import { cartFootprint } from './forest-cart-motion.js';
import { DEFAULT_CART_DESIGN } from './forest-construction-design.js';
import { orchardRoad } from './forest-orchard.js';
import { terrainPointSegmentDistance } from './owner-forest-terrain.js';

export const PROVISIONER_SIDES = [-1, 1];
export const ORCHARD_SPUR_LENGTHS = [580, 460, 720];
export const OUTING_TURN_RADIUS = 84;
const BAY_WIDTH = 56, SPUR_WIDTH = 52, FOOT_WIDTH = 18;
export const worldPoint = ({ x, y }, radius) => ({ worldX: x, worldY: y, radius });

export function provisionerSite(layout, side) {
  const [home, next] = layout.route;
  const length = Math.hypot(next.x - home.x, next.y - home.y);
  if (length < 550) return null;
  const dx = Math.sign(next.x - home.x), dy = Math.sign(next.y - home.y);
  const along = Math.min(Math.round(length * .68), length - 180);
  const point = (forward, across) => ({ x: home.x + dx * (along + forward) - dy * across * side,
    y: home.y + dy * (along + forward) + dx * across * side });
  const turn = point(0, 0), bay = point(0, 104), stall = point(-52, 256);
  const tansy = worldPoint(point(42, 240), 12);
  const cart = { ...worldPoint(point(105, 258)), heading: Math.atan2(dy, dx),
    design: { ...DEFAULT_CART_DESIGN, wood: 'sage', cloth: 'ochre' } };
  const footprint = [tansy, ...cartFootprint(cart, { animal: false })];
  return { turn, bay, stall, sign: point(-34, 104), tansy, cart, footprint,
    road: { a: turn, b: bay, width: BAY_WIDTH }, footpath: { a: bay, b: point(0, 236), width: FOOT_WIDTH },
    solids: [worldPoint(stall, 24), ...footprint] };
}

export function walledOrchardSite(layout, site, spurLength) {
  const { end, fork } = orchardRoad(layout, site), before = layout.route.at(-2);
  const dx = Math.sign(end.x - before.x), dy = Math.sign(end.y - before.y);
  const apron = { x: fork.x + dx * spurLength - dy * Math.round(spurLength * .7),
    y: fork.y + dy * spurLength + dx * Math.round(spurLength * .7) };
  const point = (forward, across) => ({ x: apron.x + dx * forward - dy * across,
    y: apron.y + dy * forward + dx * across });
  const opening = point(119, 34), tree = point(183, -8);
  const stones = [
    ...[-56, -42, -28, -14, 0, 69].map(a => point(119, a)),
    ...[133, 147, 161, 175, 189, 203, 217, 231].flatMap(f => [point(f, -56), point(f, 69)]),
    ...[-42, -28, -14, 0, 14, 28, 42, 56].map(a => point(231, a))
  ];
  return { fork, apron, opening, tree, stones, road: { a: fork, b: apron, width: SPUR_WIDTH },
    footpath: [{ a: apron, b: opening, width: FOOT_WIDTH }, { a: opening, b: tree, width: FOOT_WIDTH }],
    solids: [...stones.map(p => worldPoint(p, 9)), worldPoint(tree, 16)],
    inside: p => (p.worldX - apron.x) * dx + (p.worldY - apron.y) * dy > 125 };
}

export function outingReservations(stall, orchard) {
  return [stall.road, stall.footpath, orchard.road, ...orchard.footpath,
    ...[stall.turn, stall.bay, orchard.apron].map(p => ({ a: p, b: p, width: OUTING_TURN_RADIUS })),
    ...[...stall.solids, ...orchard.solids].map(({ worldX: x, worldY: y, radius }) => {
      const p = { x, y };
      return { a: p, b: p, width: radius };
    })];
}

export function outingPlacementAllowed(layout, orchard, point, radius) {
  const { provisionerSide, spurLength } = orchard.outing;
  return outingReservations(provisionerSite(layout, provisionerSide), walledOrchardSite(layout, orchard.site, spurLength))
    .every(({ a, b, width }) => (a === b ? Math.hypot(point.x - a.x, point.y - a.y)
      : terrainPointSegmentDistance(point, a, b)) > radius + width);
}

export function outingBlocks(solids, disc, from) {
  return solids.some(part => {
    const distance = Math.hypot(disc.worldX - part.worldX, disc.worldY - part.worldY);
    return distance <= disc.radius + part.radius && (!from
      || distance <= Math.hypot(from.worldX - part.worldX, from.worldY - part.worldY));
  });
}

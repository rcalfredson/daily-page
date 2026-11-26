import ForestWritingTree from '../db/models/ForestWritingTree.js';
import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import { validateTree, validateMarker } from './forestAuthoredPlacement.js';
import { readForestGardenStore } from './forestGardenStore.js';
import { readForestOwnerTerrain } from './forestOwnerTerrain.js';
import { sampleOwnerTerrain } from '../../public/js/owner-forest-terrain-authority.js';
import { cartPoseClear, cartDismount, discIntersectsRectangle } from '../../public/js/forest-cart-motion.js';
import { constructionHomeFootprint, DEFAULT_CART_DESIGN } from '../../public/js/forest-construction-design.js';
import { amberClearingStone, amberClearingStoneFootprint } from '../../public/js/forest-amber-clearing.js';
import { orchardCairnBlocks, orchardRoad, orchardTreeBlocks, orchardPlanting, orchardPlacementAllowed, ORCHARD_FORK_CANDIDATES,
  ORCHARD_BRANCH_CANDIDATES, ORCHARD_CAIRN_ADVANCE, ORCHARD_CAIRN_RADIUS } from '../../public/js/forest-orchard.js';
import { homePlacementAllowed, orchardPlantingSpace } from '../../public/js/forest-home-reservations.js';
import { orchardGroundAllows, planForestOrchard } from './forestOrchardPlanner.js';
import { hearthFits, hearthObstacleDiscs, outingBounds, planWalledOrchard, provisionerBounds, provisionerFits,
  walledOrchardBounds } from './forestOrchardOutingPlanner.js';
import { outingBlocks, outingReservations, reservationsAllow, PROVISIONER_SIDES, preservingHearth, provisionerSite,
  walledOrchardSite } from '../../public/js/forest-orchard-outing.js';
import { planHomeCartSite } from './forestHomeSitePlanner.js';
import { ForestHomesteadError } from './forestHomesteadRecord.js';

const fail = () => { throw new ForestHomesteadError('HOME_GEOGRAPHY_UNAVAILABLE'); };
function withHearthObstacles(land, { layout, village }) {
  return village ? { ...land, obstacles: [...land.obstacles,
    ...hearthObstacleDiscs(preservingHearth(layout, village.provisionerSide))] } : land;
}

export function buildForestHomesteadGeography({ TreeModel = ForestWritingTree, MarkerModel = ForestAuthoredObject,
  readGarden = readForestGardenStore, readTerrain = readForestOwnerTerrain, amberClearingEnabled = () => false } = {}) {
  async function geography({ ownerUserId, world, session }, bounds) {
    const scope = { ownerUserId, forestId: world.forestId };
    const filter = { ...scope,
      'placementIndex.cellX': { $gte: Math.floor((bounds.minX - 150) / 720), $lte: Math.floor((bounds.maxX + 150) / 720) },
      'placementIndex.cellY': { $gte: Math.floor((bounds.minY - 150) / 720), $lte: Math.floor((bounds.maxY + 150) / 720) } };
    async function rows(Model, extra) {
      const result = await Model.find({ ...filter, ...extra }).sort({ _id: 1 }).limit(2049).session(session).lean();
      if (!Array.isArray(result) || result.length > 2048) fail();
      return result;
    }
    // Mongo sessions do not support parallel operations in a transaction.
    const trees = await rows(TreeModel, {}), markers = await rows(MarkerModel, { state: 'active' });
    const garden = await readGarden({ ...scope, session });
    const obstacles = trees.map(t => ({ id: t.writingTreeId, kind: 'tree', x: t.placement.worldX,
      y: t.placement.worldY, radius: validateTree(t, scope) + 16, collisionRadius: validateTree(t, scope) }));
    for (const m of markers) {
      validateMarker(m, scope);
      obstacles.push({ id: m.objectId, kind: 'marker', x: m.placement.worldX, y: m.placement.worldY, radius: 26, collisionRadius: 9 });
    }
    for (const p of garden?.plants || []) obstacles.push({ id: p.plantId, kind: 'plant', x: p.worldX, y: p.worldY, radius: 26, collisionRadius: 9 });
    const scenes = new Map();
    if (world.terrain) {
      for (let x = Math.floor(bounds.minX / 1920); x <= Math.floor(bounds.maxX / 1920); x++) {
        for (let y = Math.floor(bounds.minY / 1920); y <= Math.floor(bounds.maxY / 1920); y++) {
          if (scenes.size >= 25) fail();
          scenes.set(`${x}:${y}`, await readTerrain({ ownerUserId, world, session,
            bounds: { minX: x * 1920, maxX: x * 1920, minY: y * 1920, maxY: y * 1920 } }));
        }
      }
    }
    const terrainAt = p => {
      if (!world.terrain) return { walkable: true, placeable: true };
      const scene = scenes.get(`${Math.floor(p.worldX / 1920)}:${Math.floor(p.worldY / 1920)}`);
      if (!scene) return { walkable: false, placeable: false };
      return sampleOwnerTerrain(scene, { x: p.worldX, y: p.worldY }, p.radius);
    };
    return { obstacles, terrainAt };
  }
  async function planSite(args) {
    const landscape = await geography(args, { minX: -3600, maxX: 3600, minY: -3600, maxY: 3600 });
    const plan = planHomeCartSite(landscape);
    if (plan.status !== 'ready') throw new ForestHomesteadError('HOME_SITE_UNAVAILABLE');
    return plan;
  }
  async function planOrchard({ record, ...args }) {
    const end = record.layout.route.at(-1), home = record.layout.home;
    const reach = Math.max(...ORCHARD_FORK_CANDIDATES) + ORCHARD_CAIRN_ADVANCE + ORCHARD_CAIRN_RADIUS;
    const behind = -Math.min(...ORCHARD_FORK_CANDIDATES) + 120;
    const across = Math.max(...ORCHARD_BRANCH_CANDIDATES) + 240;
    const previous = record.layout.route.at(-2);
    const dx = Math.sign(end.x - previous.x), dy = Math.sign(end.y - previous.y);
    const road = await geography(args, {
      minX: Math.min(end.x - dx * behind, end.x + dx * reach) - Math.abs(dy) * across,
      maxX: Math.max(end.x - dx * behind, end.x + dx * reach) + Math.abs(dy) * across,
      minY: Math.min(end.y - dy * behind, end.y + dy * reach) - Math.abs(dx) * across,
      maxY: Math.max(end.y - dy * behind, end.y + dy * reach) + Math.abs(dx) * across
    });
    const yard = await geography(args, { minX: home.x - 220, maxX: home.x + 220, minY: home.y - 180, maxY: home.y + 180 });
    return planForestOrchard(record.layout, record.parking, withHearthObstacles(road, record), yard);
  }
  async function validateOrchardPlanting({ record, point, ...args }) {
    if (!orchardPlantingSpace(record.layout, record.parking, record.orchard, point)) return false;
    const land = await geography(args, { minX: point.x - 40, maxX: point.x + 40, minY: point.y - 40, maxY: point.y + 40 });
    return orchardGroundAllows(land, point);
  }
  async function checkProvisioner(args, layout, side) {
    const bounds = provisionerBounds(layout, side);
    if (!bounds) return false;
    try {
      return provisionerFits(provisionerSite(layout, side), await geography(args, bounds));
    } catch (error) {
      if (error.code === 'HOME_GEOGRAPHY_UNAVAILABLE') return false;
      throw error;
    }
  }
  async function suggestProvisioner({ record, ...args }) {
    for (const side of PROVISIONER_SIDES) {
      if (await checkProvisioner(args, record.layout, side)) return side;
    }
    return null;
  }
  async function villageAvailable({ record, provisionerSide, ...args }) {
    const { layout, parking, orchard } = record;
    const stall = provisionerSite(layout, provisionerSide), hearth = preservingHearth(layout, provisionerSide);
    if (!hearth) return false;
    const outing = orchard?.outing;
    const wall = outing && walledOrchardSite(layout, orchard.site, outing.spurLength);
    const walls = outingReservations(null, wall);
    if (!hearthObstacleDiscs(hearth).every(({ x, y, radius }) =>
      homePlacementAllowed(layout, { x, y, radius, writer: 'garden' })
      && (!orchard || orchardPlacementAllowed(layout, orchard, { x, y }, radius))
      && reservationsAllow(walls, { x, y }, radius))) return false;
    const newSolids = [hearth.solid, ...(outing ? [] : stall.solids)];
    if (newSolids.some(solid => Math.hypot(solid.worldX - parking.worldX, solid.worldY - parking.worldY) <= 110 + solid.radius)) {
      return false;
    }
    try {
      const land = await geography(args, outingBounds([stall.turn, stall.bay, stall.stall, hearth.hearth, ...hearth.walk,
        ...stall.footprint.map(({ worldX: x, worldY: y }) => ({ x, y }))], 110));
      return (outing || provisionerFits(stall, land)) && hearthFits(hearth, stall, land);
    } catch (error) {
      if (error.code === 'HOME_GEOGRAPHY_UNAVAILABLE') return false;
      throw error;
    }
  }
  async function planOuting({ record, site, provisionerSide, ...args }) {
    const { layout } = record;
    if (!await checkProvisioner(args, layout, provisionerSide)) return null;
    const stall = provisionerSite(layout, provisionerSide);
    try {
      const land = await geography(args, walledOrchardBounds(layout, site));
      return planWalledOrchard(layout, site, stall, withHearthObstacles(land, record));
    } catch (error) {
      if (error.code === 'HOME_GEOGRAPHY_UNAVAILABLE') return null;
      throw error;
    }
  }
  async function arrival({ next, ...args }) {
    const { worldX: x, worldY: y } = next.parking;
    const landscape = await geography(args, { minX: x - 160, maxX: x + 160, minY: y - 160, maxY: y + 160 });
    const house = constructionHomeFootprint(next.layout.home, next.homeDesign);
    const stone = amberClearingEnabled(args.ownerUserId)
      ? amberClearingStoneFootprint(amberClearingStone(next.layout.route)) : null;
    const orchardRoadLayout = next.orchard ? orchardRoad(next.layout, next.orchard.site) : null;
    const orchardTrees = orchardRoadLayout ? [
      ...orchardRoadLayout.branches.map(branch => branch.tree),
      ...[0, 1].map(index => orchardPlanting(next.orchard, index)).filter(Boolean)
    ] : [];
    const outing = next.orchard?.outing;
    const side = outing?.provisionerSide ?? next.village?.provisionerSide, enabled = amberClearingEnabled(args.ownerUserId);
    const stall = side != null && provisionerSite(next.layout, side);
    const outingSolids = [
      ...(stall && enabled ? stall.solids : outing ? stall.solids.slice(0, 1) : []),
      ...(outing ? walledOrchardSite(next.layout, next.orchard.site, outing.spurLength).solids : []),
      ...(enabled && next.village ? [preservingHearth(next.layout, side).solid] : [])
    ];
    const clear = p => Math.abs(p.worldX) + p.radius < 999_980_000 && Math.abs(p.worldY) + p.radius < 999_980_000
      && !discIntersectsRectangle(p, house) && (!stone || !discIntersectsRectangle(p, stone)) && landscape.terrainAt(p).walkable
      && (!orchardRoadLayout || !orchardCairnBlocks(orchardRoadLayout.cairn, p))
      && landscape.obstacles.every(o => Math.hypot(o.x - p.worldX, o.y - p.worldY) > o.collisionRadius + p.radius)
      && orchardTrees.every(tree => !orchardTreeBlocks(tree, p)) && !outingBlocks(outingSolids, p);
    const cart = { ...next.parking, design: next.cartDesign || DEFAULT_CART_DESIGN };
    return cartPoseClear(cart, clear) ? cartDismount(cart, clear) : null;
  }
  return { planSite, planOrchard, planOuting, suggestProvisioner, villageAvailable, validateOrchardPlanting, arrival,
    validatePlacement: async args => Boolean(await arrival(args)) };
}

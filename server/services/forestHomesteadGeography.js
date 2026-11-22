import ForestWritingTree from '../db/models/ForestWritingTree.js';
import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import { validateTree, validateMarker } from './forestAuthoredPlacement.js';
import { readForestGardenStore } from './forestGardenStore.js';
import { readForestOwnerTerrain } from './forestOwnerTerrain.js';
import { sampleOwnerTerrain } from '../../public/js/owner-forest-terrain-authority.js';
import { cartPoseClear, cartDismount, discIntersectsRectangle } from '../../public/js/forest-cart-motion.js';
import { constructionHomeFootprint, DEFAULT_CART_DESIGN } from '../../public/js/forest-construction-design.js';
import { amberClearingStone, amberClearingStoneFootprint } from '../../public/js/forest-amber-clearing.js';
import { planHomeCartSite } from './forestHomeSitePlanner.js';
import { ForestHomesteadError } from './forestHomesteadRecord.js';

const fail = () => { throw new ForestHomesteadError('HOME_GEOGRAPHY_UNAVAILABLE'); };
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
  async function arrival({ next, ...args }) {
    const { worldX: x, worldY: y } = next.parking;
    const landscape = await geography(args, { minX: x - 160, maxX: x + 160, minY: y - 160, maxY: y + 160 });
    const house = constructionHomeFootprint(next.layout.home, next.homeDesign);
    const stone = amberClearingEnabled(args.ownerUserId)
      ? amberClearingStoneFootprint(amberClearingStone(next.layout.route)) : null;
    const clear = p => Math.abs(p.worldX) + p.radius < 999_980_000 && Math.abs(p.worldY) + p.radius < 999_980_000
      && !discIntersectsRectangle(p, house) && (!stone || !discIntersectsRectangle(p, stone)) && landscape.terrainAt(p).walkable
      && landscape.obstacles.every(o => Math.hypot(o.x - p.worldX, o.y - p.worldY) > o.collisionRadius + p.radius);
    const cart = { ...next.parking, design: next.cartDesign || DEFAULT_CART_DESIGN };
    return cartPoseClear(cart, clear) ? cartDismount(cart, clear) : null;
  }
  return { planSite, arrival, validatePlacement: async args => Boolean(await arrival(args)) };
}

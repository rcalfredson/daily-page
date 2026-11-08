import ForestTerrainProtection from '../db/models/ForestTerrainProtection.js';
import { OWNER_TERRAIN_PROOF_CONFIG }
  from '../../public/js/owner-forest-terrain.js';
import { queryOwnerTerrain as queryTerrainProof, sampleOwnerTerrain as sampleTerrainProof }
  from '../../public/js/owner-forest-terrain-authority.js';
import { regionalQueryPlan } from '../../public/js/owner-forest-terrain-regional.js';

export const FOREST_OWNER_TERRAIN_SCHEMA_VERSION = 1;
export const FOREST_OWNER_TERRAIN_GENERATION_VERSION = 3;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export class ForestOwnerTerrainError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ForestOwnerTerrainError';
    this.code = code;
  }
}

function validateDescriptor(terrain) {
  if (terrain.schemaVersion !== FOREST_OWNER_TERRAIN_SCHEMA_VERSION
    || ![3, 4].includes(terrain.generationVersion)
    || !UUID.test(terrain.activationId || '') || terrain.revision !== 1
    || !['preparing', 'active', 'cancelling'].includes(terrain.state)
    || !['trees', 'markers', 'verify', 'ready'].includes(terrain.phase)
    || (terrain.cursor !== null && !/^[a-f0-9]{24}$/.test(terrain.cursor || ''))
    || (terrain.state === 'active' && (terrain.phase !== 'ready' || terrain.cursor !== null))) {
    throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNSUPPORTED');
  }
}
export function validateForestOwnerTerrain(terrain) {
  if (terrain === undefined || terrain === null) return null;
  validateDescriptor(terrain);
  if (terrain.replacement != null) {
    const next = terrain.replacement;
    validateDescriptor(next);
    if (terrain.state !== 'active' || terrain.generationVersion !== 3 || next.generationVersion !== 4
      || next.state === 'active' || next.activationId === terrain.activationId || next.replacement != null
      || next.retiredActivationId != null || terrain.retiredActivationId != null) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNSUPPORTED');
    }
  }
  if (terrain.retiredActivationId != null && (terrain.state !== 'active' || terrain.generationVersion !== 4
    || !UUID.test(terrain.retiredActivationId) || terrain.retiredActivationId === terrain.activationId)) {
    throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNSUPPORTED');
  }
  return terrain;
}

export function assertForestTerrainPlacementReady(world) {
  const terrain = validateForestOwnerTerrain(world.terrain);
  if (terrain && (terrain.state !== 'active' || terrain.replacement != null)) {
    throw new ForestOwnerTerrainError('FOREST_TERRAIN_PREPARING');
  }
  return terrain;
}

// Only activation is gated. Existing terrain remains authoritative when the gate is off.
export function forestLiveTerrainActivationEnabled() {
  return process.env.FOREST_LIVE_TERRAIN_ENABLED === 'true';
}

export function buildForestOwnerTerrainService({ ProtectionModel = ForestTerrainProtection } = {}) {
  return async function readTerrain({ ownerUserId, world, bounds, session = null }) {
    // An upgrade freezes spatial writers while reads continue to use the published descriptor.
    const terrain = validateForestOwnerTerrain(world.terrain);
    if (!terrain) return null;
    if (terrain.state !== 'active') throw new ForestOwnerTerrainError('FOREST_TERRAIN_PREPARING');
    if (ownerUserId !== world.ownerUserId || !/^[a-f0-9]{24}$/.test(ownerUserId || '')
      || world.status !== 'active' || world.schemaVersion !== 1 || world.worldRole !== 'primary'
      || world.placementPolicyVersion !== 1 || world.environmentPolicyVersion !== 1
      || world.environmentSchemaVersion !== 1 || world.worldGenerationVersion !== 1) throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNAVAILABLE');
    // Validate coordinates, region work, and seed before issuing any database read.
    if (typeof world.worldSeed !== 'string' || !world.worldSeed.length || world.worldSeed.length > 80) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNAVAILABLE');
    }
    const generationVersion = terrain.generationVersion;
    const empty = generationVersion === 4 ? regionalQueryPlan(bounds)
      : queryTerrainProof({ seed: world.worldSeed, bounds });
    const xs = empty.districts.map(d => d.column);
    const ys = empty.districts.map(d => d.row);
    // Generation 4 decisions use COMPLETE home regions, independently of requested small cells.
    // The extra district covers neighboring frozen footprints that can cross a region edge.
    const rx = empty.regions?.map(r => r.column), ry = empty.regions?.map(r => r.row);
    const query = ProtectionModel.find({
      ownerUserId, forestId: world.forestId, activationId: terrain.activationId,
      districtX: { $gte: (rx ? Math.min(...rx) * 8 - 4 : Math.min(...xs)) - 1,
        $lte: (rx ? Math.max(...rx) * 8 + 3 : Math.max(...xs)) + 1 },
      districtY: { $gte: (ry ? Math.min(...ry) * 8 - 4 : Math.min(...ys)) - 1,
        $lte: (ry ? Math.max(...ry) * 8 + 3 : Math.max(...ys)) + 1 }
    }, { _id: 0, schemaVersion: 1, sourceKey: 1, x: 1, y: 1, radius: 1, districtX: 1, districtY: 1 })
      .sort({ districtX: 1, districtY: 1, sourceKey: 1 })
      .limit(OWNER_TERRAIN_PROOF_CONFIG.maximumProtections + 1);
    if (session) query.session(session);
    const records = await query.lean();
    if (!Array.isArray(records) || records.length > OWNER_TERRAIN_PROOF_CONFIG.maximumProtections) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_DENSITY_LIMIT');
    }
    for (const record of records) {
      if (record.schemaVersion !== 1
        || record.districtX !== Math.floor(record.x / OWNER_TERRAIN_PROOF_CONFIG.districtSize)
        || record.districtY !== Math.floor(record.y / OWNER_TERRAIN_PROOF_CONFIG.districtSize)) {
        throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNAVAILABLE');
      }
    }
    return queryTerrainProof({ seed: world.worldSeed, bounds, generationVersion,
      records: records.map(r => ({ id: r.sourceKey, x: r.x, y: r.y, radius: r.radius })) });
  };
}

export const readForestOwnerTerrain = buildForestOwnerTerrainService();

export async function inspectForestTerrainPlacement({ ownerUserId, world, worldX, worldY,
  radius = 20, session, cache = null, readTerrain = readForestOwnerTerrain }) {
  assertForestTerrainPlacementReady(world);
  if (!world.terrain) return true;
  const key = `${world.terrain.activationId}:${Math.floor(worldX / 1920)}:${Math.floor(worldY / 1920)}`;
  if (!cache?.has(key)) {
    const pending = readTerrain({ ownerUserId, world,
      bounds: { minX: worldX, maxX: worldX, minY: worldY, maxY: worldY }, session });
    if (cache) cache.set(key, pending);
    else return sampleTerrainProof(await pending, { x: worldX, y: worldY }, radius).placeable;
  }
  const scene = await cache.get(key);
  return sampleTerrainProof(scene, { x: worldX, y: worldY }, radius).placeable;
}

export async function forestTerrainReturnPredicate({ ownerUserId, world, position,
  readTerrain = readForestOwnerTerrain }) {
  if (!world?.terrain || validateForestOwnerTerrain(world.terrain).state !== 'active') return () => true;
  const scene = await readTerrain({ ownerUserId, world, bounds: {
    minX: position.worldX - 120, maxX: position.worldX + 120,
    minY: position.worldY - 120, maxY: position.worldY + 120
  } });
  return candidate => sampleTerrainProof(scene,
    { x: candidate.worldX, y: candidate.worldY }, candidate.radius).walkable;
}

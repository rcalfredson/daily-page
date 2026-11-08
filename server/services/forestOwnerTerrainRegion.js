import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import { readForestOwnerTerrain, validateForestOwnerTerrain, ForestOwnerTerrainError }
  from './forestOwnerTerrain.js';
import { OWNER_TERRAIN_PROOF_CONFIG } from '../../public/js/owner-forest-terrain.js';

export function forestTerrainDescriptor(world) {
  const terrain = validateForestOwnerTerrain(world.terrain);
  if (!terrain || terrain.state !== 'active') return null;
  return { schemaVersion: 1, generationVersion: terrain.generationVersion,
    token: `${terrain.activationId}:${terrain.revision}`, districtSize: OWNER_TERRAIN_PROOF_CONFIG.districtSize,
    regionPath: '/api/v1/forest/terrain-regions' };
}

export function buildForestOwnerTerrainRegionService({ WorldModel = ForestOwnerWorld,
  DeletionModel = AccountDeletionRequest, readTerrain = readForestOwnerTerrain } = {}) {
  return async function readRegion({ ownerUserId, districts, token }) {
    if (!/^[a-f0-9]{24}$/.test(ownerUserId || '') || !Array.isArray(districts)
      || districts.length < 1 || districts.length > 9 || typeof token !== 'string' || token.length > 80
      || new Set(districts.map(d => `${d.cellX}:${d.cellY}`)).size !== districts.length
      || districts.some(d => !Number.isSafeInteger(d.cellX) || !Number.isSafeInteger(d.cellY)
        || Math.abs(d.cellX * 1920) > 999_980_000 || Math.abs(d.cellY * 1920) > 999_980_000)) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_INVALID_INPUT');
    }
    if (await DeletionModel.exists({ ownerUserId, status: { $in: ['processing', 'completed'] } }).lean()) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNAVAILABLE');
    }
    const world = await WorldModel.findOne({ ownerUserId, worldRole: 'primary', status: 'active' }).lean();
    if (!world || forestTerrainDescriptor(world)?.token !== token) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_CHANGED');
    }
    const generated = [], features = new Map();
    for (const { cellX, cellY } of districts) {
      const scene = await readTerrain({ ownerUserId, world, bounds: {
        minX: cellX * 1920, maxX: cellX * 1920, minY: cellY * 1920, maxY: cellY * 1920
      } });
      generated.push(scene.districts[0]);
      for (const feature of scene.features || []) features.set(feature.id, feature);
    }
    // Do not publish stale geometry if account deletion started during the bounded reads.
    if (!await WorldModel.exists({ ownerUserId, forestId: world.forestId, status: 'active',
      'terrain.activationId': world.terrain.activationId, 'terrain.state': 'active',
      'terrain.generationVersion': world.terrain.generationVersion, 'terrain.revision': world.terrain.revision })) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_CHANGED');
    }
    const response = { schemaVersion: 1, generationVersion: world.terrain.generationVersion, token,
      districts: generated, ...(world.terrain.generationVersion === 4 ? { features: [...features.values()] } : {}) };
    if (Buffer.byteLength(JSON.stringify(response)) > 256_000) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_DENSITY_LIMIT');
    }
    return response;
  };
}
export const readForestOwnerTerrainRegion = buildForestOwnerTerrainRegionService();

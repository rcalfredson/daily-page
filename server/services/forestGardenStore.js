import ForestGarden from '../db/models/ForestGarden.js';
import { BLOOM_MS, gardenIntersects } from '../../public/js/forest-garden-rules.js';
export class ForestGardenError extends Error {
  constructor(code) { super(code); this.name = 'ForestGardenError'; this.code = code; }
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const date = value => value instanceof Date && Number.isFinite(value.getTime());
export function validateGarden(record, scope) {
  if (!record) return null;
  if (record.schemaVersion !== 1) throw new ForestGardenError('GARDEN_MIGRATION_REQUIRED');
  const fields = ['_id', 'schemaVersion', 'ownerUserId', 'forestId', 'revision', 'cuttings',
    'plants', 'lastCommand', 'changedAt'];
  if (record.ownerUserId !== scope.ownerUserId || record.forestId !== scope.forestId
    || !/^[a-f0-9]{24}$/.test(record.ownerUserId) || !UUID.test(record.forestId)
    || Object.keys(record).some(f => !fields.includes(f))
    || !Number.isSafeInteger(record.revision) || record.revision < 1
    || !Number.isSafeInteger(record.cuttings) || record.cuttings < 0 || record.cuttings > 8
    || !Array.isArray(record.plants) || record.plants.length > 24
    || new Set(record.plants.map(p => p.plantId)).size !== record.plants.length
    || record.plants.some(p => !p || Object.keys(p).length !== 5 || !UUID.test(p.plantId)
      || !['worldX', 'worldY'].every(f => Number.isSafeInteger(p[f]) && Math.abs(p[f]) <= 1e9)
      || !date(p.plantedAt) || !date(p.readyAt)
      || p.readyAt.getTime() < p.plantedAt.getTime() + BLOOM_MS)
    || !/^[A-Za-z0-9_-]{43}$/.test(record.lastCommand) || !date(record.changedAt)) {
    throw new ForestGardenError('GARDEN_UNAVAILABLE');
  }
  return record;
}
export async function readForestGardenStore({ ownerUserId, forestId, session = null,
  GardenModel = ForestGarden }) {
  let query = GardenModel.findOne({ ownerUserId, forestId });
  if (session) query = query.session(session);
  return validateGarden(await query.lean(), { ownerUserId, forestId });
}
export async function inspectForestGardenReservation({ ownerUserId, world, worldX, worldY,
  radius = 9, session, readGarden = readForestGardenStore }) {
  const garden = await readGarden({ ownerUserId, forestId: world.forestId, session });
  return !gardenIntersects(garden?.plants || [], worldX, worldY, radius);
}

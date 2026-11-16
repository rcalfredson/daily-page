// Explicit local-only durable preview. Never resets an existing fixture on startup.
import crypto from 'node:crypto';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import User from '../../server/db/models/User.js';
import ForestOwnerWorld from '../../server/db/models/ForestOwnerWorld.js';
import ForestHomestead from '../../server/db/models/ForestHomestead.js';
import ForestTerrainProtection from '../../server/db/models/ForestTerrainProtection.js';
import { buildForestHomesteadService } from '../../server/services/forestHomestead.js';
import { buildForestHomesteadGeography } from '../../server/services/forestHomesteadGeography.js';
import { readForestOwnerTerrain } from '../../server/services/forestOwnerTerrain.js';
import { createHomeCartStudyApp } from './forestHomeCartFixture.js';
import { STUDY_SEEDS } from '../lib/forestHomeCartStudy.js';

export const PREVIEW_OWNER = '64b00000000000000000a095';
export const COMPANION_CHECK_OWNER = '64b00000000000000000a096';
export async function createSavedHomesteadPreview({ profile = 'saved' } = {}) {
  if (!['saved', 'companion-check'].includes(profile)) throw new Error('Unknown preview profile');
  const owner = profile === 'saved' ? PREVIEW_OWNER : COMPANION_CHECK_OWNER;
  const username = profile === 'saved' ? 'forest_homestead_saved_preview' : 'forest_companion_browser_check';
  if (process.env.NODE_ENV === 'production' || ['1', 'true', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB).toLowerCase())) {
    throw new Error('The saved preview is restricted to development and daily-page-test.');
  }
  await initMongooseConnection({ useProductionDb: false, quiet: true });
  if (mongoose.connection.name !== 'daily-page-test') throw new Error('Unexpected fixture database');
  const user = await User.findById(owner).lean();
  if (user && user.username !== username) throw new Error('Fixture owner collision');
  if (!user) await User.create({ _id: owner, username, email: `${username}@example.test`,
    password: crypto.randomBytes(32).toString('base64url'), verified: true, forestLedgerFence: 0 });
  await ForestHomestead.init();
  let world = await ForestOwnerWorld.findOne({ ownerUserId: owner, worldRole: 'primary' }).lean();
  if (!world) {
    const forestId = crypto.randomUUID(), activationId = crypto.randomUUID();
    await mongoose.connection.transaction(async session => {
      await ForestOwnerWorld.create([{ ownerUserId: owner, forestId, worldSeed: STUDY_SEEDS[0],
        placementPolicyVersion: 1, environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1,
        terrain: { schemaVersion: 1, generationVersion: 4, activationId, revision: 1, state: 'active', phase: 'ready', cursor: null } }], { session });
      await ForestTerrainProtection.create([{ schemaVersion: 1, ownerUserId: owner, forestId, activationId,
        sourceKey: 'entrance', x: 0, y: 0, radius: 80, districtX: 0, districtY: 0 }], { session });
    });
    world = await ForestOwnerWorld.findOne({ ownerUserId: owner }).lean();
  }
  const geography = buildForestHomesteadGeography();
  const raw = buildForestHomesteadService({ ...geography, enabled: () => true });
  async function decorate(saved) {
    if (!saved.established) return saved;
    const current = await ForestOwnerWorld.findOne({ ownerUserId: owner }).lean();
    const arrival = await geography.arrival({ ownerUserId: owner, world: current, next: saved, session: null });
    return { ...saved, arrival, recoveryRequired: !arrival };
  }
  const service = { read: async args => decorate(await raw.read(args)), mutate: async args => decorate(await raw.mutate(args)) };
  let saved = await raw.read({ ownerUserId: owner });
  if (!saved.established) saved = await raw.mutate({ ownerUserId: owner,
    command: { action: 'establish', expectedRevision: 0, operationId: crypto.randomUUID(), forestId: world.forestId,
      terrainToken: `${world.terrain.activationId}:1` } });
  saved = await decorate(saved);
  world = await ForestOwnerWorld.findOne({ ownerUserId: owner }).lean();
  const { layout } = saved, plan = { status: 'ready', ...layout, destination: layout.route.at(-1),
    spawn: { x: saved.arrival?.worldX ?? layout.parking.x, y: saved.arrival?.worldY ?? layout.parking.y }, metrics: {} };
  const fixture = { generation: world.terrain.generationVersion, seed: world.worldSeed, obstacles: [], occupancy: 'saved' };
  const { app } = createHomeCartStudyApp({ persistence: { world, WorldModel: ForestOwnerWorld, service, fixture, plan, readTerrain: readForestOwnerTerrain } });
  return { app, service, raw, world, plan };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--write') throw new Error('Use forestHomesteadPreview.js --write');
  const { app } = await createSavedHomesteadPreview();
  const server = app.listen(Number(process.env.FOREST_SAVED_CART_PORT || 4184), '127.0.0.1');
  await once(server, 'listening');
  console.log(`Saved home/cart preview: http://127.0.0.1:${server.address().port}/en/forest (isolated daily-page-test owner; saves survive restart)`);
}

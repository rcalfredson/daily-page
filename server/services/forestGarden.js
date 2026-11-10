import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ForestGarden from '../db/models/ForestGarden.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import { acquireForestLedgerFence } from './forestLedgerFence.js';
import { validateForestAuthoredOwnerWorld } from './forestAuthoredObjectMutation.js';
import { inspectForestAuthoredPlacement } from './forestAuthoredPlacement.js';
import { assertForestTerrainPlacementReady } from './forestOwnerTerrain.js';
import { forestTerrainDescriptor } from './forestOwnerTerrainRegion.js';
import { readForestGardenStore, ForestGardenError } from './forestGardenStore.js';
import { GARDEN_CAPACITY, CUTTING_CAPACITY, BLOOM_MS, HARVEST_MS,
  gardenIntersects, gardenStage, gardenReady, WILD_LANTERNBELL } from '../../public/js/forest-garden-rules.js';
const fail = code => { throw new ForestGardenError(code); };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
async function transact(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally { await session.endSession(); }
}
export function canonicalGardenCommand(input) {
  const fields = ['action', 'expectedRevision', 'terrainToken'];
  if (['plant', 'move', 'harvest', 'lift'].includes(input?.action)) fields.push('plantId');
  if (['plant', 'move'].includes(input?.action)) fields.push('worldX', 'worldY');
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || !['establish', 'acquire', 'plant', 'move', 'harvest', 'lift'].includes(input.action)
    || Object.keys(input).length !== fields.length || fields.some(f => !Object.hasOwn(input, f))
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
    || input.expectedRevision >= Number.MAX_SAFE_INTEGER
    || !(input.terrainToken === null || typeof input.terrainToken === 'string'
      && /^[a-f0-9-]{36}:1$/.test(input.terrainToken))
    || fields.includes('plantId') && !UUID.test(input.plantId || '')
    || ['worldX', 'worldY'].some(f => fields.includes(f)
      && (!Number.isSafeInteger(input[f]) || Math.abs(input[f]) > 1e9))) fail('GARDEN_INVALID_INPUT');
  return Object.fromEntries(fields.map(f => [f, input[f]]));
}
export function applyGardenCommand(garden, command, now) {
  const next = { ...garden, plants: garden.plants.map(p => ({ ...p })) };
  delete next._id;
  const plant = next.plants.find(p => p.plantId === command.plantId);
  if (command.action === 'acquire') {
    if (garden.revision !== 0) fail('GARDEN_ALREADY_FOUND');
    next.cuttings = 1;
  } else if (command.action === 'plant') {
    if (plant) fail('GARDEN_CONFLICT');
    if (!next.cuttings) fail('GARDEN_NO_CUTTINGS');
    if (next.plants.length >= GARDEN_CAPACITY) fail('GARDEN_FULL');
    next.cuttings -= 1;
    next.plants.push({ plantId: command.plantId, worldX: command.worldX, worldY: command.worldY,
      plantedAt: now, readyAt: new Date(now.getTime() + BLOOM_MS) });
  } else {
    if (!plant) fail('GARDEN_CONFLICT');
    if (command.action === 'move') {
      plant.worldX = command.worldX; plant.worldY = command.worldY;
    } else {
      if (next.cuttings >= CUTTING_CAPACITY) fail('GARDEN_SATCHEL_FULL');
      if (command.action === 'harvest') {
        if (!gardenReady(plant, now.getTime())) fail('GARDEN_GROWING');
        plant.readyAt = new Date(now.getTime() + HARVEST_MS);
      } else next.plants = next.plants.filter(p => p.plantId !== plant.plantId);
      next.cuttings += 1;
    }
  }
  next.revision += 1;
  next.changedAt = now;
  return next;
}
export function buildForestGardenService({ GardenModel = ForestGarden, WorldModel = ForestOwnerWorld,
  DeletionModel = AccountDeletionRequest, transactionRunner = transact,
  acquireFence = acquireForestLedgerFence, clock = () => new Date(),
  inspectPlacement = inspectForestAuthoredPlacement,
  readGarden = options => readForestGardenStore({ ...options, GardenModel }) } = {}) {
  function owner(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{24}$/.test(value)) fail('GARDEN_INVALID_INPUT');
    return value;
  }
  async function authority(ownerUserId, session, establish = false) {
    if (await DeletionModel.exists({ ownerUserId, status: { $in: ['processing', 'completed'] } })
      .session(session).lean()) fail('GARDEN_UNAVAILABLE');
    let world = await WorldModel.findOne({ ownerUserId, worldRole: 'primary' }).session(session).lean();
    if (!world && establish) {
      const [created] = await WorldModel.create([{ ownerUserId, forestId: crypto.randomUUID(),
        worldSeed: crypto.randomBytes(32).toString('base64url'), placementPolicyVersion: 1,
        environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1,
        nextCandidateSlot: 0, placementRevision: 1 }], { session });
      world = created.toObject ? created.toObject() : created;
    }
    validateForestAuthoredOwnerWorld(world, ownerUserId);
    return world;
  }
  function now() {
    const value = clock();
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail('GARDEN_UNAVAILABLE');
    return value;
  }
  function view(garden, time, cells = null) {
    const plants = (garden?.plants || []).filter(p => !cells || cells.some(c =>
      c.cellX === Math.floor(p.worldX / 720) && c.cellY === Math.floor(p.worldY / 720)));
    return { version: 1, revision: garden?.revision || 0, cuttings: garden?.cuttings || 0,
      acquired: Boolean(garden), serverNow: time.toISOString(), wild: WILD_LANTERNBELL,
      plants: plants.map(p => ({ ...p, stage: gardenStage(p, time.getTime()),
        ready: gardenReady(p, time.getTime()) })) };
  }
  async function read({ ownerUserId, cells = null }) {
    owner(ownerUserId);
    if (cells !== null && (!Array.isArray(cells) || !cells.length || cells.length > 9
      || cells.some(c => !c || Object.keys(c).length !== 2
        || !['cellX', 'cellY'].every(f => Number.isSafeInteger(c[f]) && Math.abs(c[f]) <= 1388890))
      || new Set(cells.map(c => `${c.cellX}:${c.cellY}`)).size !== cells.length)) fail('GARDEN_INVALID_INPUT');
    return transactionRunner(async session => {
      const world = await authority(ownerUserId, session);
      const garden = await readGarden({ ownerUserId, forestId: world.forestId, session });
      return view(garden, now(), cells);
    });
  }
  async function mutate({ ownerUserId, command }) {
    owner(ownerUserId);
    const canonical = canonicalGardenCommand(command);
    const digest = crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('base64url');
    return transactionRunner(async session => {
      await acquireFence({ ownerUserId, session });
      const world = await authority(ownerUserId, session, ['establish', 'acquire'].includes(canonical.action));
      assertForestTerrainPlacementReady(world);
      if ((forestTerrainDescriptor(world)?.token || null) !== canonical.terrainToken) fail('GARDEN_TERRAIN_CHANGED');
      const scope = { ownerUserId, forestId: world.forestId };
      const garden = await readGarden({ ...scope, session });
      const time = now();
      if (canonical.action === 'establish') return view(garden, time);
      if (garden?.lastCommand === digest) return view(garden, time);
      if ((garden?.revision || 0) !== canonical.expectedRevision) fail('GARDEN_CONFLICT');
      if (canonical.action !== 'acquire' && !garden) fail('GARDEN_NO_CUTTINGS');
      if (['plant', 'move'].includes(canonical.action)) {
        if (gardenIntersects(garden?.plants || [], canonical.worldX, canonical.worldY, 9,
          canonical.action === 'move' ? canonical.plantId : null)) fail('GARDEN_COLLISION');
        await inspectPlacement({ ownerUserId, world, worldX: canonical.worldX, worldY: canonical.worldY,
          session, inspectGarden: async () => true });
      }
      const next = applyGardenCommand(garden || { ...scope, schemaVersion: 1,
        revision: 0, cuttings: 0, plants: [] }, canonical, time);
      next.lastCommand = digest;
      if (!garden) await GardenModel.create([next], { session });
      else {
        const result = await GardenModel.replaceOne({ ...scope, revision: garden.revision }, next,
          { session, runValidators: true });
        if (Number(result.matchedCount) !== 1) fail('GARDEN_CONFLICT');
      }
      return view(next, time);
    });
  }
  return { read, mutate };
}
export const forestGarden = buildForestGardenService();

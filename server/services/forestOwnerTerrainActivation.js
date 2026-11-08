import { validateOwnerTerrainAccess, ownerTerrainAccessBounds } from '../../public/js/owner-forest-terrain-access.js';
import { readForestOwnerTerrain } from './forestOwnerTerrain.js';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import User from '../db/models/User.js';
import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import ForestAuthoredObject from '../db/models/ForestAuthoredObject.js';
import ForestTerrainProtection from '../db/models/ForestTerrainProtection.js';
import { acquireForestLedgerFence } from './forestLedgerFence.js';
import { forestAuthoredObjectHasSupportedFormat } from './forestAuthoredObjectFormat.js';
import { FOREST_PHENOTYPE_SCENE_TRAITS } from './forest/v3/phenotype.js';
import { OWNER_TERRAIN_PROOF_CONFIG, buildTerrainProofProtections }
  from '../../public/js/owner-forest-terrain.js';
import { buildOwnerTerrainProtections } from '../../public/js/owner-forest-terrain-authority.js';
import { ForestOwnerTerrainError, validateForestOwnerTerrain,
  forestLiveTerrainActivationEnabled } from './forestOwnerTerrain.js';

async function transact(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally { await session.endSession(); }
}

function protection(record, phase, scope) {
  if (record.ownerUserId !== scope.ownerUserId || record.forestId !== scope.forestId
    || !/^[a-f0-9]{24}$/.test(String(record._id))
    || !Number.isSafeInteger(record.placement?.worldX)
    || !Number.isSafeInteger(record.placement?.worldY)) {
    throw new ForestOwnerTerrainError('FOREST_TERRAIN_INVALID_SOURCE');
  }
  if (phase === 'trees') {
    const radius = FOREST_PHENOTYPE_SCENE_TRAITS[record.projection?.phenotypeId]?.collisionRadius;
    if (record.schemaVersion !== 1 || record.identityVersion !== 1
      || record.placement.policyVersion !== 1 || !Number.isFinite(radius)) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNSUPPORTED_TREE');
    }
    return { id: `tree:${record.writingTreeId}`, x: record.placement?.worldX,
      y: record.placement?.worldY, radius: Math.ceil(radius + 36) };
  }
  if (!forestAuthoredObjectHasSupportedFormat(record) || record.identityVersion !== 1
    || record.kind !== 'personal-marker' || !['active', 'removed'].includes(record.state)) {
    throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNSUPPORTED_MARKER');
  }
  return { id: `marker:${record.objectId}`, x: record.placement?.worldX,
    y: record.placement?.worldY, radius: 45 };
}

export function buildForestOwnerTerrainActivationService({
  WorldModel = ForestOwnerWorld, TreeModel = ForestWritingTree,
  MarkerModel = ForestAuthoredObject, ProtectionModel = ForestTerrainProtection,
  DeletionModel = AccountDeletionRequest, UserModel = User,
  transactionRunner = transact, acquireFence = acquireForestLedgerFence,
  activationEnabled = forestLiveTerrainActivationEnabled, generateId = () => crypto.randomUUID(),
  readTerrain = readForestOwnerTerrain, validateAccess = validateOwnerTerrainAccess
} = {}) {
  return async function advanceTerrainActivation({ ownerUserId, action = 'step', batchSize = 100,
    generationVersion = 3 }) {
    if (!/^[a-f0-9]{24}$/.test(ownerUserId || '') || !['start', 'upgrade', 'step', 'cancel', 'publish', 'cleanup'].includes(action)
      || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100 || ![3, 4].includes(generationVersion)) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_INVALID_INPUT');
    }
    if (!['cancel', 'cleanup'].includes(action) && activationEnabled() !== true) {
      throw new ForestOwnerTerrainError('FOREST_TERRAIN_ACTIVATION_DISABLED');
    }
    return transactionRunner(async session => {
      await acquireFence({ ownerUserId, session, UserModel });
      if (await DeletionModel.exists({ ownerUserId,
        status: { $in: ['processing', 'completed'] } }).session(session).lean()) {
        throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNAVAILABLE');
      }
      const world = await WorldModel.findOne({ ownerUserId, worldRole: 'primary' })
        .session(session).lean();
      if (!world || world.status !== 'active' || world.ownerUserId !== ownerUserId
        || world.schemaVersion !== 1 || world.placementPolicyVersion !== 1
        || world.environmentPolicyVersion !== 1 || world.environmentSchemaVersion !== 1
        || world.worldGenerationVersion !== 1) {
        throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNAVAILABLE');
      }
      const stored = validateForestOwnerTerrain(world.terrain);
      const published = stored?.state === 'active' ? stored : null;
      let replacing = Boolean(stored?.replacement);
      let terrain = stored?.replacement || stored;
      // Never reinterpret an activated (or in-progress) operation as a different generation.
      if (action === 'start' && stored && (replacing || stored.generationVersion !== generationVersion)) {
        throw new ForestOwnerTerrainError('FOREST_TERRAIN_GENERATION_CONFLICT');
      }
      const scope = { ownerUserId, forestId: world.forestId };
      async function write(next) {
        validateForestOwnerTerrain(next);
        const result = await WorldModel.updateOne({ ...scope, status: 'active' },
          next ? { $set: { terrain: next } } : { $unset: { terrain: 1 } }, { session });
        if (Number(result.matchedCount) !== 1) {
          throw new ForestOwnerTerrainError('FOREST_TERRAIN_WRITE_CONFLICT');
        }
        return next ? { ...next } : null;
      }
      async function save(next) {
        if (!replacing) return write(next);
        if (next?.state === 'active') return write({ ...next, retiredActivationId: published.activationId });
        const record = { ...published };
        if (next) record.replacement = next;
        else delete record.replacement;
        await write(record);
        return next ? { ...next } : null;
      }
      async function put(records, activationId) {
        // Validate a bounded page before writing any protection record.
        buildTerrainProofProtections(records);
        if (!records.length) return;
        await ProtectionModel.insertMany(records.map(p => ({ ...scope,
          schemaVersion: 1, activationId, sourceKey: p.id, x: p.x, y: p.y, radius: p.radius,
          districtX: Math.floor(p.x / OWNER_TERRAIN_PROOF_CONFIG.districtSize),
          districtY: Math.floor(p.y / OWNER_TERRAIN_PROOF_CONFIG.districtSize)
        })), { session });
      }
      if (action === 'cleanup') {
        if (!stored?.retiredActivationId) return stored;
        const filter = { ...scope, activationId: stored.retiredActivationId };
        const rows = await ProtectionModel.find(filter, { _id: 1 }).sort({ _id: 1 }).limit(batchSize).session(session).lean();
        if (rows.length) {
          const result = await ProtectionModel.deleteMany({ ...filter, _id: { $in: rows.map(r => r._id) } }, { session });
          if (result.deletedCount !== rows.length) throw new ForestOwnerTerrainError('FOREST_TERRAIN_WRITE_CONFLICT');
        }
        if (rows.length === batchSize) return stored;
        const next = { ...stored }; delete next.retiredActivationId;
        return write(next);
      }
      if (action === 'upgrade') {
        if (generationVersion !== 4 || !published) throw new ForestOwnerTerrainError('FOREST_TERRAIN_NOT_UPGRADABLE');
        if (published.generationVersion === 4) return { ...published };
        if (replacing) return { ...terrain };
        if (world.reconciliation?.state !== 'idle') throw new ForestOwnerTerrainError('FOREST_TERRAIN_NOT_PREPARED');
        replacing = true;
        terrain = { schemaVersion: 1, generationVersion: 4, activationId: generateId(),
          revision: 1, state: 'preparing', phase: 'trees', cursor: null };
        await put([{ id: 'entrance', x: 0, y: 0, radius: 80 }], terrain.activationId);
        return save(terrain);
      }
      if (action === 'cancel' || terrain?.state === 'cancelling') {
        if (!terrain) return null;
        if (terrain.state === 'active') throw new ForestOwnerTerrainError('FOREST_TERRAIN_ALREADY_ACTIVE');
        const filter = { ...scope, activationId: terrain.activationId };
        const records = await ProtectionModel.find(filter, { _id: 1 }).sort({ _id: 1 })
          .limit(batchSize).session(session).lean();
        if (records.length) {
          const removed = await ProtectionModel.deleteMany({ ...filter,
            _id: { $in: records.map(r => r._id) } }, { session });
          if (removed.deletedCount !== records.length) {
            throw new ForestOwnerTerrainError('FOREST_TERRAIN_WRITE_CONFLICT');
          }
        }
        return save(records.length < batchSize ? null : { ...terrain, state: 'cancelling' });
      }
      if (terrain?.state === 'active') return { ...terrain };
      if (!terrain) {
        if (action !== 'start' || world.reconciliation?.state !== 'idle') {
          throw new ForestOwnerTerrainError('FOREST_TERRAIN_NOT_PREPARED');
        }
        const next = { schemaVersion: 1, generationVersion, activationId: generateId(),
          revision: 1, state: 'preparing', phase: 'trees', cursor: null };
        validateForestOwnerTerrain(next);
        await put([{ id: 'entrance', x: 0, y: 0, radius: 80 }], next.activationId);
        return save(next);
      }
      if (action === 'start') return { ...terrain };
      // Coordinate-creating/moving writers observe the preparing state under the same owner fence.
      // Every page and its cursor are committed together, so retries cannot duplicate protections.
      if (action === 'publish') {
        if (terrain.phase !== 'ready') throw new ForestOwnerTerrainError('FOREST_TERRAIN_NOT_PREPARED');
        return save({ ...terrain, state: 'active' });
      }
      if (terrain.phase === 'ready') return { ...terrain };
      if (terrain.phase === 'verify') {
        // One protected place per transaction bounds geometry and access certification work.
        const records = await ProtectionModel.find({ ...scope, activationId: terrain.activationId,
          ...(terrain.cursor ? { _id: { $gt: terrain.cursor } } : {}) })
          .sort({ _id: 1 }).limit(1).session(session).lean();
        if (!records.length) return save({ ...terrain, phase: 'ready', cursor: null });
        const record = records[0];
        let p = buildOwnerTerrainProtections([{ id: record.sourceKey,
          x: record.x, y: record.y, radius: record.radius }], terrain.generationVersion)[0];
        const activeWorld = { ...world, terrain: { ...terrain, state: 'active', phase: 'ready', cursor: null } };
        if (terrain.generationVersion === 4) {
          const local = await readTerrain({ ownerUserId, world: activeWorld,
            bounds: { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y }, session });
          p = local.protections.find(record => record.id === p.id);
          if (!p) throw new ForestOwnerTerrainError('FOREST_TERRAIN_ACCESS_UNAVAILABLE');
        }
        const scene = await readTerrain({ ownerUserId,
          world: activeWorld,
          bounds: ownerTerrainAccessBounds(p), session });
        if (!validateAccess(scene, p)) throw new ForestOwnerTerrainError('FOREST_TERRAIN_ACCESS_UNAVAILABLE');
        return save({ ...terrain, cursor: String(record._id) });
      }
      const Model = terrain.phase === 'trees' ? TreeModel : MarkerModel;
      const records = await Model.find({ ...scope,
        ...(terrain.cursor ? { _id: { $gt: terrain.cursor } } : {}) })
        .sort({ _id: 1 }).limit(batchSize).session(session).lean();
      if (!Array.isArray(records) || records.length > batchSize) {
        throw new ForestOwnerTerrainError('FOREST_TERRAIN_UNAVAILABLE');
      }
      await put(records.map(record => protection(record, terrain.phase, scope)), terrain.activationId);
      const complete = records.length < batchSize;
      const next = { ...terrain, cursor: complete ? null : String(records.at(-1)._id),
        phase: complete ? (terrain.phase === 'trees' ? 'markers' : 'verify') : terrain.phase };
      validateForestOwnerTerrain(next);
      return save(next);
    });
  };
}

export const advanceForestOwnerTerrainActivation = buildForestOwnerTerrainActivationService();

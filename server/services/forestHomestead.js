import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ForestHomestead from '../db/models/ForestHomestead.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import { acquireForestLedgerFence } from './forestLedgerFence.js';
import { validateForestAuthoredOwnerWorld } from './forestAuthoredObjectMutation.js';
import { assertForestTerrainPlacementReady } from './forestOwnerTerrain.js';
import { forestTerrainDescriptor } from './forestOwnerTerrainRegion.js';
import { DEFAULT_HOME_DESIGN, DEFAULT_CART_DESIGN, validateConstructionDesign,
  HOME_DESIGN_OPTIONS, CART_DESIGN_OPTIONS } from '../../public/js/forest-construction-design.js';
import { homeLayoutFromPlan } from '../../public/js/forest-home-reservations.js';
import { advanceCompanionEncounter, COMPANION_ENCOUNTERS } from '../../public/js/forest-companion.js';
import { replaceConstructionCommitment, checkConstructionRevision } from './forestConstructionAccounting.js';
import { validateHomestead, HOMESTEAD_RECEIPT_LIMIT, HOMESTEAD_MATERIAL_CAPACITY,
  HOMESTEAD_UUID, validHomesteadParking, ForestHomesteadError, homesteadCartCost,
  hasHomesteadCart, canDriveHomesteadCart } from './forestHomesteadRecord.js';

const fail = code => { throw new ForestHomesteadError(code); };
const unsupported = async () => fail('HOME_INTEGRATION_NOT_READY');
async function transact(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally { await session.endSession(); }
}
export function canonicalHomesteadCommand(input) {
  const fields = ['action', 'operationId', 'forestId', 'expectedRevision', 'terrainToken'];
  if (['home', 'cart'].includes(input?.action)) fields.push('design');
  if (input?.action === 'park') fields.push('parking');
  if (input?.action === 'companion') fields.push('encounter');
  if (input?.action === 'establish' && Object.hasOwn(input, 'site')) fields.push('site');
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || !['establish', 'supplies', 'home', 'cart', 'park', 'recover', 'companion'].includes(input.action)
    || Object.keys(input).length !== fields.length || fields.some(f => !Object.hasOwn(input, f))
    || !HOMESTEAD_UUID.test(input.operationId) || !HOMESTEAD_UUID.test(input.forestId)
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER
    || !(input.terrainToken === null || typeof input.terrainToken === 'string'
      && /^[a-f0-9-]{36}:1$/.test(input.terrainToken))
    || fields.includes('design') && !validateConstructionDesign(input.action, input.design)
    || fields.includes('parking') && !validHomesteadParking(input.parking)
    || fields.includes('site') && (!input.site || Object.keys(input.site).length !== 2
      || !['x', 'y'].every(key => Number.isSafeInteger(input.site[key]) && Math.abs(input.site[key]) <= 3600))
    || fields.includes('encounter') && !COMPANION_ENCOUNTERS.includes(input.encounter)) fail('HOME_INVALID_INPUT');
  const command = Object.fromEntries(fields.map(f => [f, input[f]]));
  if (command.design) command.design = Object.fromEntries(['version', ...Object.keys(input.action === 'home'
    ? HOME_DESIGN_OPTIONS : CART_DESIGN_OPTIONS)].map(k => [k, input.design[k]]));
  if (command.parking) command.parking = Object.fromEntries(['worldX', 'worldY', 'heading'].map(k => [k, input.parking[k]]));
  if (command.site) command.site = { x: input.site.x, y: input.site.y };
  return command;
}

export function buildForestHomesteadService({ HomeModel = ForestHomestead, WorldModel = ForestOwnerWorld,
  DeletionModel = AccountDeletionRequest, transactionRunner = transact, acquireFence = acquireForestLedgerFence,
  enabled = () => false, guidedStart = false, planSite = unsupported, validatePlacement = unsupported,
  clock = () => new Date(), generateId = () => crypto.randomUUID() } = {}) {
  async function authority(ownerUserId, session) {
    if (typeof ownerUserId !== 'string' || !/^[a-f0-9]{24}$/.test(ownerUserId)) fail('HOME_INVALID_INPUT');
    if (await DeletionModel.exists({ ownerUserId, status: { $in: ['processing', 'completed'] } })
      .session(session).lean()) fail('HOME_UNAVAILABLE');
    const world = await WorldModel.findOne({ ownerUserId, worldRole: 'primary' }).session(session).lean();
    validateForestAuthoredOwnerWorld(world, ownerUserId);
    return world;
  }
  async function load(scope, session) {
    return validateHomestead(await HomeModel.findOne(scope).session(session).lean(), scope);
  }
  function view(record, world, receipt = null, replayed = false) {
    const context = { forestId: world.forestId, terrainToken: forestTerrainDescriptor(world)?.token || null };
    if (!record) return { version: 1, established: false, revision: 0, ...context };
    const { _id, receipts, ...visible } = record;
    void _id; void receipts;
    return { version: 1, established: true, ...globalThis.structuredClone(visible), ...context,
      operation: receipt ? { operationId: receipt.operationId, revision: receipt.revision, replayed } : null };
  }
  async function read({ ownerUserId }) {
    return transactionRunner(async session => {
      const world = await authority(ownerUserId, session);
      const record = await load({ ownerUserId, forestId: world.forestId }, session);
      if (world.schemaVersion === 2 && !record) fail('HOME_UNAVAILABLE');
      return view(record, world);
    });
  }
  async function mutate({ ownerUserId, command: input }) {
    const command = canonicalHomesteadCommand(input);
    if (typeof ownerUserId !== 'string' || !/^[a-f0-9]{24}$/.test(ownerUserId)) fail('HOME_INVALID_INPUT');
    if (enabled() !== true && command.action !== 'recover') fail('HOME_DISABLED');
    const digest = crypto.createHash('sha256').update(JSON.stringify(command)).digest('base64url');
    return transactionRunner(async session => {
      await acquireFence({ ownerUserId, session });
      const world = await authority(ownerUserId, session);
      const scope = { ownerUserId, forestId: world.forestId };
      if (command.forestId !== world.forestId) fail('HOME_FOREST_CHANGED');
      const previous = await load(scope, session);
      if (world.schemaVersion === 2 && !previous) fail('HOME_UNAVAILABLE');
      const receipt = previous?.receipts.find(r => r.operationId === command.operationId);
      if (receipt) {
        if (receipt.digest !== digest) fail('HOME_OPERATION_CONFLICT');
        return view(previous, world, receipt, true);
      }
      assertForestTerrainPlacementReady(world);
      if ((forestTerrainDescriptor(world)?.token || null) !== command.terrainToken) fail('HOME_TERRAIN_CHANGED');
      const revision = checkConstructionRevision(previous?.revision || 0, command.expectedRevision);
      const time = clock();
      if (!(time instanceof Date) || !Number.isFinite(time.getTime())) fail('HOME_UNAVAILABLE');
      let next;
      if (command.action === 'establish') {
        if (previous) fail('HOME_ALREADY_ESTABLISHED');
        if (guidedStart && !command.site) fail('HOME_SITE_CHANGED');
        const layout = homeLayoutFromPlan(await planSite({ ...scope, world, session }));
        if (command.site && (command.site.x !== layout.parking.x || command.site.y !== layout.parking.y)) fail('HOME_SITE_CHANGED');
        const empty = { timber: 0, cloth: 0 };
        const budget = guidedStart ? { holdings: empty, commitment: { ...empty } }
          : replaceConstructionCommitment({ holdings: HOMESTEAD_MATERIAL_CAPACITY,
          previousCommitment: {}, nextCost: homesteadCartCost(DEFAULT_CART_DESIGN), capacity: HOMESTEAD_MATERIAL_CAPACITY });
        next = { ...scope, schemaVersion: guidedStart ? 3 : 1, catalogVersion: 1,
          layoutId: generateId(), homeId: generateId(), cartId: generateId(),
          ...(guidedStart ? { starterSuppliesClaimed: false } : {}),
          layout, homeDesign: { ...DEFAULT_HOME_DESIGN }, cartDesign: guidedStart ? null : { ...DEFAULT_CART_DESIGN },
          parking: { worldX: layout.parking.x, worldY: layout.parking.y,
            heading: Math.atan2(layout.route[1].y - layout.route[0].y, layout.route[1].x - layout.route[0].x) },
          holdings: budget.holdings, cartCommitment: budget.commitment };
      } else {
        if (!previous) fail('HOME_NOT_ESTABLISHED');
        next = globalThis.structuredClone(previous); delete next._id;
        if (command.action === 'companion') {
          next.companion = advanceCompanionEncounter(previous.companion, command.encounter, generateId);
          if (next.schemaVersion === 1) next.schemaVersion = 2;
        }
        if (command.action === 'supplies') {
          if (previous.starterSuppliesClaimed !== false) fail('HOME_SUPPLIES_UNAVAILABLE');
          next.starterSuppliesClaimed = true;
          next.holdings = { ...HOMESTEAD_MATERIAL_CAPACITY };
        }
        if (command.action === 'home') next.homeDesign = command.design;
        if (command.action === 'cart') {
          if (previous.starterSuppliesClaimed === false) fail('HOME_SUPPLIES_REQUIRED');
          const budget = replaceConstructionCommitment({ holdings: previous.holdings,
            previousCommitment: previous.cartCommitment, nextCost: homesteadCartCost(command.design), capacity: HOMESTEAD_MATERIAL_CAPACITY });
          next.cartDesign = command.design; next.holdings = budget.holdings; next.cartCommitment = budget.commitment;
        }
        if (command.action === 'park') {
          if (!canDriveHomesteadCart(previous)) fail('HOME_CART_NOT_READY');
          next.parking = command.parking;
        }
        if (command.action === 'recover' && !hasHomesteadCart(previous)) fail('HOME_CART_NOT_READY');
        if (command.action === 'recover') next.parking = { worldX: next.layout.parking.x, worldY: next.layout.parking.y,
          heading: Math.atan2(next.layout.route[1].y - next.layout.route[0].y, next.layout.route[1].x - next.layout.route[0].x) };
      }
      const committed = { operationId: command.operationId, digest, revision };
      next.revision = revision; next.changedAt = new Date(time);
      next.receipts = [...(previous?.receipts || []), committed].slice(-HOMESTEAD_RECEIPT_LIMIT);
      validateHomestead(next, scope);
      // Required for EVERY write, including recovery and design changes; no client geometry is trusted.
      if (await validatePlacement({ ...scope, world, previous, next: globalThis.structuredClone(next), session }) !== true) fail('HOME_PLACEMENT_COLLISION');
      if (!previous) {
        const upgraded = await WorldModel.updateOne({ ...scope, schemaVersion: 1 }, { $set: { schemaVersion: 2 } }, { session });
        if (upgraded.matchedCount !== 1) fail('HOME_CONFLICT');
        await HomeModel.create([next], { session });
      }
      else {
        // Document validation covers cross-field invariants; CAS and transaction fence cover concurrency.
        await new HomeModel(next).validate();
        const result = await HomeModel.replaceOne({ ...scope, revision: previous.revision }, next, { session, runValidators: true });
        if (result.matchedCount !== 1) fail('HOME_CONFLICT');
      }
      return view(next, world, committed);
    });
  }
  return { read, mutate };
}

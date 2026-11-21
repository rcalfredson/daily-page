import { inspectForestHomesteadReservation } from '../../server/services/forestHomesteadStore.js';
import { inspectForestAuthoredPlacement } from '../../server/services/forestAuthoredPlacement.js';
// Real transaction checks for a reserved development identity. No live construction API is installed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import User from '../../server/db/models/User.js';
import ForestOwnerWorld from '../../server/db/models/ForestOwnerWorld.js';
import ForestHomestead from '../../server/db/models/ForestHomestead.js';
import AccountDeletionRequest from '../../server/db/models/AccountDeletionRequest.js';
import { buildForestTravelerRouteHandler } from '../../server/api/v1/forestTraveler.js';
import { buildForestHomesteadService } from '../../server/services/forestHomestead.js';
import { cleanUpAccountDeletionForests } from '../../server/services/accountDeletionForestCleanup.js';
import { createHomeStudyFixture, planHomeCartSite } from '../lib/forestHomeCartStudy.js';
import { studyCartDesign, DEFAULT_HOME_DESIGN, constructionHomeFootprint } from '../../public/js/forest-construction-design.js';
import { cartPoseClear, cartDismount, discIntersectsRectangle } from '../../public/js/forest-cart-motion.js';

const OWNER = '64b00000000000000000a094';
const USERNAME = 'forest_homestead_transaction_fixture';
if (process.argv.length !== 4 || process.argv[2] !== 'run' || process.argv[3] !== '--write'
  || process.env.NODE_ENV === 'production'
  || ['1', 'true', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB).toLowerCase())) {
  throw new Error('Use forestHomesteadFixture.js run --write in development only.');
}
const fixture = createHomeStudyFixture({ generation: 0 }), plan = planHomeCartSite(fixture);
assert.equal(plan.status, 'ready');
let forestId;
const options = { enabled: () => true, planSite: async ({ ownerUserId }) => {
  assert.equal(ownerUserId, OWNER); return plan;
}, validatePlacement: async ({ ownerUserId, next }) => {
  assert.equal(ownerUserId, OWNER);
  const clear = p => Math.abs(p.worldX) + p.radius <= 3600 && Math.abs(p.worldY) + p.radius <= 3600
    && !discIntersectsRectangle(p, constructionHomeFootprint(next.layout.home, next.homeDesign))
    && fixture.obstacles.every(o => Math.hypot(o.x - p.worldX, o.y - p.worldY) > o.collisionRadius + p.radius);
  const cart = { ...next.parking, design: next.cartDesign };
  return cartPoseClear(cart, clear) && Boolean(cartDismount(cart, clear));
} };
const service = buildForestHomesteadService(options);
const cmd = (action, expectedRevision, extra = {}) => ({ action, operationId: crypto.randomUUID(),
  forestId, expectedRevision, terrainToken: null, ...extra });
const mutate = command => service.mutate({ ownerUserId: OWNER, command });
async function reset() {
  await ForestHomestead.deleteMany({ ownerUserId: OWNER });
  await ForestOwnerWorld.deleteMany({ ownerUserId: OWNER });
  await AccountDeletionRequest.deleteMany({ ownerUserId: OWNER });
  await User.deleteOne({ _id: OWNER, username: USERNAME });
}
async function run() {
  await reset();
  await User.create({ _id: OWNER, username: USERNAME, email: `${USERNAME}@example.test`,
    password: crypto.randomBytes(32).toString('base64url'), verified: true, forestLedgerFence: 0 });
  const world = await ForestOwnerWorld.create({ ownerUserId: OWNER, forestId: crypto.randomUUID(),
    worldSeed: fixture.seed, placementPolicyVersion: 1, environmentPolicyVersion: 1,
    environmentSchemaVersion: 1, worldGenerationVersion: 1 });
  forestId = world.forestId;
  const traveler = buildForestTravelerRouteHandler({ enabled: ownerUserId => ownerUserId === OWNER });
  const acceptFrame = () => traveler({ user: { id: OWNER }, query: {}, body: { forestId, action: 'accept-frame' } }, {
    status(code) { throw new Error(`Frame acceptance failed with status ${code}`); },
    json(result) { return result; }
  });
  assert.equal((await service.read({ ownerUserId: OWNER })).established, false);
  const accepted = { introduced: true, frameOwned: true };
  assert.deepEqual(await Promise.all([acceptFrame(), acceptFrame()]), [accepted, accepted]);
  await mongoose.disconnect(); await initMongooseConnection({ useProductionDb: false, quiet: true });
  const beforeHome = await service.read({ ownerUserId: OWNER });
  assert.equal(beforeHome.established, false);
  assert.equal(beforeHome.tansyFrameOwned, true);
  assert.equal((await ForestOwnerWorld.findOne({ ownerUserId: OWNER }).lean()).tansyIntroduced, true);
  console.log('PASS real Mongo: repeated frame acceptance and restart before making a clearing');
  const initial = cmd('establish', 0);
  const results = await Promise.all([mutate(initial), mutate(initial)]);
  assert.equal(await ForestHomestead.countDocuments({ ownerUserId: OWNER }), 1);
  assert.equal(results[0].homeId, results[1].homeId); assert.equal(results[0].revision, 1);
  assert.equal(results[0].tansyFrameOwned, true);
  const record = await ForestHomestead.findOne({ ownerUserId: OWNER }).lean();
  const duplicate = { ...record }; delete duplicate._id;
  await assert.rejects(ForestHomestead.create(duplicate), error => error.code === 11000);
  const competing = await Promise.allSettled(['sage', 'clay'].map(color => mutate(cmd('home', 1,
    { design: { ...DEFAULT_HOME_DESIGN, color } }))));
  assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1);
  const edit = cmd('cart', 2, { design: studyCartDesign('compact') });
  const committed = await mutate(edit), retry = await mutate(edit);
  assert.equal(retry.operation.replayed, true); assert.equal(retry.revision, 3);
  assert.deepEqual(retry.holdings, committed.holdings);
  assert.equal(retry.holdings.cloth, 24);
  console.log('PASS real Mongo: unique aggregate, concurrent establishment/edit, exact retry and recorded refunds');

  const before = await ForestHomestead.findOne({ ownerUserId: OWNER }).lean();
  const aborting = buildForestHomesteadService({ ...options, transactionRunner: async work => {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(async () => { await work(session); throw new Error('fixture abort'); }); }
    finally { await session.endSession(); }
  } });
  await assert.rejects(aborting.mutate({ ownerUserId: OWNER,
    command: cmd('cart', 3, { design: studyCartDesign('canopy') }) }), /fixture abort/);
  assert.deepEqual(await ForestHomestead.findOne({ ownerUserId: OWNER }).lean(), before);
  await assert.rejects(mutate(cmd('park', 3, { parking: { worldX: plan.home.x, worldY: plan.home.y - 80, heading: 0 } })),
    /HOME_PLACEMENT_COLLISION/);
  assert.deepEqual(await ForestHomestead.findOne({ ownerUserId: OWNER }).lean(), before);
  console.log('PASS real Mongo: transaction rollback includes design, material commitments, revision and receipts');

  await mutate(cmd('park', 3, { parking: { worldX: plan.parking.x + 300, worldY: plan.parking.y, heading: 0 } }));
  // Close/reopen the connection and rebuild the service: no process-local state restores the record.
  await mongoose.disconnect(); await initMongooseConnection({ useProductionDb: false, quiet: true });
  assert.equal(mongoose.connection.name, 'daily-page-test');
  const restarted = buildForestHomesteadService(options);
  const restored = await restarted.read({ ownerUserId: OWNER });
  assert.equal(restored.revision, 4); assert.equal(restored.cartId, committed.cartId);
  assert.equal(restored.cartDesign.length, 36); assert.equal(restored.parking.worldX, plan.parking.x + 300);
  const recovered = await restarted.mutate({ ownerUserId: OWNER, command: cmd('recover', 4) });
  assert.equal(recovered.parking.worldX, plan.parking.x); assert.deepEqual(recovered.holdings, committed.holdings);
  console.log('PASS real Mongo: connection restart restores design/identity/parking, explicit recovery preserves materials');
  const capableWorld = await ForestOwnerWorld.findOne({ ownerUserId: OWNER }).lean();
  assert.equal(capableWorld.schemaVersion, 2);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const writer of ['writing', 'garden', 'marker']) assert.equal(await inspectForestHomesteadReservation({
        ownerUserId: OWNER, world: capableWorld, worldX: recovered.parking.worldX,
        worldY: recovered.parking.worldY, radius: 26, writer, session }), false);
      await assert.rejects(inspectForestAuthoredPlacement({ ownerUserId: OWNER, world: capableWorld,
        worldX: recovered.parking.worldX, worldY: recovered.parking.worldY, session,
        inspectGarden: async () => true }), error => error.code === 'AUTHORED_PLACEMENT_COLLISION');
    });
  } finally { await session.endSession(); }
  console.log('PASS real Mongo: atomic world-version boundary and live authored/garden reservation checks');

  const beforeCompanion = await service.read({ ownerUserId: OWNER });
  const meeting = cmd('companion', beforeCompanion.revision, { encounter: 'meet' });
  await assert.rejects(aborting.mutate({ ownerUserId: OWNER, command: meeting }), /fixture abort/);
  assert.equal((await service.read({ ownerUserId: OWNER })).schemaVersion, 1);
  const met = await mutate(meeting), metAgain = await mutate(meeting);
  assert.equal(met.schemaVersion, 2); assert.equal(metAgain.revision, met.revision);
  assert.deepEqual(met.companion, metAgain.companion);
  const joined = await mutate(cmd('companion', met.revision, { encounter: 'invite' }));
  for (const key of ['homeId', 'cartId', 'layout', 'homeDesign', 'cartDesign', 'parking', 'holdings']) {
    assert.deepEqual(joined[key], beforeCompanion[key]);
  }
  await mongoose.disconnect(); await initMongooseConnection({ useProductionDb: false, quiet: true });
  assert.deepEqual((await buildForestHomesteadService(options).read({ ownerUserId: OWNER })).companion, joined.companion);
  console.log('PASS real Mongo: companion upgrade rollback, stable identity, exact retry, invitation and restart');

  await AccountDeletionRequest.create({ ownerUserId: OWNER, disposition: 'delete', status: 'completed',
    startedAt: new Date(), completedAt: new Date(), forestCleanup: { status: 'pending' } });
  await assert.rejects(mutate(cmd('recover', joined.revision)), /HOME_UNAVAILABLE/);
  const cleaned = await cleanUpAccountDeletionForests({ ownerUserId: OWNER, limit: 1 });
  assert.equal(cleaned.deletedHomesteads, 1); assert.equal(cleaned.completed, 1);
  assert.equal(await ForestHomestead.countDocuments({ ownerUserId: OWNER }), 0);
  await reset();
  console.log('PASS real Mongo: deletion fence and bounded homestead cleanup; reserved fixture removed');
}
try {
  await initMongooseConnection({ useProductionDb: false, quiet: true });
  if (mongoose.connection.name !== 'daily-page-test') throw new Error('Unexpected fixture database');
  const existing = await User.findById(OWNER).lean();
  if (existing && existing.username !== USERNAME) throw new Error('Fixture owner collision');
  for (const Model of [User, ForestOwnerWorld, ForestHomestead, AccountDeletionRequest]) await Model.createCollection();
  await ForestHomestead.createIndexes();
  await run();
} catch (error) {
  console.error('Homestead fixture failed:', error.name, error.code || 'CHECK_FAILED',
    error instanceof assert.AssertionError ? error.message : '');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }

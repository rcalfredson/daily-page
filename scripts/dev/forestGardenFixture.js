// Dedicated development-only owner template backed by isolated daily-page-test records.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import pug from 'pug';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import User from '../../server/db/models/User.js';
import ForestGarden from '../../server/db/models/ForestGarden.js';
import ForestOwnerWorld from '../../server/db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../../server/db/models/ForestWritingTree.js';
import ForestAuthoredObject from '../../server/db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../../server/db/models/ForestAuthoredRegionRevision.js';
import ForestAuthoredResetOperation from '../../server/db/models/ForestAuthoredResetOperation.js';
import ForestTerrainProtection from '../../server/db/models/ForestTerrainProtection.js';
import AccountDeletionRequest from '../../server/db/models/AccountDeletionRequest.js';
import { buildForestGardenService } from '../../server/services/forestGarden.js';
import { BLOOM_MS, HARVEST_MS } from '../../public/js/forest-garden-rules.js';
import { cleanUpAccountDeletionForests } from '../../server/services/accountDeletionForestCleanup.js';
import { inspectForestGardenReservation } from '../../server/services/forestGardenStore.js';
import { forestAuthoredObjectMutations } from '../../server/services/forestAuthoredObjectMutation.js';
import { buildForestOwnerTerrainActivationService } from '../../server/services/forestOwnerTerrainActivation.js';
import { readForestOwnerSceneBootstrap } from '../../server/services/forestOwnerSceneBootstrap.js';
import useForestAPI, { buildForestGardenRouteHandler, requireForestAuthoredMutationOrigin, privateForestApiResponse } from '../../server/api/v1/forest.js';
import { buildForestRouteHandler } from '../../server/routes/forest.js';
import { initI18n } from '../../server/services/i18n.js';
import { uiPrefixAndLangContext } from '../../server/middleware/uiPrefix.js';
const qa = process.env.FOREST_GARDEN_QA === 'true';
const OWNER = qa ? '64b00000000000000000a092' : '64b00000000000000000a091';
const USERNAME = qa ? 'forest_lanternbell_qa_fixture' : 'forest_lanternbell_fixture';
const PLANT = 'a9100000-0000-4000-8000-000000000001';
const OTHER = 'a9100000-0000-4000-8000-000000000002';
const models = [ForestGarden, ForestAuthoredObject, ForestAuthoredRegionRevision, ForestAuthoredResetOperation,
  ForestWritingTree, ForestTerrainProtection, ForestOwnerWorld, AccountDeletionRequest];
const [action, flag] = process.argv.slice(2);
if (!['run', 'serve', 'reset'].includes(action) || flag !== '--write' || process.argv.length !== 4
  || process.env.NODE_ENV === 'production'
  || ['1', 'true', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB).toLowerCase())) {
  throw new Error('Use forestGardenFixture.js run|serve|reset --write in development only.');
}
let offset = 0;
const service = buildForestGardenService({ clock: () => new Date(Date.now() + offset) });
const cmd = (action, expectedRevision, extra = {}, terrainToken = null) =>
  ({ action, expectedRevision, terrainToken, ...extra });
const mutate = command => service.mutate({ ownerUserId: OWNER, command });
async function reset() {
  for (const Model of models) await Model.deleteMany({ ownerUserId: OWNER });
  await User.deleteOne({ _id: OWNER, username: USERNAME });
}
async function seedUser() {
  if (!await User.exists({ _id: OWNER })) await User.create({ _id: OWNER, username: USERNAME,
    email: `${USERNAME}@example.test`, password: crypto.randomBytes(32).toString('base64url'),
    verified: true, forestLedgerFence: 0 });
}
async function run() {
  await reset(); await seedUser();
  const entries = await Promise.all([mutate(cmd('establish', 0)), mutate(cmd('establish', 0))]);
  assert.ok(entries.every(r => !r.acquired && r.cuttings === 0 && r.revision === 0));
  assert.equal(await ForestOwnerWorld.countDocuments({ ownerUserId: OWNER }), 1);
  assert.equal(await ForestGarden.countDocuments({ ownerUserId: OWNER }), 0);
  const acquisition = cmd('acquire', 0);
  const acquired = await Promise.all([mutate(acquisition), mutate(acquisition)]);
  assert.ok(acquired.every(r => r.cuttings === 1 && r.revision === 1));
  assert.equal(await ForestGarden.countDocuments({ ownerUserId: OWNER }), 1);
  await assert.rejects(ForestGarden.create((await ForestGarden.findOne({ ownerUserId: OWNER }).lean())
    ? { ...(await ForestGarden.findOne({ ownerUserId: OWNER }).lean()), _id: new mongoose.Types.ObjectId() } : {}),
  error => error.code === 11000);
  console.log('CHECK acquisition and unique index accepted');
  const planting = cmd('plant', 1, { plantId: PLANT, worldX: -40, worldY: 20 });
  const plants = await Promise.all([mutate(planting), mutate(planting)]);
  assert.ok(plants.every(r => r.plants.length === 1 && r.cuttings === 0));
  await assert.rejects(mutate(cmd('harvest', 2, { plantId: PLANT })), /GARDEN_GROWING/);
  const beforeAbort = await ForestGarden.findOne({ ownerUserId: OWNER }).lean();
  const session = await mongoose.startSession();
  await assert.rejects(session.withTransaction(async () => {
    await ForestGarden.updateOne({ ownerUserId: OWNER }, { $set: { cuttings: 7 } }, { session });
    throw new Error('fixture abort');
  }), /fixture abort/);
  await session.endSession();
  assert.deepEqual(await ForestGarden.findOne({ ownerUserId: OWNER }).lean(), beforeAbort);
  console.log('CHECK atomic planting and transaction rollback accepted');
  offset += BLOOM_MS;
  const harvest = cmd('harvest', 2, { plantId: PLANT });
  const harvested = await Promise.all([mutate(harvest), mutate(harvest)]);
  assert.ok(harvested.every(r => r.cuttings === 1 && r.revision === 3));
  offset += HARVEST_MS * 1000;
  const late = await mutate(cmd('harvest', 3, { plantId: PLANT }));
  assert.equal(late.cuttings, 2);
  const competing = await Promise.allSettled([
    mutate(cmd('plant', 4, { plantId: OTHER, worldX: -80, worldY: 20 })),
    mutate(cmd('plant', 4, { plantId: crypto.randomUUID(), worldX: -120, worldY: 20 }))
  ]);
  assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1);
  const garden = await service.read({ ownerUserId: OWNER });
  assert.equal(garden.cuttings, 1); assert.equal(garden.plants.length, 2);
  await assert.rejects(mutate(harvest), /GARDEN_CONFLICT/);
  const beforeCommandAbort = await ForestGarden.findOne({ ownerUserId: OWNER }).lean();
  const failing = buildForestGardenService({ transactionRunner: async work => {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => { await work(session); throw new Error('command abort'); });
    } finally { await session.endSession(); }
  } });
  await assert.rejects(failing.mutate({ ownerUserId: OWNER,
    command: cmd('plant', 5, { plantId: crypto.randomUUID(), worldX: -180, worldY: 20 }) }), /command abort/);
  assert.deepEqual(await ForestGarden.findOne({ ownerUserId: OWNER }).lean(), beforeCommandAbort);
  const world = await ForestOwnerWorld.findOne({ ownerUserId: OWNER }).lean();
  assert.equal(await inspectForestGardenReservation({ ownerUserId: OWNER, world,
    worldX: -40, worldY: 20, radius: 48 }), false);
  await assert.rejects(forestAuthoredObjectMutations.create({ ownerUserId: OWNER,
    objectId: crypto.randomUUID(), protocolVersion: 1, kind: 'personal-marker', worldX: -40, worldY: 20 }),
  /does not clear a planting/);
  console.log('CHECK concurrency, repeat harvesting and marker reservation accepted');
  const activate = buildForestOwnerTerrainActivationService({ activationEnabled: () => true });
  for (const generationVersion of [3, 4]) {
    await activate({ ownerUserId: OWNER, action: generationVersion === 3 ? 'start' : 'upgrade', generationVersion });
    let state;
    for (let i = 0; i < 40; i += 1) {
      state = await activate({ ownerUserId: OWNER });
      if (state.phase === 'ready') break;
    }
    assert.equal(state.phase, 'ready');
    assert.equal(await ForestTerrainProtection.countDocuments({ ownerUserId: OWNER,
      activationId: state.activationId, sourceKey: { $regex: '^plant:' } }), 2);
    await activate({ ownerUserId: OWNER, action: 'publish' });
    console.log(`CHECK generation ${generationVersion} protection capture and activation accepted`);
    const after = await service.read({ ownerUserId: OWNER });
    await mutate(cmd('move', after.revision, { plantId: PLANT, worldX: -40, worldY: 20 },
      `${state.activationId}:1`));
    assert.deepEqual(after.plants.map(p => [p.plantId, p.worldX, p.worldY]),
      garden.plants.map(p => [p.plantId, p.worldX, p.worldY]));
  }
  await AccountDeletionRequest.create({ ownerUserId: OWNER, disposition: 'delete', status: 'completed',
    startedAt: new Date(), completedAt: new Date(), forestCleanup: { status: 'pending' } });
  await assert.rejects(mutate(cmd('harvest', 7, { plantId: PLANT })), /GARDEN_UNAVAILABLE/);
  const cleanup = await cleanUpAccountDeletionForests({ ownerUserId: OWNER, limit: 1,
    treeBatchSize: 1, maxTreeBatchesPerRequest: 20 });
  assert.equal(cleanup.completed, 1); assert.equal(cleanup.deletedGardens, 1);
  assert.equal(await ForestGarden.countDocuments({ ownerUserId: OWNER }), 0);
  // Restore a clean, ordinary-time playable garden, retaining no accelerated records.
  await reset(); await seedUser(); offset = 0;
  console.log('PASS real Mongo: unique index, transaction abort, concurrent acquisition/plant/harvest, stale requests, renewable yield, marker reservation, generation 3 activation and generation 4 upgrade, deletion fence and bounded garden cleanup.');
}
async function serve() {
  await seedUser();
  const app = express(); app.set('view engine', 'pug'); app.set('views', `${process.cwd()}/views`);
  app.use(express.static('public')); app.use(express.json());
  app.use(uiPrefixAndLangContext); app.use(initI18n(['layout', 'nav', 'forestScene', 'blockView']));
  app.use((req, res, next) => { req.user = { id: OWNER, username: USERNAME }; next(); });
  app.use('/api/v1/forest', privateForestApiResponse);
  app.use('/api/v1/forest/garden', requireForestAuthoredMutationOrigin);
  app.get('/api/v1/forest/garden', buildForestGardenRouteHandler({ service }));
  app.post('/api/v1/forest/garden', buildForestGardenRouteHandler({ service }));
  app.post('/__fixture/advance', requireForestAuthoredMutationOrigin, (req, res) => {
    offset += req.body.stage === 'sprout' ? 120000 : req.body.stage === 'bloom' ? BLOOM_MS : HARVEST_MS;
    res.json({ accelerated: true });
  });
  useForestAPI(app);
  app.get('/forest', (req, res, next) => {
    res.render = (view, model) => {
      const html = pug.renderFile(`views/${view}.pug`, { ...res.locals, ...model })
        .replace(/<script>[\s\S]*?<\/script>/g, '')
        .replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,
          (tag, src) => ['/js/owner-forest.js', '/js/owner-forest-garden-start.js', '/js/navigation-drawer.js'].includes(src) ? tag : '')
        .replace(/<link\b[^>]*href="https?:[^>]*>/g, '');
      res.send(html.replace(/(<body\b[^>]*>)/, '$1<aside style="padding:12px;background:#263e31;color:#eee">Isolated development garden · daily-page-test · real durable account authority. '
        + 'Growth preview: <button onclick="advance(\'sprout\')">+2 minutes</button> '
        + '<button onclick="advance(\'bloom\')">+20 minutes</button> '
        + '<button onclick="advance(\'harvest\')">+4 hours</button>. '
        + 'The preview clock resets on process restart. '
        + '<script>async function advance(stage){await fetch(\'/__fixture/advance\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({stage})});document.querySelector(\'[data-garden-refresh]\')?.click()}</script></aside>'));
    }; next();
  }, buildForestRouteHandler({ readBootstrap: readForestOwnerSceneBootstrap }));
  const port = qa ? 4182 : 4181;
  app.listen(port, '127.0.0.1', () => console.log(`Isolated durable garden: http://127.0.0.1:${port}/en/forest`));
}
try {
  await initMongooseConnection({ useProductionDb: false, quiet: true });
  if (mongoose.connection.name !== 'daily-page-test') throw new Error('Unexpected fixture database.');
  const existing = await User.findById(OWNER).lean();
  if (existing && existing.username !== USERNAME) throw new Error('Fixture owner collision.');
  for (const Model of [User, ...models]) { await Model.createCollection(); await Model.createIndexes(); }
  if (action === 'reset') { await reset(); console.log('Isolated garden fixture removed.'); }
  if (action === 'run') await run();
  if (action === 'serve') await serve();
} catch (error) {
  console.error('Garden fixture failed:', error.name, error.code || 'CHECK_FAILED',
    error.errors ? Object.keys(error.errors) : [], error instanceof assert.AssertionError ? error.message : ''); process.exitCode = 1;
} finally { if (action !== 'serve' || process.exitCode) await mongoose.disconnect(); }

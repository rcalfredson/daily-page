// Reserved-owner test database fixture; never operates on real accounts or production.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import User from '../../server/db/models/User.js';
import ForestOwnerWorld from '../../server/db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../../server/db/models/ForestWritingTree.js';
import ForestAuthoredObject from '../../server/db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../../server/db/models/ForestAuthoredRegionRevision.js';
import ForestTerrainProtection from '../../server/db/models/ForestTerrainProtection.js';
import { buildForestOwnerTerrainActivationService } from '../../server/services/forestOwnerTerrainActivation.js';
import { buildForestAuthoredObjectMutationService } from '../../server/services/forestAuthoredObjectMutation.js';
import { projectPostToForestTree } from '../../server/services/forestPostTreeProjection.js';
import { readForestOwnerTerrainRegion, forestTerrainDescriptor } from '../../server/services/forestOwnerTerrainRegion.js';
import { sampleOwnerTerrain as sampleTerrainProof } from '../../public/js/owner-forest-terrain-authority.js';
import { readForestOwnerSceneBootstrap } from '../../server/services/forestOwnerSceneBootstrap.js';

const OWNER = '64b00000000000000000a071';
const USERNAME = 'forest_live_terrain_fixture';
const id = n => `a4700000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FOREST = id(1); const TREE = id(2); const MARKER = id(3); const REMOVED = id(4);
const models = [ForestTerrainProtection, ForestAuthoredObject, ForestAuthoredRegionRevision,
  ForestWritingTree, ForestOwnerWorld];
const scope = { ownerUserId: OWNER };
const upgrading = process.argv.includes('--upgrade');
const generationVersion = !upgrading && process.argv.includes('--generation=4') ? 4 : 3;
if (process.argv.slice(2).some(arg => !['--write', '--generation=3', '--generation=4', '--upgrade'].includes(arg))
  || process.argv.includes('--generation=3') && process.argv.includes('--generation=4')) throw new Error('Invalid terrain fixture arguments.');
function safeEnvironment() {
  if (process.env.NODE_ENV === 'production'
    || ['true', '1', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB || '').trim().toLowerCase())) {
    throw new Error('Refusing production terrain fixture configuration.');
  }
}
async function cleanup() {
  assert.equal(mongoose.connection.name, 'daily-page-test');
  const user = await User.findById(OWNER, { username: 1 }).lean();
  if (user && user.username !== USERNAME) throw new Error('Reserved fixture owner is already in use.');
  await Promise.all(models.map(Model => Model.deleteMany(scope)));
  await User.deleteMany({ _id: OWNER, username: USERNAME });
}
async function seed() {
  await User.create({ _id: OWNER, username: USERNAME, email: `${USERNAME}@example.test`, password: 'not-a-login', verified: true });
  await ForestOwnerWorld.create({ ...scope, forestId: FOREST, worldSeed: 'terrain_fixture_seed_0123456789abcdef',
    placementPolicyVersion: 1, environmentPolicyVersion: 1, environmentSchemaVersion: 1,
    worldGenerationVersion: 1, nextCandidateSlot: 1 });
  const now = new Date();
  const projected = projectPostToForestTree({ id: TREE, createdAt: now.toISOString(), roomId: 'daily' }, { habitat: 'neutral-grove' });
  await ForestWritingTree.create({ ...scope, writingTreeId: TREE, forestId: FOREST,
    translationGroupId: '64b00000000000000000a072', sourceState: 'inactive', sourceStateChangedAt: now,
    hiddenFromForest: true, inclusionChangedAt: now, foundingSource: { blockId: '64b00000000000000000a073', createdAt: now },
    placement: { policyVersion: 1, slot: 0, worldX: -320, worldY: 330 },
    placementIndex: { version: 1, cellX: -1, cellY: 0 },
    originatingEnvironment: { policyVersion: 1, schemaVersion: 1, worldGenerationVersion: 1,
      regionId: 'calm-grove', habitatId: 'neutral-grove', groundSurfaceId: 'grove-moss', transitionState: 'grove-core' },
    projection: { revision: 1, schemaVersion: projected.schemaVersion, mappingVersion: projected.mappingVersion,
      specimenSeed: projected.specimen.seed, phenotypeId: projected.phenotype.id,
      phenotypeAssetVersion: projected.phenotype.version, creationSeason: projected.permanentTraits.creationSeason,
      foliagePaletteId: projected.permanentTraits.foliagePaletteId,
      projectionFingerprint: projected.identity.projectionFingerprint, visualFingerprint: projected.identity.visualFingerprint },
    policyEvidence: { ownerWritingPolicyVersion: 2, ownerVariantSelectionVersion: 1, writingLifecyclePolicyVersion: 1 },
    lastEligibleReconciliationEpoch: 0, recordRevision: 1 });
}
async function run() {
  await cleanup(); await seed();
  const mutations = buildForestAuthoredObjectMutationService();
  const create = (objectId, x, y) => ({ ...scope, objectId, protocolVersion: 1,
    kind: 'personal-marker', worldX: x, worldY: y });
  const original = create(MARKER, 220, 100);
  await mutations.create(original);
  await mutations.create(create(REMOVED, 400, 300));
  await mutations.remove({ ...scope, objectId: REMOVED, protocolVersion: 1, expectedRevision: 1 });
  const before = JSON.stringify(await ForestAuthoredObject.findOne({ ...scope, objectId: MARKER }).lean());
  const fence = (await User.findById(OWNER).lean()).forestLedgerFence;
  const aborted = buildForestOwnerTerrainActivationService({ activationEnabled: () => true,
    WorldModel: { findOne: (...args) => ForestOwnerWorld.findOne(...args),
      updateOne: async () => { throw new Error('fixture world write failure'); } } });
  await assert.rejects(aborted({ ownerUserId: OWNER, action: 'start' }), /fixture world write failure/);
  assert.equal(await ForestTerrainProtection.countDocuments(scope), 0);
  assert.equal((await User.findById(OWNER).lean()).forestLedgerFence, fence);
  const advance = buildForestOwnerTerrainActivationService({ activationEnabled: () => true });
  let state = await advance({ ownerUserId: OWNER, action: 'start', generationVersion });
  await assert.rejects(mutations.create(create(id(5), 200, 200)), e => e.code === 'FOREST_TERRAIN_PREPARING');
  assert.equal((await mutations.create(original)).outcome, 'existing-active');
  for (let step = 0; state.phase !== 'ready' && step < 30; step += 1) {
    state = await advance({ ownerUserId: OWNER, action: 'step', batchSize: 1 });
  }
  assert.equal(state.phase, 'ready');
  assert.equal(await ForestTerrainProtection.countDocuments(scope), 4);
  assert.ok(await ForestTerrainProtection.exists({ ...scope, sourceKey: `tree:${TREE}` }));
  assert.ok(await ForestTerrainProtection.exists({ ...scope, sourceKey: `marker:${REMOVED}` }));
  await advance({ ownerUserId: OWNER, action: 'publish' });
  const world = await ForestOwnerWorld.findOne(scope).lean();
  const descriptor = forestTerrainDescriptor(world);
  assert.equal(JSON.stringify(await ForestAuthoredObject.findOne({ ...scope, objectId: MARKER }).lean()), before);
  assert.equal((await mutations.create(original)).outcome, 'existing-active');
  await assert.rejects(mutations.create(create(id(5), 200, 200)), e => e.code === 'AUTHORED_PROTOCOL_UPGRADE_REQUIRED');
  const districts = Array.from({ length: 9 }, (_, i) => ({ cellX: i % 3 - 1, cellY: Math.floor(i / 3) - 1 }));
  const region = await readForestOwnerTerrainRegion({ ...scope, districts, token: descriptor.token });
  assert.equal(region.districts.length, 9);
  assert.ok(!JSON.stringify(region).includes(`tree:${TREE}`));
  assert.equal(region.generationVersion, generationVersion);
  const pond = (generationVersion === 4 ? region.features.find(f => f.stream) : region.districts.find(d => d.stream)).stream.outlet;
  await assert.rejects(mutations.create({ ...create(id(5), Math.round(pond.x), Math.round(pond.y)),
    protocolVersion: 3, terrainToken: descriptor.token }), e => e.code === 'AUTHORED_PLACEMENT_COLLISION');
  const scene = { generationVersion, districts: region.districts, features: region.features };
  let clear;
  for (let x = -100; x <= 100; x += 20) {
    const p = { x, y: -100 };
    if (sampleTerrainProof(scene, p, 17).placeable) { clear = p; break; }
  }
  assert.ok(clear);
  assert.equal((await mutations.create({ ...create(id(5), clear.x, clear.y),
    protocolVersion: 3, terrainToken: descriptor.token })).outcome, 'created');
  const bootstrap = await readForestOwnerSceneBootstrap({ ...scope, returnMarkerId: MARKER });
  assert.equal(bootstrap.bootstrapVersion, 4);
  assert.equal(bootstrap.returnDestination.markerId, MARKER);
  assert.equal(sampleTerrainProof(scene, { x: bootstrap.returnDestination.spawn.worldX,
    y: bootstrap.returnDestination.spawn.worldY }, 11).walkable, true);
  const plan = await ForestTerrainProtection.find({ ...scope, forestId: FOREST, activationId: state.activationId,
    districtX: { $gte: generationVersion === 4 ? -5 : -1, $lte: generationVersion === 4 ? 4 : 1 },
    districtY: { $gte: generationVersion === 4 ? -5 : -1, $lte: generationVersion === 4 ? 4 : 1 } })
    .hint('forest_terrain_protection_district').limit(513).explain('executionStats');
  assert.ok(JSON.stringify(plan.queryPlanner.winningPlan).includes('IXSCAN'));
  assert.ok(!JSON.stringify(plan.queryPlanner.winningPlan).includes('COLLSCAN'));
  if (upgrading) {
    const committed = { ...create(id(5), clear.x, clear.y), protocolVersion: 3, terrainToken: descriptor.token };
    const places = JSON.stringify(await ForestAuthoredObject.find(scope).sort({ objectId: 1 }).lean());
    const treesBefore = JSON.stringify(await ForestWritingTree.find(scope).sort({ writingTreeId: 1 }).lean());
    const originalSeed = world.worldSeed;
    let upgrade = await advance({ ownerUserId: OWNER, action: 'upgrade', generationVersion: 4 });
    assert.equal(upgrade.generationVersion, 4);
    assert.equal((await readForestOwnerSceneBootstrap(scope)).terrain.token, descriptor.token);
    assert.equal((await readForestOwnerTerrainRegion({ ...scope, districts, token: descriptor.token })).generationVersion, 3);
    await assert.rejects(mutations.create({ ...create(id(6), 250, 200), protocolVersion: 3,
      terrainToken: descriptor.token }), e => e.code === 'FOREST_TERRAIN_PREPARING');
    assert.equal((await mutations.create(committed)).outcome, 'existing-active');
    await advance({ ownerUserId: OWNER, action: 'step', batchSize: 1 });
    const abandonedId = upgrade.activationId;
    await advance({ ownerUserId: OWNER, action: 'cancel' });
    assert.equal(await ForestTerrainProtection.countDocuments({ ...scope, activationId: abandonedId }), 0);
    assert.equal((await readForestOwnerSceneBootstrap(scope)).terrain.token, descriptor.token);
    upgrade = await advance({ ownerUserId: OWNER, action: 'upgrade', generationVersion: 4 });
    for (let i = 0; i < 40 && upgrade.phase !== 'ready'; i++) upgrade = await advance({ ownerUserId: OWNER, action: 'step', batchSize: 1 });
    assert.equal(upgrade.phase, 'ready');
    assert.ok(await ForestTerrainProtection.exists({ ...scope, activationId: upgrade.activationId, sourceKey: `marker:${id(5)}` }));
    upgrade = await advance({ ownerUserId: OWNER, action: 'publish' });
    const upgradedWorld = await ForestOwnerWorld.findOne(scope).lean(), upgradedDescriptor = forestTerrainDescriptor(upgradedWorld);
    assert.equal(upgradedWorld.worldSeed, originalSeed);
    assert.equal(upgradedDescriptor.generationVersion, 4);
    assert.notEqual(upgradedDescriptor.token, descriptor.token);
    assert.equal(JSON.stringify(await ForestAuthoredObject.find(scope).sort({ objectId: 1 }).lean()), places);
    assert.equal(JSON.stringify(await ForestWritingTree.find(scope).sort({ writingTreeId: 1 }).lean()), treesBefore);
    assert.equal((await mutations.create(committed)).outcome, 'existing-active');
    await assert.rejects(mutations.create({ ...create(id(6), 250, 200), protocolVersion: 3,
      terrainToken: descriptor.token }), e => e.code === 'AUTHORED_PROTOCOL_UPGRADE_REQUIRED');
    await assert.rejects(readForestOwnerTerrainRegion({ ...scope, districts, token: descriptor.token }), e => e.code === 'FOREST_TERRAIN_CHANGED');
    assert.equal((await readForestOwnerTerrainRegion({ ...scope, districts, token: upgradedDescriptor.token })).generationVersion, 4);
    const cleanupRetired = buildForestOwnerTerrainActivationService({ activationEnabled: () => false });
    for (let i = 0; i < 10 && upgrade.retiredActivationId; i++) upgrade = await cleanupRetired({ ownerUserId: OWNER, action: 'cleanup', batchSize: 1 });
    assert.equal(upgrade.retiredActivationId, undefined);
    assert.equal(await ForestTerrainProtection.countDocuments({ ...scope, activationId: descriptor.token.split(':')[0] }), 0);
    assert.ok(await ForestTerrainProtection.countDocuments({ ...scope, activationId: upgrade.activationId }) > 0);
    console.log('PASS generation-3 reads during upgrade, spatial-write fence, cancellation, recapture of later places, atomic generation-4 publication, equal retry recovery, stale-token rejection, and retired-only cleanup.');
  }
  console.log('PASS rollback, resumable frozen capture, hidden/tombstone preservation, access verification, publication, stale-client rejection, terrain collision, safe marker return, and indexed regional delivery.');
}
safeEnvironment();
if (!process.argv.includes('--write')) throw new Error('Pass --write to run the reserved test-database terrain fixture.');
try {
  await initMongooseConnection({ useProductionDb: false, quiet: true });
  assert.equal(mongoose.connection.name, 'daily-page-test');
  for (const Model of models) await Model.createIndexes();
  await run();
} finally {
  if (mongoose.connection.readyState === 1) await cleanup();
  await mongoose.disconnect();
}

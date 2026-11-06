// Guarded integration fixture. Only its reserved owner in daily-page-test is modified.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import AccountDeletionRequest from '../../server/db/models/AccountDeletionRequest.js';
import Block from '../../server/db/models/Block.js';
import ForestAuthoredObject from '../../server/db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../../server/db/models/ForestAuthoredRegionRevision.js';
import ForestAuthoredResetOperation from '../../server/db/models/ForestAuthoredResetOperation.js';
import ForestOwnerGroupReconciliationJob from '../../server/db/models/ForestOwnerGroupReconciliationJob.js';
import ForestOwnerWorld from '../../server/db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../../server/db/models/ForestWritingTree.js';
import User from '../../server/db/models/User.js';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import { buildForestAuthoredObjectMutationService } from '../../server/services/forestAuthoredObjectMutation.js';
import { buildForestAuthoredObjectReadService } from '../../server/services/forestAuthoredObjectRead.js';
import { readForestAuthoredRegionManifest } from '../../server/services/forestAuthoredRegionManifest.js';
import { buildForestAuthoredDiagnosticExportService } from '../../server/services/forestAuthoredDiagnosticExport.js';
import { buildForestAuthoredResetService } from '../../server/services/forestAuthoredReset.js';
import { buildForestAuthoredRetentionCleanupService } from '../../server/services/forestAuthoredRetentionCleanup.js';
import { cleanUpAccountDeletionForests } from '../../server/services/accountDeletionForestCleanup.js';
import { projectPostToForestTree } from '../../server/services/forestPostTreeProjection.js';
import { buildForestAuthoredReturnDestinationService } from '../../server/services/forestAuthoredReturnDestination.js';
import { FOREST_OWNER_SCENE_SPAWN } from '../../server/services/forestOwnerSceneBootstrap.js';

const OWNER = '64b00000000000000000a061';
const POST = '64b00000000000000000a062';
const GROUP = '64b00000000000000000a063';
const USERNAME = 'forest_writing_link_fixture';
const id = suffix => `a4600000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const FOREST = id(1);
const TREE = id(2);
const ORDINARY = id(3);
const LINKED = id(4);
const ANOTHER = id(5);
const LEGACY_RESET = id(6);
const MIXED_RESET = id(7);
let creationEnabled = true;
// Use the real clock for creation; advance only for retention checks. A future fixed creation
// clock hides the normal ordering where Mongoose createdAt follows mutation changedAt.
let now = null;
const clock = () => now ? new Date(now) : new Date();
const checks = [];
const models = [AccountDeletionRequest, Block, ForestAuthoredObject, ForestAuthoredRegionRevision,
  ForestAuthoredResetOperation, ForestOwnerGroupReconciliationJob, ForestOwnerWorld, ForestWritingTree, User];

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === 'production'
    || ['true', '1', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB || '').trim().toLowerCase())) {
    throw new Error('Refusing linked-marker fixture production configuration.');
  }
}
async function resetFixture() {
  assert.equal(mongoose.connection.name, 'daily-page-test');
  const user = await User.findById(OWNER, { username: 1 }).lean();
  if (user && user.username !== USERNAME) throw new Error('Reserved fixture owner is already in use.');
  await Promise.all(models.filter(model => ![User, Block].includes(model))
    .map(model => model.deleteMany({ ownerUserId: OWNER })));
  await Block.deleteMany({ _id: POST, userId: OWNER, groupId: GROUP });
  await User.deleteMany({ _id: OWNER, username: USERNAME });
}
async function seed() {
  await User.create({ _id: OWNER, username: USERNAME, email: `${USERNAME}@example.test`,
    password: 'not-a-login-credential', verified: true, forestLedgerFence: 0 });
  await ForestOwnerWorld.create({ forestId: FOREST, ownerUserId: OWNER, worldRole: 'primary',
    status: 'active', worldSeed: crypto.createHash('sha256').update(FOREST).digest('base64url'),
    nextCandidateSlot: 1, placementRevision: 1, placementPolicyVersion: 1,
    environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1 });
  await Block.create({ _id: POST, userId: OWNER, creator: USERNAME, groupId: GROUP, lang: 'en',
    roomId: 'daily', title: 'Linked marker fixture writing', status: 'locked', visibility: 'public',
    authorshipState: 'live', createdAt: clock() });
  const projected = projectPostToForestTree({ id: TREE, createdAt: clock().toISOString(), roomId: 'daily' }, { habitat: 'neutral-grove' });
  await ForestWritingTree.create({ writingTreeId: TREE, forestId: FOREST, ownerUserId: OWNER,
    translationGroupId: GROUP, sourceState: 'active', sourceStateChangedAt: clock(), hiddenFromForest: false,
    foundingSource: { blockId: POST, createdAt: clock() },
    placement: { policyVersion: 1, slot: 0, worldX: 100, worldY: 100 },
    placementIndex: { version: 1, cellX: 0, cellY: 0 },
    originatingEnvironment: { policyVersion: 1, schemaVersion: 1, worldGenerationVersion: 1,
      regionId: 'fixture-grove', habitatId: 'neutral-grove', groundSurfaceId: 'fixture-ground', transitionState: 'fixture-core' },
    projection: { revision: 1, schemaVersion: projected.schemaVersion, mappingVersion: projected.mappingVersion,
      specimenSeed: projected.specimen.seed, phenotypeId: projected.phenotype.id,
      phenotypeAssetVersion: projected.phenotype.version, creationSeason: projected.permanentTraits.creationSeason,
      foliagePaletteId: projected.permanentTraits.foliagePaletteId,
      projectionFingerprint: projected.identity.projectionFingerprint, visualFingerprint: projected.identity.visualFingerprint },
    policyEvidence: { ownerWritingPolicyVersion: 2, ownerVariantSelectionVersion: 1, writingLifecyclePolicyVersion: 1 },
    lastEligibleReconciliationEpoch: 0, recordRevision: 1 });
  // A completed legacy operation must recover its old immutable scope, never upgrade on retry.
  await ForestAuthoredResetOperation.create({ resetId: LEGACY_RESET, forestId: FOREST, ownerUserId: OWNER,
    authoredObjectSchemaVersion: 1, spatialIndexVersion: 1, status: 'completed',
    startedAt: clock(), completedAt: clock() });
}
const createInput = (objectId, worldX, worldY, linked = true) => ({ ownerUserId: OWNER, objectId,
  protocolVersion: linked ? 2 : 1, kind: 'personal-marker', worldX, worldY,
  ...(linked ? { writingLink: { version: 1, writingTreeId: TREE } } : {}) });
async function expectCode(promise, code) { await assert.rejects(promise, error => error.code === code); }

async function runFixture() {
  await resetFixture();
  await seed();
  const service = buildForestAuthoredObjectMutationService({ linkedCreationEnabled: () => creationEnabled, clock });
  const reads = buildForestAuthoredObjectReadService();
  const reset = buildForestAuthoredResetService({ clock });
  assert.equal((await reset.request({ ownerUserId: OWNER, resetId: LEGACY_RESET })).operationVersion, 1);
  const ordinaryInput = createInput(ORDINARY, 220, 100, false);
  await service.create(ordinaryInput);
  const legacyBefore = JSON.stringify(await ForestAuthoredObject.findOne({ ownerUserId: OWNER, objectId: ORDINARY }).lean());
  const fenceBefore = (await User.findById(OWNER, { forestLedgerFence: 1 }).lean()).forestLedgerFence;
  const aborted = buildForestAuthoredObjectMutationService({ linkedCreationEnabled: () => true, clock,
    models: { ForestAuthoredRegionRevision: { findOneAndUpdate: () => { throw new Error('fixture abort'); } } } });
  await assert.rejects(aborted.create(createInput(id(8), 100, 180)), /fixture abort/);
  assert.equal(await ForestAuthoredObject.countDocuments({ ownerUserId: OWNER, objectId: id(8) }), 0);
  assert.equal((await User.findById(OWNER, { forestLedgerFence: 1 }).lean()).forestLedgerFence, fenceBefore);
  checks.push('linked insert and owner fence roll back together after revision-write failure');
  const ordinaryStored = await ForestAuthoredObject.findOne({ ownerUserId: OWNER, objectId: ORDINARY }).lean();
  assert.ok(ordinaryStored.createdAt > ordinaryStored.changedAt, 'Exercise actual insertion after mutation time');
  const input = createInput(LINKED, 100, 220);
  const concurrent = await Promise.all([service.create(input), service.create(input)]);
  assert.deepEqual(concurrent.map(value => value.outcome).sort(), ['created', 'existing-active']);
  assert.equal(await ForestAuthoredObject.countDocuments({ ownerUserId: OWNER, objectId: LINKED }), 1);
  assert.equal(JSON.stringify(await ForestAuthoredObject.findOne({ ownerUserId: OWNER, objectId: ORDINARY }).lean()), legacyBefore);
  await expectCode(service.create({ ...input, writingLink: { version: 1, writingTreeId: FOREST } }), 'AUTHORED_CREATE_IDEMPOTENCY_CONFLICT');
  for (const [objectId, worldX, worldY] of [[id(9), 100, 100], [id(10), 220, 100], [id(11), 100, 220]]) {
    await expectCode(service.create(createInput(objectId, worldX, worldY)), 'AUTHORED_PLACEMENT_COLLISION');
  }
  checks.push('concurrent equal creation, different-link conflict, unchanged legacy record, mixed collisions');

  const linkedSnapshot = await ForestAuthoredObject.findOne({ ownerUserId: OWNER, objectId: LINKED }).lean();
  creationEnabled = false;
  assert.equal((await service.create(input)).outcome, 'existing-active');
  await expectCode(service.create(createInput(ANOTHER, 100, 260)), 'AUTHORED_WRITING_LINKS_DISABLED');
  const moved = await service.move({ ownerUserId: OWNER, objectId: LINKED, protocolVersion: 2,
    expectedRevision: 1, worldX: -750, worldY: 750 });
  assert.equal(moved.object.schemaVersion, 2);
  assert.equal((await service.create(input)).object.placement.worldX, -750);
  assert.equal((await reads.inspect({ ownerUserId: OWNER, objectId: LINKED })).writingState, 'ready');
  await ForestWritingTree.updateOne({ ownerUserId: OWNER, writingTreeId: TREE }, {
    $set: { hiddenFromForest: true, inclusionChangedAt: clock() }, $inc: { recordRevision: 1 } });
  assert.equal((await reads.inspect({ ownerUserId: OWNER, objectId: LINKED })).writingState, 'unavailable');
  assert.equal((await service.create(input)).outcome, 'existing-active');
  const resolveReturn = buildForestAuthoredReturnDestinationService({
    readManifest: async () => ({ status: 'ready', placements: [], page: { nextCursor: null } }) });
  assert.equal((await resolveReturn({ ownerUserId: OWNER, forestId: FOREST, objectId: LINKED,
    spawn: FOREST_OWNER_SCENE_SPAWN, cellSize: 720 })).markerId, LINKED);
  await service.remove({ ownerUserId: OWNER, objectId: LINKED, protocolVersion: 2, expectedRevision: 2 });
  assert.equal((await service.create(input)).outcome, 'existing-removed');
  const removed = await ForestAuthoredObject.findOne({ ownerUserId: OWNER, objectId: LINKED }).lean();
  assert.deepEqual(removed.writingLink, linkedSnapshot.writingLink);
  assert.deepEqual(removed.creationFingerprint, linkedSnapshot.creationFingerprint);
  checks.push('gate-off/source-loss/move/remove retries, current inspection, marker return without source');

  creationEnabled = true;
  await expectCode(service.create(createInput(ANOTHER, 100, 260)), 'AUTHORED_WRITING_UNAVAILABLE');
  await ForestWritingTree.updateOne({ ownerUserId: OWNER, writingTreeId: TREE }, {
    $set: { hiddenFromForest: false, inclusionChangedAt: null }, $inc: { recordRevision: 1 } });
  await expectCode(service.create(createInput(ANOTHER, 100, 261)), 'AUTHORED_WRITING_DISTANCE');
  await service.create(createInput(ANOTHER, 100, 260)); // Inclusive 160-unit boundary.
  await ForestWritingTree.updateOne({ ownerUserId: OWNER, writingTreeId: TREE }, {
    $set: { hiddenFromForest: true, inclusionChangedAt: clock() }, $inc: { recordRevision: 1 } });
  const list = await reads.listMarked({ ownerUserId: OWNER, limit: 1 });
  assert.equal(list.markers.length, 1);
  assert.equal(list.markers[0].writingState, 'unavailable');
  const filter = { ownerUserId: OWNER, forestId: FOREST, schemaVersion: 2, state: 'active' };
  const plan = await ForestAuthoredObject.find(filter).sort({ objectId: 1 }).limit(26)
    .hint('forest_authored_linked_marker_list').explain('executionStats');
  assert.ok(JSON.stringify(plan.queryPlanner.winningPlan).includes('forest_authored_linked_marker_list'));
  assert.ok(!JSON.stringify(plan.queryPlanner.winningPlan).includes('COLLSCAN'));
  assert.ok(plan.executionStats.totalDocsExamined <= 1);
  const cells = [{ cellX: 0, cellY: 0 }];
  await expectCode(readForestAuthoredRegionManifest({ ownerUserId: OWNER, cells }), 'AUTHORED_UPGRADE_REQUIRED');
  const first = await readForestAuthoredRegionManifest({ ownerUserId: OWNER, cells, version: 2, limit: 1 });
  assert.ok(first.page.nextCursor);
  const next = await readForestAuthoredRegionManifest({ ownerUserId: OWNER, cells, version: 2, limit: 1, cursor: first.page.nextCursor });
  assert.equal(next.objects[0].schemaVersion, 2);
  await service.move({ ownerUserId: OWNER, objectId: ORDINARY, protocolVersion: 1, expectedRevision: 1, worldX: 260, worldY: 100 });
  await expectCode(readForestAuthoredRegionManifest({ ownerUserId: OWNER, cells, version: 2, cursor: first.page.nextCursor }), 'AUTHORED_REGION_CHANGED');
  const diagnostic = await buildForestAuthoredDiagnosticExportService({ now: clock })({ ownerUserId: OWNER, includeRemoved: true, version: 2 });
  assert.deepEqual(diagnostic.objects.map(object => object.schemaVersion), [1, 2, 2]);
  assert.ok(!JSON.stringify(diagnostic).includes('writingLink'));
  assert.ok(!JSON.stringify(diagnostic).includes(TREE));
  checks.push('inclusive range, hidden-source rows, actual partial-index plan, mixed pagination and diagnostic privacy');

  creationEnabled = false; // Compatible reset scope is independent of new linked creation.
  const started = await reset.request({ ownerUserId: OWNER, resetId: MIXED_RESET });
  assert.equal(started.operationVersion, 2);
  const operation = await ForestAuthoredResetOperation.findOne({ ownerUserId: OWNER, resetId: MIXED_RESET }).lean();
  assert.deepEqual(operation.authoredObjectSchemaVersions, [1, 2]);
  assert.equal(Object.hasOwn(operation, 'authoredObjectSchemaVersion'), false);
  let resetResult;
  for (let batch = 0; batch < 10; batch += 1) {
    resetResult = await reset.processBatch({ ownerUserId: OWNER, resetId: MIXED_RESET, batchSize: 1 });
    if (resetResult.status === 'completed') break;
  }
  assert.equal(resetResult.status, 'completed');
  assert.equal(resetResult.affectedObjectCount, 2);
  now = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000);
  const retention = buildForestAuthoredRetentionCleanupService({ clock, models: {
    ForestAuthoredObject: { find: query => ForestAuthoredObject.find({ ...query, ownerUserId: OWNER }),
      deleteOne: query => ForestAuthoredObject.deleteOne({ ...query, ownerUserId: OWNER }) },
    ForestAuthoredResetOperation: { find: query => ForestAuthoredResetOperation.find({ ...query, ownerUserId: OWNER }),
      deleteOne: query => ForestAuthoredResetOperation.deleteOne({ ...query, ownerUserId: OWNER }) }
  } });
  assert.deepEqual(await retention.purgeTombstones(), { selected: 3, deleted: 3, failed: 0 });
  assert.deepEqual(await retention.purgeCompletedResetOperations(), { selected: 2, deleted: 2, failed: 0 });
  checks.push('mixed bounded reset, preserved old reset scope, exact mixed tombstone/reset retention');

  // Account deletion intentionally drains all owned formats, including unknown future ones.
  await ForestAuthoredObject.collection.insertMany([1, 2, 99].map((schemaVersion, index) => {
    const object = { ...linkedSnapshot, _id: new mongoose.Types.ObjectId(), schemaVersion, objectId: id(20 + index) };
    if (schemaVersion === 1) {
      delete object.writingLink;
      object.creationFingerprint = { version: 1, digest: 'A'.repeat(43) };
    }
    if (schemaVersion === 99) {
      object.state = 'removed';
      object.changedAt = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      object.removedAt = object.changedAt;
      object.purgeEligibleAt = new Date(now.getTime() - 1);
    }
    return object;
  }));
  assert.deepEqual(await retention.purgeTombstones(), { selected: 1, deleted: 0, failed: 1 });
  await AccountDeletionRequest.create({ ownerUserId: OWNER, disposition: 'delete', status: 'completed',
    startedAt: clock(), completedAt: clock(), forestCleanup: { status: 'pending' } });
  const cleanup = await cleanUpAccountDeletionForests({ ownerUserId: OWNER, limit: 1, treeBatchSize: 1, maxTreeBatchesPerRequest: 10 });
  assert.equal(cleanup.completed, 1);
  assert.equal(cleanup.deletedAuthoredObjects, 3);
  assert.equal(await ForestAuthoredObject.countDocuments({ ownerUserId: OWNER }), 0);
  assert.equal(await ForestOwnerWorld.countDocuments({ ownerUserId: OWNER }), 0);
  checks.push('retention preserves unknown formats; bounded account deletion drains all owned formats');
  console.log(JSON.stringify({ fixture: 'writing-linked-marker', database: 'daily-page-test', checks }, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || !['run', 'reset'].includes(args[0]) || args[1] !== '--write') {
    throw new Error('Usage: node scripts/dev/forestWritingLinkedMarkerFixture.js run|reset --write');
  }
  assertSafeEnvironment();
  await initMongooseConnection({ useProductionDb: false, quiet: true });
  assert.equal(mongoose.connection.name, 'daily-page-test');
  for (const model of models) {
    try { await model.createCollection(); }
    catch (error) { if (error.code !== 48) throw error; }
    if (![Block, User].includes(model)) await model.createIndexes();
  }
  if (args[0] === 'reset') return resetFixture();
  try { await runFixture(); }
  finally { await resetFixture(); }
}
main().catch(error => {
  // Never log connection strings, document bodies, credentials or raw database errors.
  console.error('Writing-linked marker fixture failed:', error.name, error.code || 'CHECK_FAILED');
  if (error instanceof assert.AssertionError) console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

import crypto from 'node:crypto';

import mongoose from 'mongoose';

import AccountDeletionRequest from '../../server/db/models/AccountDeletionRequest.js';
import ForestAuthoredObject from '../../server/db/models/ForestAuthoredObject.js';
import ForestAuthoredRegionRevision from '../../server/db/models/ForestAuthoredRegionRevision.js';
import ForestAuthoredResetOperation from '../../server/db/models/ForestAuthoredResetOperation.js';
import ForestOwnerWorld from '../../server/db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../../server/db/models/ForestWritingTree.js';
import User from '../../server/db/models/User.js';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import {
  buildForestAuthoredDiagnosticExportService
} from '../../server/services/forestAuthoredDiagnosticExport.js';
import {
  buildForestAuthoredMigrationHarness
} from '../../server/services/forestAuthoredMigrationHarness.js';
import {
  buildForestAuthoredObjectMutationService
} from '../../server/services/forestAuthoredObjectMutation.js';
import {
  readForestAuthoredRegionManifest
} from '../../server/services/forestAuthoredRegionManifest.js';
import {
  buildForestAuthoredResetService
} from '../../server/services/forestAuthoredReset.js';
import {
  buildForestAuthoredRetentionCleanupService,
  FOREST_AUTHORED_RESET_RETENTION_MS
} from '../../server/services/forestAuthoredRetentionCleanup.js';

const OWNER = '64b00000000000000000a051';
const FOREST = 'a4200000-0000-4000-8000-000000000001';
const MARKER_A = 'a4200000-0000-4000-8000-000000000002';
const MARKER_B = 'a4200000-0000-4000-8000-000000000003';
const MARKER_C = 'a4200000-0000-4000-8000-000000000004';
const BLOCKED_MARKER = 'a4200000-0000-4000-8000-000000000005';
const RESET = 'a4200000-0000-4000-8000-000000000006';
const USERNAME = 'forest_authored_lifecycle_fixture';
const MIGRATION_SCOPE = 'forest-authored-lifecycle-fixture';
const MIGRATION_COLLECTION = 'forest-authored-migration-fixture-records';

let fixtureNow = new Date(Date.now() + 60_000);

function clock() {
  return new Date(fixtureNow);
}

function usage() {
  console.log('Usage: npm run forest:authored-lifecycle-fixture -- run --write');
  console.log('       npm run forest:authored-lifecycle-fixture -- reset --write');
  console.log('');
  console.log('This script only connects to daily-page-test. Production access is unsupported.');
}

function parseArgs(argv) {
  const [command, ...options] = argv;
  if (!['run', 'reset'].includes(command) || options.some(option => option !== '--write')) {
    usage();
    throw new Error('Expected run or reset and no unsupported options.');
  }
  if (!options.includes('--write')) {
    throw new Error(`${command} changes fixture data and requires --write.`);
  }
  return { command };
}

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === 'production' || envFlag(process.env.USE_PRODUCTION_DB)) {
    throw new Error('Refusing to run the authored-lifecycle fixture in production.');
  }
}

function migrationCollection() {
  return mongoose.connection.collection(MIGRATION_COLLECTION);
}

async function connectFixtureDatabase() {
  assertSafeEnvironment();
  await initMongooseConnection({ useProductionDb: false });
  if (mongoose.connection.name !== 'daily-page-test') {
    throw new Error(
      `Refusing fixture operation on unexpected database "${mongoose.connection.name}".`
    );
  }
  for (const model of [
    AccountDeletionRequest,
    ForestAuthoredObject,
    ForestAuthoredRegionRevision,
    ForestAuthoredResetOperation,
    ForestOwnerWorld,
    ForestWritingTree,
    User
  ]) {
    try {
      await model.createCollection();
    } catch (error) {
      if (error?.codeName !== 'NamespaceExists' && error?.code !== 48) throw error;
    }
    await model.createIndexes();
  }
  await migrationCollection().createIndex(
    { fixtureScope: 1, recordId: 1 },
    { unique: true, name: 'forest_authored_migration_fixture_record' }
  );
}

async function resetFixture() {
  await Promise.all([
    AccountDeletionRequest.deleteMany({ ownerUserId: OWNER }),
    ForestAuthoredObject.deleteMany({ ownerUserId: OWNER }),
    ForestAuthoredRegionRevision.deleteMany({ ownerUserId: OWNER }),
    ForestAuthoredResetOperation.deleteMany({ ownerUserId: OWNER }),
    ForestWritingTree.deleteMany({ ownerUserId: OWNER }),
    ForestOwnerWorld.deleteMany({ ownerUserId: OWNER }),
    User.deleteMany({ $or: [{ _id: OWNER }, { username: USERNAME }] }),
    migrationCollection().deleteMany({ fixtureScope: MIGRATION_SCOPE })
  ]);
}

async function seedFixture() {
  await User.create({
    _id: OWNER,
    username: USERNAME,
    email: `${USERNAME}@example.test`,
    password: 'not-a-login-credential',
    verified: true,
    forestLedgerFence: 0
  });
  await ForestOwnerWorld.create({
    forestId: FOREST,
    ownerUserId: OWNER,
    worldRole: 'primary',
    status: 'active',
    worldSeed: crypto.createHash('sha256').update(FOREST).digest('base64url'),
    placementPolicyVersion: 1,
    nextCandidateSlot: 1,
    placementRevision: 1,
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1
  });
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function requireCode(promise, code) {
  try {
    await promise;
  } catch (error) {
    if (error?.code === code) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

function createInput(objectId, worldX) {
  return {
    ownerUserId: OWNER,
    objectId,
    protocolVersion: 1,
    kind: 'personal-marker',
    worldX,
    worldY: 0
  };
}

async function diagnosticProof(diagnostic) {
  const first = await diagnostic({
    ownerUserId: OWNER,
    includeRemoved: true,
    limit: 1
  });
  const second = await diagnostic({
    ownerUserId: OWNER,
    includeRemoved: true,
    cursor: first.page.nextCursor,
    limit: 1
  });
  const third = await diagnostic({
    ownerUserId: OWNER,
    includeRemoved: true,
    cursor: second.page.nextCursor,
    limit: 1
  });
  requireCondition(
    first.objects.length === 1
      && first.objects[0].state === 'removed'
      && second.objects.length === 1
      && second.objects[0].state === 'active'
      && third.objects.length === 1
      && third.objects[0].state === 'active'
      && third.page.nextCursor === null,
    'Diagnostic continuation did not return the complete lifecycle inventory.'
  );

  const activeOnly = await diagnostic({
    ownerUserId: OWNER,
    includeRemoved: false,
    limit: 1
  });
  requireCondition(
    activeOnly.page.inspectedObjectCount === 1
      && activeOnly.page.returnedObjectCount === 0
      && activeOnly.objects.length === 0
      && typeof activeOnly.page.nextCursor === 'string',
    'Active-only diagnostics did not safely continue past a tombstone.'
  );
  return { lifecyclePages: 3, activeOnlySkippedTombstone: true };
}

async function resetProof({ mutations, reset }) {
  const requested = await reset.request({ ownerUserId: OWNER, resetId: RESET });
  requireCondition(requested.outcome === 'started', 'Reset did not start exactly once.');

  const resettingRegion = await readForestAuthoredRegionManifest({
    ownerUserId: OWNER,
    cells: [{ cellX: 0, cellY: 0 }]
  });
  requireCondition(
    resettingRegion.status === 'resetting' && resettingRegion.objects.length === 0,
    'Regional state did not fail closed while reset was processing.'
  );
  await requireCode(
    mutations.create(createInput(BLOCKED_MARKER, 900)),
    'AUTHORED_RESETTING'
  );

  const firstBatch = await reset.processBatch({
    ownerUserId: OWNER,
    resetId: RESET,
    batchSize: 1
  });
  requireCondition(
    firstBatch.outcome === 'progressed' && firstBatch.affectedObjectCount === 1,
    'Reset did not persist its first bounded checkpoint.'
  );
  const worker = await reset.processOperations({ limit: 1, batchSize: 1 });
  requireCondition(
    worker.requested === 1 && worker.completed === 1 && worker.failed === 0,
    'Reset worker did not resume and complete the interrupted operation.'
  );
  const retry = await reset.processBatch({
    ownerUserId: OWNER,
    resetId: RESET,
    batchSize: 1
  });
  requireCondition(
    retry.outcome === 'already-completed' && retry.affectedObjectCount === 2,
    'Completed reset retry did not return its durable aggregate result.'
  );
  return {
    initialOutcome: requested.outcome,
    firstBatch: firstBatch.outcome,
    workerCompleted: worker.completed,
    retryOutcome: retry.outcome,
    affectedObjectCount: retry.affectedObjectCount
  };
}

function revisionSnapshot(rows) {
  return rows.map(value => ({
    cellX: value.cellX,
    cellY: value.cellY,
    revision: value.revision
  }));
}

function ownerScopedRetentionModels() {
  return {
    ForestAuthoredObject: {
      find: filter => ForestAuthoredObject.find({ ...filter, ownerUserId: OWNER }),
      deleteOne: filter => ForestAuthoredObject.deleteOne({ ...filter, ownerUserId: OWNER })
    },
    ForestAuthoredResetOperation: {
      find: filter => ForestAuthoredResetOperation.find({ ...filter, ownerUserId: OWNER }),
      deleteOne: filter => ForestAuthoredResetOperation.deleteOne({
        ...filter,
        ownerUserId: OWNER
      })
    }
  };
}

async function drain(operation, expectedDeleted) {
  const totals = { selected: 0, deleted: 0, failed: 0, batches: 0 };
  for (let attempt = 0; attempt <= expectedDeleted; attempt += 1) {
    const value = await operation({ batchSize: 1 });
    totals.selected += value.selected;
    totals.deleted += value.deleted;
    totals.failed += value.failed;
    totals.batches += 1;
    if (value.selected === 0) return totals;
  }
  throw new Error('Retention cleanup did not converge within its fixture bound.');
}

async function retentionProof(retention) {
  const before = revisionSnapshot(await ForestAuthoredRegionRevision.find({
    ownerUserId: OWNER
  }).sort({ cellX: 1, cellY: 1 }).lean());
  const tombstones = await drain(
    options => retention.purgeTombstones(options),
    3
  );
  const resets = await drain(
    options => retention.purgeCompletedResetOperations(options),
    1
  );
  const after = revisionSnapshot(await ForestAuthoredRegionRevision.find({
    ownerUserId: OWNER
  }).sort({ cellX: 1, cellY: 1 }).lean());
  requireCondition(
    tombstones.deleted === 3 && tombstones.failed === 0,
    'Tombstone retention did not delete three eligible records in bounded batches.'
  );
  requireCondition(
    resets.deleted === 1 && resets.failed === 0,
    'Reset retention did not delete one eligible completed operation.'
  );
  requireCondition(
    JSON.stringify(after) === JSON.stringify(before),
    'Physical tombstone purge changed active regional revision evidence.'
  );
  return {
    tombstonesDeleted: tombstones.deleted,
    tombstoneBatches: tombstones.batches,
    resetOperationsDeleted: resets.deleted,
    resetBatches: resets.batches,
    regionalRevisionsUnchanged: true
  };
}

function migrationDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify([
    value.objectId,
    value.creationFingerprint,
    value.position,
    value.recordRevision,
    value.state,
    value.createdAt,
    value.changedAt
  ])).digest('base64url');
}

function preserved(source, target) {
  return target.schemaVersion === 8
    && target.objectId === source.objectId
    && target.creationFingerprint === source.creationFingerprint
    && JSON.stringify(target.position) === JSON.stringify(source.position)
    && target.recordRevision === source.recordRevision
    && target.state === source.state
    && target.createdAt.getTime() === source.createdAt.getTime()
    && target.changedAt.getTime() === source.changedAt.getTime()
    && target.recordIntegrity?.version === 1
    && target.recordIntegrity?.digest === migrationDigest(source);
}

async function migrationProof() {
  const collection = migrationCollection();
  await collection.insertMany([1, 2, 3].map(ordinal => ({
    fixtureScope: MIGRATION_SCOPE,
    recordId: `migration-record-${ordinal}`,
    schemaVersion: 7,
    objectId: `fixture-object-${ordinal}`,
    creationFingerprint: `fixture-fingerprint-${ordinal}`,
    position: { worldX: ordinal * 30, worldY: 0 },
    recordRevision: ordinal,
    state: ordinal === 3 ? 'removed' : 'active',
    createdAt: new Date(fixtureNow.getTime() - 120_000),
    changedAt: new Date(fixtureNow.getTime() - 60_000)
  })));

  let writeAttempt = 0;
  let interruptSecondWrite = true;
  const plan = {
    planId: 'disposable-mongo-marker-fixture',
    sourceVersion: 7,
    targetVersion: 8,
    readBatch: ({ afterRecordId, limit }) => collection.find({
      fixtureScope: MIGRATION_SCOPE,
      ...(afterRecordId ? { recordId: { $gt: afterRecordId } } : {})
    }).sort({ recordId: 1 }).limit(limit).toArray(),
    classify: value => ({
      recordId: value.recordId,
      state: value.schemaVersion === 7
        ? 'source'
        : value.schemaVersion === 8 ? 'target' : 'unsupported'
    }),
    transform: value => ({
      ...value,
      schemaVersion: 8,
      recordIntegrity: { version: 1, digest: migrationDigest(value) }
    }),
    validate: preserved,
    compareAndSet: async (source, target) => {
      writeAttempt += 1;
      if (interruptSecondWrite && writeAttempt === 2) throw new Error('fixture interruption');
      const write = await collection.replaceOne({
        _id: source._id,
        fixtureScope: MIGRATION_SCOPE,
        schemaVersion: 7,
        recordRevision: source.recordRevision
      }, target);
      if (write.modifiedCount === 1) return 'migrated';
      const current = await collection.findOne({ _id: source._id });
      return current?.schemaVersion === 8 && preserved(source, current)
        ? 'already-current' : 'conflict';
    }
  };
  const harness = buildForestAuthoredMigrationHarness({ plan });
  const dryRun = await harness.processBatch();
  requireCondition(
    dryRun.wouldMigrate === 3
      && dryRun.migrated === 0
      && await collection.countDocuments({
        fixtureScope: MIGRATION_SCOPE, schemaVersion: 7
      }) === 3,
    'Migration dry-run changed disposable Mongo records.'
  );

  const interrupted = await harness.processBatch({ mode: 'apply' });
  requireCondition(
    interrupted.migrated === 1
      && interrupted.failed === 1
      && interrupted.blockedReason === 'unavailable'
      && typeof interrupted.nextCheckpoint === 'string',
    'Migration interruption did not retain its last safe checkpoint.'
  );
  interruptSecondWrite = false;
  const resumed = await harness.processBatch({
    mode: 'apply',
    checkpoint: interrupted.nextCheckpoint
  });
  requireCondition(
    resumed.migrated === 2 && resumed.failed === 0 && resumed.nextCheckpoint === null,
    'Migration did not resume after its accepted checkpoint.'
  );
  const rerun = await harness.processBatch({ mode: 'apply' });
  requireCondition(
    rerun.migrated === 0 && rerun.alreadyCurrent === 3 && rerun.failed === 0,
    'Migration rerun was not idempotent.'
  );
  return {
    dryRunWouldMigrate: dryRun.wouldMigrate,
    interruptedAfter: interrupted.migrated,
    resumed: resumed.migrated,
    rerunAlreadyCurrent: rerun.alreadyCurrent
  };
}

async function runFixture() {
  await resetFixture();
  await seedFixture();
  const mutations = buildForestAuthoredObjectMutationService({ clock });
  const reset = buildForestAuthoredResetService({ clock });
  const diagnostic = buildForestAuthoredDiagnosticExportService({ now: clock });

  await mutations.create(createInput(MARKER_A, 0));
  await mutations.create(createInput(MARKER_B, 300));
  await mutations.create(createInput(MARKER_C, 600));
  await mutations.remove({
    ownerUserId: OWNER,
    objectId: MARKER_A,
    protocolVersion: 1,
    expectedRevision: 1
  });
  const diagnostics = await diagnosticProof(diagnostic);

  fixtureNow = new Date(fixtureNow.getTime() + 60_000);
  const resetResult = await resetProof({ mutations, reset });
  fixtureNow = new Date(fixtureNow.getTime() + FOREST_AUTHORED_RESET_RETENTION_MS);
  const retention = buildForestAuthoredRetentionCleanupService({
    clock,
    models: ownerScopedRetentionModels()
  });
  const retentionResult = await retentionProof(retention);
  const migration = await migrationProof();

  requireCondition(
    await ForestAuthoredObject.countDocuments({ ownerUserId: OWNER }) === 0
      && await ForestAuthoredResetOperation.countDocuments({ ownerUserId: OWNER }) === 0,
    'Lifecycle fixture did not converge after retention cleanup.'
  );

  console.log(JSON.stringify({
    fixture: 'forest-authored-lifecycle',
    database: mongoose.connection.name,
    diagnostics,
    reset: resetResult,
    retention: retentionResult,
    migration
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await connectFixtureDatabase();
  if (args.command === 'reset') {
    await resetFixture();
    console.log('Forest authored-lifecycle fixture reset.');
    return;
  }
  try {
    await runFixture();
  } finally {
    await resetFixture();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

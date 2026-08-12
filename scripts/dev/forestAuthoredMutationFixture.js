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
  buildForestAuthoredObjectMutationService,
  forestAuthoredObjectMutations,
  FOREST_AUTHORED_TOMBSTONE_RETENTION_MS
} from '../../server/services/forestAuthoredObjectMutation.js';
import {
  projectPostToForestTree
} from '../../server/services/forestPostTreeProjection.js';

const OWNER = '64b00000000000000000a041';
const FOREST = 'a4100000-0000-4000-8000-000000000001';
const TREE = 'a4100000-0000-4000-8000-000000000002';
const PRIMARY = 'a4100000-0000-4000-8000-000000000003';
const CONCURRENT_A = 'a4100000-0000-4000-8000-000000000004';
const CONCURRENT_B = 'a4100000-0000-4000-8000-000000000005';
const ABORTED = 'a4100000-0000-4000-8000-000000000006';
const TREE_COLLISION = 'a4100000-0000-4000-8000-000000000007';
const SHARED_ID = 'a4100000-0000-4000-8000-000000000008';
const CAS_OBJECT = 'a4100000-0000-4000-8000-000000000009';
const USERNAME = 'forest_authored_mutation_fixture';
const NOW = new Date('2026-08-12T12:00:00.000Z');

function usage() {
  console.log('Usage: npm run forest:authored-mutation-fixture -- run --write');
  console.log('       npm run forest:authored-mutation-fixture -- reset --write');
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
    throw new Error('Refusing to run the authored-mutation fixture in production.');
  }
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
}

async function resetFixture() {
  await Promise.all([
    AccountDeletionRequest.deleteMany({ ownerUserId: OWNER }),
    ForestAuthoredObject.deleteMany({ ownerUserId: OWNER }),
    ForestAuthoredRegionRevision.deleteMany({ ownerUserId: OWNER }),
    ForestAuthoredResetOperation.deleteMany({ ownerUserId: OWNER }),
    ForestWritingTree.deleteMany({ ownerUserId: OWNER }),
    ForestOwnerWorld.deleteMany({ ownerUserId: OWNER }),
    User.deleteMany({ $or: [{ _id: OWNER }, { username: USERNAME }] })
  ]);
}

function projection() {
  const projected = projectPostToForestTree({
    id: TREE,
    createdAt: NOW.toISOString(),
    roomId: 'daily'
  }, { habitat: 'neutral-grove' });
  return {
    revision: 1,
    schemaVersion: projected.schemaVersion,
    mappingVersion: projected.mappingVersion,
    specimenSeed: projected.specimen.seed,
    phenotypeId: projected.phenotype.id,
    phenotypeAssetVersion: projected.phenotype.version,
    creationSeason: projected.permanentTraits.creationSeason,
    foliagePaletteId: projected.permanentTraits.foliagePaletteId,
    projectionFingerprint: projected.identity.projectionFingerprint,
    visualFingerprint: projected.identity.visualFingerprint
  };
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
  await ForestWritingTree.create({
    writingTreeId: TREE,
    forestId: FOREST,
    ownerUserId: OWNER,
    translationGroupId: '64b00000000000000000a042',
    sourceState: 'inactive',
    sourceStateChangedAt: NOW,
    hiddenFromForest: true,
    inclusionChangedAt: NOW,
    foundingSource: {
      blockId: '64b00000000000000000a043',
      createdAt: NOW
    },
    placement: { policyVersion: 1, slot: 0, worldX: 100, worldY: 100 },
    placementIndex: { version: 1, cellX: 0, cellY: 0 },
    originatingEnvironment: {
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1,
      regionId: 'fixture-grove',
      habitatId: 'neutral-grove',
      groundSurfaceId: 'fixture-ground',
      transitionState: 'fixture-core'
    },
    projection: projection(),
    policyEvidence: {
      ownerWritingPolicyVersion: 2,
      ownerVariantSelectionVersion: 1,
      writingLifecyclePolicyVersion: 1
    },
    lastEligibleReconciliationEpoch: 0,
    recordRevision: 1
  });
}

function createInput(objectId, worldX, worldY) {
  return {
    ownerUserId: OWNER,
    objectId,
    protocolVersion: 1,
    kind: 'personal-marker',
    worldX,
    worldY
  };
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function requireCode(promise, code) {
  try {
    await promise;
  } catch (error) {
    if (error?.code === code) return error;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

async function requireMessage(promise, message) {
  try {
    await promise;
  } catch (error) {
    if (error?.message === message) return error;
    throw error;
  }
  throw new Error(`Expected ${message}.`);
}

async function abortAfterWork(work) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await work(session);
      throw new Error('INTENTIONAL_AUTHORED_FIXTURE_ABORT');
    });
  } finally {
    await session.endSession();
  }
}

async function runFixture() {
  await resetFixture();
  await seedFixture();

  const equalCreates = await Promise.all([
    forestAuthoredObjectMutations.create(createInput(PRIMARY, 0, 0)),
    forestAuthoredObjectMutations.create(createInput(PRIMARY, 0, 0))
  ]);
  requireCondition(
    equalCreates.map(value => value.outcome).sort().join(',')
      === 'created,existing-active',
    'Concurrent equal create did not converge on one logical marker.'
  );
  requireCondition(
    await ForestAuthoredObject.countDocuments({ ownerUserId: OWNER, objectId: PRIMARY }) === 1,
    'Concurrent equal create persisted more than one marker.'
  );

  const competing = await Promise.allSettled([
    forestAuthoredObjectMutations.create(createInput(CONCURRENT_A, 300, 300)),
    forestAuthoredObjectMutations.create(createInput(CONCURRENT_B, 310, 300))
  ]);
  const accepted = competing.filter(value => value.status === 'fulfilled');
  const rejected = competing.filter(value => value.status === 'rejected');
  requireCondition(accepted.length === 1, 'Competing colliding creates did not accept exactly one.');
  requireCondition(
    rejected.length === 1
      && rejected[0].reason?.code === 'AUTHORED_PLACEMENT_COLLISION',
    'Competing colliding creates did not reject the loser as a collision.'
  );

  const competingIdentity = await Promise.allSettled([
    forestAuthoredObjectMutations.create(createInput(SHARED_ID, -300, 300)),
    forestAuthoredObjectMutations.create(createInput(SHARED_ID, -300, 330))
  ]);
  const identityAccepted = competingIdentity.filter(value => value.status === 'fulfilled');
  const identityRejected = competingIdentity.filter(value => value.status === 'rejected');
  requireCondition(
    identityAccepted.length === 1 && identityAccepted[0].value.outcome === 'created',
    'Competing intent under one object id did not accept exactly one creation.'
  );
  requireCondition(
    identityRejected.length === 1
      && identityRejected[0].reason?.code === 'AUTHORED_CREATE_IDEMPOTENCY_CONFLICT',
    'Competing intent under one object id did not preserve the winning identity.'
  );

  await forestAuthoredObjectMutations.create(createInput(CAS_OBJECT, -600, 300));
  const competingCas = await Promise.allSettled([
    forestAuthoredObjectMutations.move({
      ownerUserId: OWNER,
      objectId: CAS_OBJECT,
      protocolVersion: 1,
      expectedRevision: 1,
      worldX: -570,
      worldY: 300
    }),
    forestAuthoredObjectMutations.remove({
      ownerUserId: OWNER,
      objectId: CAS_OBJECT,
      protocolVersion: 1,
      expectedRevision: 1
    })
  ]);
  const casAccepted = competingCas.filter(value => value.status === 'fulfilled');
  const casRejected = competingCas.filter(value => value.status === 'rejected');
  requireCondition(
    casAccepted.length === 1 && ['moved', 'removed'].includes(casAccepted[0].value.outcome),
    'Competing move and removal did not commit exactly one compare-and-set change.'
  );
  requireCondition(
    casRejected.length === 1
      && ['AUTHORED_OBJECT_CONFLICT', 'AUTHORED_OBJECT_REMOVED']
        .includes(casRejected[0].reason?.code),
    'Competing move and removal did not reject the stale operation.'
  );

  const moved = await forestAuthoredObjectMutations.move({
    ownerUserId: OWNER,
    objectId: PRIMARY,
    protocolVersion: 1,
    expectedRevision: 1,
    worldX: 30,
    worldY: 0
  });
  requireCondition(moved.outcome === 'moved' && moved.object.recordRevision === 2,
    'Same-cell move did not commit revision 2.');
  const recoveredMove = await forestAuthoredObjectMutations.move({
    ownerUserId: OWNER,
    objectId: PRIMARY,
    protocolVersion: 1,
    expectedRevision: 1,
    worldX: 30,
    worldY: 0
  });
  requireCondition(
    recoveredMove.outcome === 'unchanged' && recoveredMove.object.recordRevision === 2,
    'Lost-response move retry did not recover the committed desired state.'
  );
  await requireCode(forestAuthoredObjectMutations.move({
    ownerUserId: OWNER,
    objectId: PRIMARY,
    protocolVersion: 1,
    expectedRevision: 1,
    worldX: 60,
    worldY: 0
  }), 'AUTHORED_OBJECT_CONFLICT');

  const crossCell = await forestAuthoredObjectMutations.move({
    ownerUserId: OWNER,
    objectId: PRIMARY,
    protocolVersion: 1,
    expectedRevision: 2,
    worldX: 720,
    worldY: -1
  });
  requireCondition(
    crossCell.outcome === 'moved'
      && crossCell.object.recordRevision === 3
      && crossCell.object.placementIndex.cellX === 1
      && crossCell.object.placementIndex.cellY === -1,
    'Cross-cell move did not preserve identity and advance its revision.'
  );

  const removed = await forestAuthoredObjectMutations.remove({
    ownerUserId: OWNER,
    objectId: PRIMARY,
    protocolVersion: 1,
    expectedRevision: 3
  });
  requireCondition(
    removed.outcome === 'removed'
      && removed.object.recordRevision === 4
      && removed.object.purgeEligibleAt.getTime() - removed.object.removedAt.getTime()
        === FOREST_AUTHORED_TOMBSTONE_RETENTION_MS,
    'Removal did not create the accepted revision-4 90-day tombstone.'
  );
  const repeatedRemoval = await forestAuthoredObjectMutations.remove({
    ownerUserId: OWNER,
    objectId: PRIMARY,
    protocolVersion: 1,
    expectedRevision: 3
  });
  requireCondition(
    repeatedRemoval.outcome === 'already-removed'
      && repeatedRemoval.object.recordRevision === 4,
    'Removal retry was not idempotent.'
  );
  const recoveredCreate = await forestAuthoredObjectMutations.create(
    createInput(PRIMARY, 0, 0)
  );
  requireCondition(
    recoveredCreate.outcome === 'existing-removed'
      && recoveredCreate.object.recordRevision === 4,
    'Original create retry resurrected or lost the removed marker.'
  );

  await requireCode(
    forestAuthoredObjectMutations.create(createInput(TREE_COLLISION, 100, 100)),
    'AUTHORED_PLACEMENT_COLLISION'
  );

  const abortingService = buildForestAuthoredObjectMutationService({
    transactionRunner: abortAfterWork
  });
  await requireMessage(
    abortingService.create(createInput(ABORTED, -300, -300)),
    'INTENTIONAL_AUTHORED_FIXTURE_ABORT'
  );
  requireCondition(
    await ForestAuthoredObject.countDocuments({ ownerUserId: OWNER, objectId: ABORTED }) === 0,
    'An aborted transaction leaked its authored object write.'
  );
  const recoveredAbort = await forestAuthoredObjectMutations.create(
    createInput(ABORTED, -300, -300)
  );
  requireCondition(
    recoveredAbort.outcome === 'created',
    'A clean retry did not recover after transaction abort.'
  );

  const [activeCount, removedCount, revisions, owner] = await Promise.all([
    ForestAuthoredObject.countDocuments({ ownerUserId: OWNER, state: 'active' }),
    ForestAuthoredObject.countDocuments({ ownerUserId: OWNER, state: 'removed' }),
    ForestAuthoredRegionRevision.find({ ownerUserId: OWNER }).sort({ cellX: 1, cellY: 1 }).lean(),
    User.findById(OWNER).lean()
  ]);
  requireCondition(activeCount + removedCount === 5, 'Unexpected final authored-object count.');
  requireCondition(
    (activeCount === 4 && removedCount === 1)
      || (activeCount === 3 && removedCount === 2),
    'Competing compare-and-set produced an incoherent final lifecycle count.'
  );
  requireCondition(revisions.length === 4, 'Expected exactly four touched cell revisions.');
  requireCondition(owner.forestLedgerFence > 0, 'Owner ledger fence did not advance.');

  console.log(JSON.stringify({
    fixture: 'forest-authored-mutation',
    database: mongoose.connection.name,
    equalCreateOutcomes: equalCreates.map(value => value.outcome).sort(),
    competingCreate: {
      accepted: accepted[0].value.outcome,
      rejected: rejected[0].reason.code
    },
    competingIdentity: {
      accepted: identityAccepted[0].value.outcome,
      rejected: identityRejected[0].reason.code
    },
    competingCompareAndSet: {
      accepted: casAccepted[0].value.outcome,
      rejected: casRejected[0].reason.code
    },
    moveRecovery: recoveredMove.outcome,
    removalRecovery: repeatedRemoval.outcome,
    createAfterRemoval: recoveredCreate.outcome,
    abortRecovery: recoveredAbort.outcome,
    activeCount,
    removedCount,
    cellRevisions: revisions.map(value => ({
      cellX: value.cellX,
      cellY: value.cellY,
      revision: value.revision
    })),
    forestLedgerFence: owner.forestLedgerFence
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await connectFixtureDatabase();
  if (args.command === 'reset') {
    await resetFixture();
    console.log('Forest authored-mutation fixture reset.');
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

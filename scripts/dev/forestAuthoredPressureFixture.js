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
import {
  readForestOwnerRegionManifest
} from '../../server/services/forestOwnerRegionManifest.js';
import {
  deriveForestOwnerPlacementIndex
} from '../../server/services/forestOwnerPlacementNeighborhood.js';
import {
  projectPostToForestTree
} from '../../server/services/forestPostTreeProjection.js';
import {
  summarizeForestPressureTimings
} from '../lib/forestOwnerPressureFixture.js';

const PROFILE_DEFINITIONS = Object.freeze({
  empty: {
    ownerUserId: '64c000000000000000000001',
    forestId: 'a4300001-0000-4000-8000-000000000001',
    username: 'forest_authored_pressure_empty'
  },
  sparse: {
    ownerUserId: '64c000000000000000000002',
    forestId: 'a4300002-0000-4000-8000-000000000002',
    username: 'forest_authored_pressure_sparse'
  },
  dense: {
    ownerUserId: '64c000000000000000000003',
    forestId: 'a4300003-0000-4000-8000-000000000003',
    username: 'forest_authored_pressure_dense'
  },
  many: {
    ownerUserId: '64c000000000000000000004',
    forestId: 'a4300004-0000-4000-8000-000000000004',
    username: 'forest_authored_pressure_many'
  },
  combined55: {
    ownerUserId: '64c000000000000000000005',
    forestId: 'a4300005-0000-4000-8000-000000000005',
    username: 'forest_authored_pressure_combined_55'
  },
  reset: {
    ownerUserId: '64c000000000000000000006',
    forestId: 'a4300006-0000-4000-8000-000000000006',
    username: 'forest_authored_pressure_reset'
  },
  combined600: {
    ownerUserId: '64c000000000000000000007',
    forestId: 'a4300007-0000-4000-8000-000000000007',
    username: 'forest_authored_pressure_combined_600'
  }
});
const PROFILES = Object.freeze(Object.values(PROFILE_DEFINITIONS));
const OWNER_IDS = Object.freeze(PROFILES.map(profile => profile.ownerUserId));
const MIGRATION_SCOPE = 'forest-authored-pressure-fixture';
const MIGRATION_COLLECTION = 'forest-authored-pressure-migration-records';
const SPARSE_MARKER_COUNT = 36;
const DENSE_MARKER_COUNT = 128;
const MANY_REGION_MARKER_COUNT = 256;
const COMBINED_MARKER_COUNT = 36;
const COMBINED_TREE_COUNTS = Object.freeze([55, 600]);
const RESET_MARKER_COUNT = 20;
const MIGRATION_RECORD_COUNT = 500;
const PAGE_SIZE = 100;
const FIXTURE_DATE = new Date('2026-08-16T12:00:00.000Z');

let fixtureNow = new Date(Date.now() + 60_000);

function clock() {
  return new Date(fixtureNow);
}

function usage() {
  console.log('Usage: npm run forest:authored-pressure-fixture -- run --write');
  console.log('       npm run forest:authored-pressure-fixture -- reset --write');
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
    throw new Error('Refusing to run the authored-pressure fixture in production.');
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
    { unique: true, name: 'forest_authored_pressure_migration_record' }
  );
}

async function resetFixture() {
  await Promise.all([
    AccountDeletionRequest.deleteMany({ ownerUserId: { $in: OWNER_IDS } }),
    ForestAuthoredObject.deleteMany({ ownerUserId: { $in: OWNER_IDS } }),
    ForestAuthoredRegionRevision.deleteMany({ ownerUserId: { $in: OWNER_IDS } }),
    ForestAuthoredResetOperation.deleteMany({ ownerUserId: { $in: OWNER_IDS } }),
    ForestWritingTree.deleteMany({ ownerUserId: { $in: OWNER_IDS } }),
    ForestOwnerWorld.deleteMany({ ownerUserId: { $in: OWNER_IDS } }),
    User.deleteMany({ $or: [
      { _id: { $in: OWNER_IDS } },
      { username: { $in: PROFILES.map(profile => profile.username) } }
    ] }),
    migrationCollection().deleteMany({ fixtureScope: MIGRATION_SCOPE })
  ]);
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function elapsedMilliseconds(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

async function measured(work) {
  const startedAt = process.hrtime.bigint();
  const result = await work();
  return { result, elapsedMs: elapsedMilliseconds(startedAt) };
}

async function measuredFailure(work, code) {
  const startedAt = process.hrtime.bigint();
  try {
    await work();
  } catch (error) {
    if (error?.code === code) {
      return { code, elapsedMs: elapsedMilliseconds(startedAt) };
    }
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

function measuredSerialization(value) {
  const startedAt = process.hrtime.bigint();
  const serialized = JSON.stringify(value);
  return {
    bytes: Buffer.byteLength(serialized, 'utf8'),
    elapsedMs: elapsedMilliseconds(startedAt)
  };
}

function fixtureUuid(prefix, ordinal) {
  return `${prefix}-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
}

function fixtureObjectId(ordinal) {
  return (BigInt('0x64d000000000000000000000') + BigInt(ordinal))
    .toString(16).padStart(24, '0');
}

function cellGrid(width, height) {
  return Array.from({ length: width * height }, (_, index) => ({
    cellX: index % width,
    cellY: Math.floor(index / width)
  }));
}

const NINE_CELLS = Object.freeze(cellGrid(3, 3));
const SIXTY_FOUR_CELLS = Object.freeze(cellGrid(8, 8));

async function seedAuthorities() {
  for (const profile of PROFILES) {
    await User.create({
      _id: profile.ownerUserId,
      username: profile.username,
      email: `${profile.username}@example.test`,
      password: 'not-a-login-credential',
      verified: true,
      forestLedgerFence: 0
    });
    await ForestOwnerWorld.create({
      forestId: profile.forestId,
      ownerUserId: profile.ownerUserId,
      worldRole: 'primary',
      status: 'active',
      worldSeed: crypto.createHash('sha256').update(profile.forestId).digest('base64url'),
      placementPolicyVersion: 1,
      nextCandidateSlot: 1,
      placementRevision: 1,
      environmentPolicyVersion: 1,
      environmentSchemaVersion: 1,
      worldGenerationVersion: 1
    });
  }
}

function markerDocument({ profile, objectId, worldX, worldY }) {
  const placementIndex = deriveForestOwnerPlacementIndex({ worldX, worldY });
  return {
    objectId,
    forestId: profile.forestId,
    ownerUserId: profile.ownerUserId,
    kind: 'personal-marker',
    state: 'active',
    placement: { worldX, worldY },
    placementIndex,
    worldVersionEvidence: {
      ownerWorldSchemaVersion: 1,
      placementPolicyVersion: 1,
      environmentPolicyVersion: 1,
      environmentSchemaVersion: 1,
      worldGenerationVersion: 1
    },
    appearance: { id: 'quiet-waymarker', version: 1 },
    creationFingerprint: {
      version: 1,
      digest: crypto.createHash('sha256').update(objectId).digest('base64url')
    },
    recordRevision: 1,
    changedAt: FIXTURE_DATE,
    removedAt: null,
    purgeEligibleAt: null,
    createdAt: FIXTURE_DATE,
    updatedAt: FIXTURE_DATE
  };
}

function distributedMarkers({ profile, cells, perCell, prefix, startOrdinal = 1 }) {
  const documents = [];
  let ordinal = startOrdinal;
  for (const cell of cells) {
    for (let local = 0; local < perCell; local += 1) {
      documents.push(markerDocument({
        profile,
        objectId: fixtureUuid(prefix, ordinal),
        worldX: (cell.cellX * 720) + 60 + ((local % 2) * 60),
        worldY: (cell.cellY * 720) + 60 + (Math.floor(local / 2) * 60)
      }));
      ordinal += 1;
    }
  }
  return documents;
}

function denseMarkers(profile) {
  return Array.from({ length: DENSE_MARKER_COUNT }, (_, index) => markerDocument({
    profile,
    objectId: fixtureUuid('a4320000', index + 1),
    worldX: 30 + ((index % 16) * 36),
    worldY: 30 + (Math.floor(index / 16) * 36)
  }));
}

function revisionDocuments(profile, cells) {
  return cells.map(cell => ({
    forestId: profile.forestId,
    ownerUserId: profile.ownerUserId,
    spatialIndexVersion: 1,
    cellX: cell.cellX,
    cellY: cell.cellY,
    revision: 1,
    createdAt: FIXTURE_DATE,
    updatedAt: FIXTURE_DATE
  }));
}

function writingTreeDocument(profile, ordinal, cell, prefix) {
  const writingTreeId = fixtureUuid(prefix, ordinal);
  const createdAt = new Date(FIXTURE_DATE.getTime() + (ordinal * 60_000));
  const projection = projectPostToForestTree({
    id: writingTreeId,
    createdAt: createdAt.toISOString(),
    roomId: 'daily'
  }, { habitat: 'neutral-grove' });
  const worldX = (cell.cellX * 720) + 420 + ((ordinal % 3) * 70);
  const worldY = (cell.cellY * 720) + 420 + (Math.floor((ordinal % 6) / 3) * 70);
  return {
    writingTreeId,
    forestId: profile.forestId,
    ownerUserId: profile.ownerUserId,
    translationGroupId: fixtureObjectId(ordinal),
    sourceState: 'active',
    sourceStateChangedAt: createdAt,
    hiddenFromForest: false,
    inclusionChangedAt: null,
    foundingSource: { blockId: fixtureObjectId(1_000 + ordinal), createdAt },
    placement: { policyVersion: 1, slot: ordinal - 1, worldX, worldY },
    placementIndex: deriveForestOwnerPlacementIndex({ worldX, worldY }),
    originatingEnvironment: {
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1,
      regionId: 'pressure-grove',
      habitatId: 'neutral-grove',
      groundSurfaceId: 'pressure-ground',
      transitionState: 'pressure-core'
    },
    projection: {
      revision: 1,
      schemaVersion: projection.schemaVersion,
      mappingVersion: projection.mappingVersion,
      specimenSeed: projection.specimen.seed,
      phenotypeId: projection.phenotype.id,
      phenotypeAssetVersion: projection.phenotype.version,
      creationSeason: projection.permanentTraits.creationSeason,
      foliagePaletteId: projection.permanentTraits.foliagePaletteId,
      projectionFingerprint: projection.identity.projectionFingerprint,
      visualFingerprint: projection.identity.visualFingerprint
    },
    policyEvidence: {
      ownerWritingPolicyVersion: 2,
      ownerVariantSelectionVersion: 1,
      writingLifecyclePolicyVersion: 1
    },
    lastEligibleReconciliationEpoch: 0,
    recordRevision: 1,
    createdAt,
    updatedAt: createdAt
  };
}

async function seedDistributions() {
  const sparseMarkers = distributedMarkers({
    profile: PROFILE_DEFINITIONS.sparse,
    cells: NINE_CELLS,
    perCell: 4,
    prefix: 'a4310000'
  });
  const manyMarkers = distributedMarkers({
    profile: PROFILE_DEFINITIONS.many,
    cells: SIXTY_FOUR_CELLS,
    perCell: 4,
    prefix: 'a4330000'
  });
  const combined55Markers = distributedMarkers({
    profile: PROFILE_DEFINITIONS.combined55,
    cells: NINE_CELLS,
    perCell: 4,
    prefix: 'a4340000'
  });
  const combined600Markers = distributedMarkers({
    profile: PROFILE_DEFINITIONS.combined600,
    cells: NINE_CELLS,
    perCell: 4,
    prefix: 'a43b0000'
  });
  const resetMarkers = distributedMarkers({
    profile: PROFILE_DEFINITIONS.reset,
    cells: cellGrid(2, 2),
    perCell: 5,
    prefix: 'a4350000'
  });
  const markers = [
    ...sparseMarkers,
    ...denseMarkers(PROFILE_DEFINITIONS.dense),
    ...manyMarkers,
    ...combined55Markers,
    ...combined600Markers,
    ...resetMarkers
  ];
  requireCondition(
    sparseMarkers.length === SPARSE_MARKER_COUNT
      && manyMarkers.length === MANY_REGION_MARKER_COUNT
      && combined55Markers.length === COMBINED_MARKER_COUNT
      && combined600Markers.length === COMBINED_MARKER_COUNT
      && resetMarkers.length === RESET_MARKER_COUNT,
    'Authored pressure marker builders produced unexpected profile sizes.'
  );
  const markerInsert = await measured(() => ForestAuthoredObject.insertMany(markers, {
    ordered: true
  }));
  const revisions = [
    ...revisionDocuments(PROFILE_DEFINITIONS.sparse, NINE_CELLS),
    ...revisionDocuments(PROFILE_DEFINITIONS.dense, [{ cellX: 0, cellY: 0 }]),
    ...revisionDocuments(PROFILE_DEFINITIONS.many, SIXTY_FOUR_CELLS),
    ...revisionDocuments(PROFILE_DEFINITIONS.combined55, NINE_CELLS),
    ...revisionDocuments(PROFILE_DEFINITIONS.combined600, NINE_CELLS),
    ...revisionDocuments(PROFILE_DEFINITIONS.reset, cellGrid(2, 2))
  ];
  const revisionInsert = await measured(() => ForestAuthoredRegionRevision.insertMany(revisions, {
    ordered: true
  }));
  const trees55 = Array.from({ length: COMBINED_TREE_COUNTS[0] }, (_, index) => (
    writingTreeDocument(
      PROFILE_DEFINITIONS.combined55,
      index + 1,
      NINE_CELLS[index % NINE_CELLS.length],
      'a4390000'
    )
  ));
  const trees600 = Array.from({ length: COMBINED_TREE_COUNTS[1] }, (_, index) => (
    writingTreeDocument(
      PROFILE_DEFINITIONS.combined600,
      index + 1,
      NINE_CELLS[index % NINE_CELLS.length],
      'a43c0000'
    )
  ));
  const trees = [...trees55, ...trees600];
  const treeInsert = await measured(() => ForestWritingTree.insertMany(trees, { ordered: true }));
  await Promise.all([
    ForestOwnerWorld.updateOne({
      ownerUserId: PROFILE_DEFINITIONS.combined55.ownerUserId,
      worldRole: 'primary'
    }, {
      $set: {
        nextCandidateSlot: COMBINED_TREE_COUNTS[0],
        placementRevision: COMBINED_TREE_COUNTS[0] + 1
      }
    }),
    ForestOwnerWorld.updateOne({
      ownerUserId: PROFILE_DEFINITIONS.combined600.ownerUserId,
      worldRole: 'primary'
    }, {
      $set: {
        nextCandidateSlot: COMBINED_TREE_COUNTS[1],
        placementRevision: COMBINED_TREE_COUNTS[1] + 1
      }
    })
  ]);
  return {
    markerCount: markers.length,
    markerInsertMs: markerInsert.elapsedMs,
    revisionCount: revisions.length,
    revisionInsertMs: revisionInsert.elapsedMs,
    treeCount: trees.length,
    treeInsertMs: treeInsert.elapsedMs
  };
}

async function measureAuthoredPages({ profile, cells, label }) {
  const durations = [];
  const serializationDurations = [];
  const seen = new Set();
  let cursor = null;
  let pages = 0;
  let bytes = 0;
  do {
    const page = await measured(() => readForestAuthoredRegionManifest({
      ownerUserId: profile.ownerUserId,
      cells,
      cursor,
      limit: PAGE_SIZE
    }));
    requireCondition(page.result.status === 'ready', `${label} authored read was not ready.`);
    for (const object of page.result.objects) {
      requireCondition(!seen.has(object.objectId), `${label} returned a duplicate marker.`);
      seen.add(object.objectId);
    }
    durations.push(page.elapsedMs);
    const serialization = measuredSerialization(page.result);
    serializationDurations.push(serialization.elapsedMs);
    bytes += serialization.bytes;
    pages += 1;
    cursor = page.result.page.nextCursor;
    requireCondition(pages <= 10, `${label} exceeded ten authored pages.`);
  } while (cursor);
  return {
    label,
    requestedCellCount: cells.length,
    markerCount: seen.size,
    pageCount: pages,
    serializedBytes: bytes,
    timings: summarizeForestPressureTimings(durations),
    serializationTimings: summarizeForestPressureTimings(serializationDurations)
  };
}

async function measureWritingPages({ profile, cells }) {
  const durations = [];
  const serializationDurations = [];
  const seen = new Set();
  let cursor = null;
  let pages = 0;
  let bytes = 0;
  do {
    const page = await measured(() => readForestOwnerRegionManifest({
      ownerUserId: profile.ownerUserId,
      cells,
      cursor,
      limit: PAGE_SIZE
    }));
    requireCondition(page.result.status === 'ready', 'Combined writing read was not ready.');
    for (const placement of page.result.placements) {
      requireCondition(!seen.has(placement.id), 'Combined writing read returned a duplicate tree.');
      seen.add(placement.id);
    }
    durations.push(page.elapsedMs);
    const serialization = measuredSerialization(page.result);
    serializationDurations.push(serialization.elapsedMs);
    bytes += serialization.bytes;
    pages += 1;
    cursor = page.result.page.nextCursor;
    requireCondition(pages <= 10, 'Combined writing read exceeded ten pages.');
  } while (cursor);
  return {
    treeCount: seen.size,
    pageCount: pages,
    serializedBytes: bytes,
    timings: summarizeForestPressureTimings(durations),
    serializationTimings: summarizeForestPressureTimings(serializationDurations)
  };
}

function createInput(profile, objectId, worldX, worldY) {
  return {
    ownerUserId: profile.ownerUserId,
    objectId,
    protocolVersion: 1,
    kind: 'personal-marker',
    worldX,
    worldY
  };
}

async function operationProof(mutations) {
  const profile = PROFILE_DEFINITIONS.empty;
  const objectId = fixtureUuid('a4360000', 1);
  const empty = await measureAuthoredPages({
    profile,
    cells: [{ cellX: 0, cellY: 0 }],
    label: 'empty'
  });
  const input = createInput(profile, objectId, 0, 0);
  const create = await measured(() => mutations.create(input));
  const firstMarker = await measureAuthoredPages({
    profile,
    cells: [{ cellX: 0, cellY: 0 }],
    label: 'first-marker'
  });
  const retry = await measured(() => mutations.create(input));
  const conflict = await measuredFailure(
    () => mutations.create(createInput(profile, objectId, 60, 0)),
    'AUTHORED_CREATE_IDEMPOTENCY_CONFLICT'
  );
  const move = await measured(() => mutations.move({
    ownerUserId: profile.ownerUserId,
    objectId,
    protocolVersion: 1,
    expectedRevision: 1,
    worldX: 30,
    worldY: 0
  }));
  const remove = await measured(() => mutations.remove({
    ownerUserId: profile.ownerUserId,
    objectId,
    protocolVersion: 1,
    expectedRevision: 2
  }));
  requireCondition(
    create.result.outcome === 'created'
      && retry.result.outcome === 'existing-active'
      && move.result.outcome === 'moved'
      && remove.result.outcome === 'removed',
    'Pressure mutation sequence produced unexpected outcomes.'
  );
  return {
    empty,
    firstMarker,
    timings: {
      create: summarizeForestPressureTimings([create.elapsedMs]),
      idempotentCreateRetry: summarizeForestPressureTimings([retry.elapsedMs]),
      createConflict: summarizeForestPressureTimings([conflict.elapsedMs]),
      move: summarizeForestPressureTimings([move.elapsedMs]),
      remove: summarizeForestPressureTimings([remove.elapsedMs])
    }
  };
}

async function sparseProof(mutations) {
  const profile = PROFILE_DEFINITIONS.sparse;
  const regional = await measureAuthoredPages({ profile, cells: NINE_CELLS, label: 'sparse' });
  const neighborhood = await measured(() => mutations.create(createInput(
    profile,
    fixtureUuid('a4370000', 1),
    600,
    600
  )));
  requireCondition(
    regional.markerCount === SPARSE_MARKER_COUNT
      && neighborhood.result.outcome === 'created',
    'Sparse pressure profile did not preserve its accepted distribution.'
  );
  return {
    ...regional,
    collisionNeighborhood: {
      databaseQueries: 2,
      maximumMarkerRows: 1_153,
      maximumWritingTreeRows: 10_001,
      elapsed: summarizeForestPressureTimings([neighborhood.elapsedMs])
    }
  };
}

async function denseProof(mutations) {
  const profile = PROFILE_DEFINITIONS.dense;
  const cells = [{ cellX: 0, cellY: 0 }];
  const initial = await measureAuthoredPages({ profile, cells, label: 'dense' });
  const rejected = await measuredFailure(
    () => mutations.create(createInput(
      profile,
      fixtureUuid('a4380000', 1),
      650,
      650
    )),
    'AUTHORED_PLACEMENT_DENSITY'
  );
  const firstPage = await readForestAuthoredRegionManifest({
    ownerUserId: profile.ownerUserId,
    cells,
    limit: PAGE_SIZE
  });
  const moved = await measured(() => mutations.move({
    ownerUserId: profile.ownerUserId,
    objectId: fixtureUuid('a4320000', 1),
    protocolVersion: 1,
    expectedRevision: 1,
    worldX: 31,
    worldY: 30
  }));
  const changed = await measuredFailure(
    () => readForestAuthoredRegionManifest({
      ownerUserId: profile.ownerUserId,
      cells,
      cursor: firstPage.page.nextCursor,
      limit: PAGE_SIZE
    }),
    'AUTHORED_REGION_CHANGED'
  );
  const restarted = await measureAuthoredPages({ profile, cells, label: 'dense-restart' });
  requireCondition(
    initial.markerCount === DENSE_MARKER_COUNT
      && initial.pageCount === 2
      && moved.result.outcome === 'moved'
      && restarted.markerCount === DENSE_MARKER_COUNT,
    'Dense pressure profile did not remain complete through continuation restart.'
  );
  return {
    initial,
    densityCeiling: {
      acceptedMarkerCount: DENSE_MARKER_COUNT,
      rejectedAttempt: DENSE_MARKER_COUNT + 1,
      code: rejected.code,
      timing: summarizeForestPressureTimings([rejected.elapsedMs])
    },
    continuationRestart: {
      staleCursorCode: changed.code,
      detectionTiming: summarizeForestPressureTimings([changed.elapsedMs]),
      restarted
    }
  };
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function manyRegionProof() {
  const measurements = [];
  for (const cells of chunks(SIXTY_FOUR_CELLS, 8)) {
    measurements.push(await measureAuthoredPages({
      profile: PROFILE_DEFINITIONS.many,
      cells,
      label: 'many-region-sweep'
    }));
  }
  const markerCount = measurements.reduce((total, value) => total + value.markerCount, 0);
  requireCondition(
    measurements.length === 8 && markerCount === MANY_REGION_MARKER_COUNT,
    'Many-region sweep did not return every synthetic marker exactly once.'
  );
  const durations = measurements.map(value => value.timings.totalMs);
  return {
    occupiedCellCount: SIXTY_FOUR_CELLS.length,
    requestGroupCount: measurements.length,
    markerCount,
    pageCount: measurements.reduce((total, value) => total + value.pageCount, 0),
    serializedBytes: measurements.reduce((total, value) => total + value.serializedBytes, 0),
    requestRangeTimings: summarizeForestPressureTimings(durations)
  };
}

async function combinedProof({ profile, expectedTreeCount, label }) {
  const authored = await measureAuthoredPages({ profile, cells: NINE_CELLS, label });
  const writing = await measureWritingPages({ profile, cells: NINE_CELLS });
  requireCondition(
    authored.markerCount === COMBINED_MARKER_COUNT
      && writing.treeCount === expectedTreeCount,
    `${label} pressure profile did not return both independent layers completely.`
  );
  return {
    authored,
    writing,
    combinedSerializedBytes: authored.serializedBytes + writing.serializedBytes
  };
}

function ownerScopedRetentionModels(ownerUserId) {
  return {
    ForestAuthoredObject: {
      find: filter => ForestAuthoredObject.find({ ...filter, ownerUserId }),
      deleteOne: filter => ForestAuthoredObject.deleteOne({ ...filter, ownerUserId })
    },
    ForestAuthoredResetOperation: {
      find: filter => ForestAuthoredResetOperation.find({ ...filter, ownerUserId }),
      deleteOne: filter => ForestAuthoredResetOperation.deleteOne({ ...filter, ownerUserId })
    }
  };
}

async function measuredDrain(operation, maximumBatches) {
  const durations = [];
  const totals = { selected: 0, deleted: 0, failed: 0 };
  for (let batch = 0; batch < maximumBatches; batch += 1) {
    const value = await measured(operation);
    durations.push(value.elapsedMs);
    totals.selected += value.result.selected;
    totals.deleted += value.result.deleted;
    totals.failed += value.result.failed;
    if (value.result.selected === 0) {
      return { ...totals, batches: durations.length, timings: summarizeForestPressureTimings(durations) };
    }
  }
  throw new Error('Pressure cleanup did not converge within its batch bound.');
}

async function resetAndRetentionProof() {
  const profile = PROFILE_DEFINITIONS.reset;
  const reset = buildForestAuthoredResetService({ clock });
  const request = await measured(() => reset.request({
    ownerUserId: profile.ownerUserId,
    resetId: fixtureUuid('a43a0000', 1)
  }));
  const batchDurations = [];
  let outcome;
  do {
    const batch = await measured(() => reset.processBatch({
      ownerUserId: profile.ownerUserId,
      resetId: fixtureUuid('a43a0000', 1),
      batchSize: 10
    }));
    batchDurations.push(batch.elapsedMs);
    outcome = batch.result;
  } while (outcome.status === 'processing');
  requireCondition(
    request.result.outcome === 'started'
      && outcome.affectedObjectCount === RESET_MARKER_COUNT,
    'Reset pressure profile did not tombstone every marker.'
  );

  fixtureNow = new Date(fixtureNow.getTime() + FOREST_AUTHORED_RESET_RETENTION_MS);
  const retention = buildForestAuthoredRetentionCleanupService({
    clock,
    models: ownerScopedRetentionModels(profile.ownerUserId)
  });
  const tombstones = await measuredDrain(
    () => retention.purgeTombstones({ batchSize: 10 }),
    4
  );
  const operations = await measuredDrain(
    () => retention.purgeCompletedResetOperations({ batchSize: 10 }),
    3
  );
  requireCondition(
    tombstones.deleted === RESET_MARKER_COUNT
      && tombstones.failed === 0
      && operations.deleted === 1
      && operations.failed === 0,
    'Pressure retention cleanup did not converge without failures.'
  );
  return {
    reset: {
      markerCount: RESET_MARKER_COUNT,
      requestTiming: summarizeForestPressureTimings([request.elapsedMs]),
      batches: batchDurations.length,
      batchSize: 10,
      timings: summarizeForestPressureTimings(batchDurations)
    },
    tombstonePurge: tombstones,
    resetOperationPurge: operations
  };
}

function migrationDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify([
    value.recordId,
    value.position,
    value.recordRevision,
    value.state
  ])).digest('base64url');
}

async function runMigrationPass(harness, mode) {
  const durations = [];
  const totals = { selected: 0, wouldMigrate: 0, migrated: 0, alreadyCurrent: 0, failed: 0 };
  let checkpoint = null;
  do {
    const page = await measured(() => harness.processBatch({
      mode,
      checkpoint,
      batchSize: 250
    }));
    durations.push(page.elapsedMs);
    for (const field of Object.keys(totals)) totals[field] += page.result[field];
    requireCondition(!page.result.blockedReason, 'Pressure migration pass was unexpectedly blocked.');
    checkpoint = page.result.nextCheckpoint;
  } while (checkpoint);
  return {
    ...totals,
    batches: durations.length,
    batchSize: 250,
    timings: summarizeForestPressureTimings(durations)
  };
}

async function migrationProof() {
  const collection = migrationCollection();
  const records = Array.from({ length: MIGRATION_RECORD_COUNT }, (_, index) => ({
    fixtureScope: MIGRATION_SCOPE,
    recordId: `pressure-record-${String(index + 1).padStart(4, '0')}`,
    schemaVersion: 7,
    position: { worldX: index * 30, worldY: 0 },
    recordRevision: 1,
    state: index % 5 === 0 ? 'removed' : 'active'
  }));
  const insert = await measured(() => collection.insertMany(records, { ordered: true }));
  const plan = {
    planId: 'disposable-mongo-pressure-fixture',
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
    validate: (source, target) => (
      target.schemaVersion === 8
      && JSON.stringify(target.position) === JSON.stringify(source.position)
      && target.recordRevision === source.recordRevision
      && target.state === source.state
      && target.recordIntegrity?.digest === migrationDigest(source)
    ),
    compareAndSet: async (source, target) => {
      const write = await collection.replaceOne({
        _id: source._id,
        fixtureScope: MIGRATION_SCOPE,
        schemaVersion: 7,
        recordRevision: source.recordRevision
      }, target);
      if (write.modifiedCount === 1) return 'migrated';
      const current = await collection.findOne({ _id: source._id });
      return current?.schemaVersion === 8 ? 'already-current' : 'conflict';
    }
  };
  const harness = buildForestAuthoredMigrationHarness({ plan });
  const dryRun = await runMigrationPass(harness, 'dry-run');
  const apply = await runMigrationPass(harness, 'apply');
  const rerun = await runMigrationPass(harness, 'apply');
  requireCondition(
    dryRun.wouldMigrate === MIGRATION_RECORD_COUNT
      && apply.migrated === MIGRATION_RECORD_COUNT
      && rerun.alreadyCurrent === MIGRATION_RECORD_COUNT,
    'Migration pressure profile did not remain complete and idempotent.'
  );
  return {
    recordCount: MIGRATION_RECORD_COUNT,
    insertTiming: summarizeForestPressureTimings([insert.elapsedMs]),
    dryRun,
    apply,
    rerun
  };
}

async function runFixture() {
  await resetFixture();
  await seedAuthorities();
  const setup = await seedDistributions();
  const mutations = buildForestAuthoredObjectMutationService({ clock });

  const operations = await operationProof(mutations);
  const sparse = await sparseProof(mutations);
  const dense = await denseProof(mutations);
  const manyRegions = await manyRegionProof();
  const combined55 = await combinedProof({
    profile: PROFILE_DEFINITIONS.combined55,
    expectedTreeCount: COMBINED_TREE_COUNTS[0],
    label: 'combined-55'
  });
  const combined600 = await combinedProof({
    profile: PROFILE_DEFINITIONS.combined600,
    expectedTreeCount: COMBINED_TREE_COUNTS[1],
    label: 'combined-600'
  });
  const resetAndRetention = await resetAndRetentionProof();
  const migration = await migrationProof();

  console.log(JSON.stringify({
    fixture: 'forest-authored-pressure',
    database: mongoose.connection.name,
    syntheticDevelopmentEvidence: true,
    setup: {
      markerCount: setup.markerCount,
      markerInsert: summarizeForestPressureTimings([setup.markerInsertMs]),
      revisionCount: setup.revisionCount,
      revisionInsert: summarizeForestPressureTimings([setup.revisionInsertMs]),
      treeCount: setup.treeCount,
      treeInsert: summarizeForestPressureTimings([setup.treeInsertMs])
    },
    operations,
    sparse,
    dense,
    manyRegions,
    combined55,
    combined600,
    resetAndRetention,
    migration
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await connectFixtureDatabase();
  if (args.command === 'reset') {
    await resetFixture();
    console.log('Forest authored-pressure fixture reset.');
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

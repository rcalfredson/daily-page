import crypto from 'node:crypto';

export const FOREST_AUTHORED_MIGRATION_HARNESS_VERSION = 1;
export const FOREST_AUTHORED_MIGRATION_DEFAULT_BATCH_SIZE = 100;
export const FOREST_AUTHORED_MIGRATION_MAX_BATCH_SIZE = 250;
export const FOREST_AUTHORED_MIGRATION_MODES = Object.freeze(['dry-run', 'apply']);

const PLAN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RECORD_ID_PATTERN = /^[A-Za-z0-9._:-]{1,256}$/;
const CHECKPOINT_PATTERN = /^[A-Za-z0-9_-]{1,2048}$/;
const STATES = new Set(['source', 'target', 'malformed', 'unsupported']);
const WRITE_OUTCOMES = new Set(['migrated', 'already-current', 'conflict']);

export class ForestAuthoredMigrationHarnessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestAuthoredMigrationHarnessError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestAuthoredMigrationHarnessError(code, message);
}

function positiveVersion(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail('INVALID_AUTHORED_MIGRATION_PLAN', `${fieldName} must be a positive safe integer.`);
  }
  return value;
}

function boundedBatchSize(value) {
  const resolved = value === undefined ? FOREST_AUTHORED_MIGRATION_DEFAULT_BATCH_SIZE : value;
  if (!Number.isSafeInteger(resolved)
    || resolved < 1
    || resolved > FOREST_AUTHORED_MIGRATION_MAX_BATCH_SIZE) {
    fail('INVALID_AUTHORED_MIGRATION_INPUT', 'batchSize is outside the supported bound.');
  }
  return resolved;
}

function exactMode(value) {
  const mode = value === undefined ? 'dry-run' : value;
  if (!FOREST_AUTHORED_MIGRATION_MODES.includes(mode)) {
    fail('INVALID_AUTHORED_MIGRATION_INPUT', 'mode is unsupported.');
  }
  return mode;
}

function planFingerprint({ planId, sourceVersion, targetVersion, mode }) {
  return crypto.createHash('sha256').update(JSON.stringify([
    FOREST_AUTHORED_MIGRATION_HARNESS_VERSION,
    planId,
    sourceVersion,
    targetVersion,
    mode
  ])).digest('base64url').slice(0, 22);
}

function encodeCheckpoint(afterRecordId, fingerprint) {
  if (!afterRecordId) return null;
  return Buffer.from(JSON.stringify({
    version: FOREST_AUTHORED_MIGRATION_HARNESS_VERSION,
    fingerprint,
    afterRecordId
  })).toString('base64url');
}

function decodeCheckpoint(value, fingerprint) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !CHECKPOINT_PATTERN.test(value)) {
    fail('INVALID_AUTHORED_MIGRATION_INPUT', 'checkpoint must be a bounded opaque string.');
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!decoded
      || Object.keys(decoded).sort().join(',') !== 'afterRecordId,fingerprint,version'
      || decoded.version !== FOREST_AUTHORED_MIGRATION_HARNESS_VERSION
      || decoded.fingerprint !== fingerprint
      || typeof decoded.afterRecordId !== 'string'
      || !RECORD_ID_PATTERN.test(decoded.afterRecordId)) {
      throw new Error('unsupported checkpoint');
    }
    return decoded.afterRecordId;
  } catch {
    fail('INVALID_AUTHORED_MIGRATION_INPUT', 'checkpoint is invalid for this migration plan.');
  }
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)
    || !PLAN_ID_PATTERN.test(plan.planId || '')
    || typeof plan.readBatch !== 'function'
    || typeof plan.classify !== 'function'
    || typeof plan.transform !== 'function'
    || typeof plan.validate !== 'function'
    || typeof plan.compareAndSet !== 'function') {
    fail('INVALID_AUTHORED_MIGRATION_PLAN', 'The migration plan is incomplete or invalid.');
  }
  const sourceVersion = positiveVersion(plan.sourceVersion, 'sourceVersion');
  const targetVersion = positiveVersion(plan.targetVersion, 'targetVersion');
  if (sourceVersion === targetVersion) {
    fail('INVALID_AUTHORED_MIGRATION_PLAN', 'Migration versions must be distinct.');
  }
  return Object.freeze({ ...plan, sourceVersion, targetVersion });
}

function classification(value, previousRecordId) {
  if (!value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !RECORD_ID_PATTERN.test(value.recordId || '')
    || !STATES.has(value.state)
    || previousRecordId && value.recordId <= previousRecordId) {
    fail('AUTHORED_MIGRATION_UNAVAILABLE', 'The migration plan returned unstable record evidence.');
  }
  return value;
}

function result({ mode, counts, blockedReason, nextCheckpoint }) {
  return Object.freeze({
    harnessVersion: FOREST_AUTHORED_MIGRATION_HARNESS_VERSION,
    mode,
    selected: counts.selected,
    inspected: counts.inspected,
    wouldMigrate: counts.wouldMigrate,
    migrated: counts.migrated,
    alreadyCurrent: counts.alreadyCurrent,
    failed: counts.failed,
    blockedReason,
    nextCheckpoint
  });
}

export function buildForestAuthoredMigrationHarness({ plan: planValue } = {}) {
  const plan = validatePlan(planValue);

  async function processBatch({ mode: modeValue, checkpoint = null, batchSize } = {}) {
    const mode = exactMode(modeValue);
    const limit = boundedBatchSize(batchSize);
    const fingerprint = planFingerprint({ ...plan, mode });
    const afterRecordId = decodeCheckpoint(checkpoint, fingerprint);
    const records = await plan.readBatch({ afterRecordId, limit: limit + 1 });
    if (!Array.isArray(records) || records.length > limit + 1) {
      fail('AUTHORED_MIGRATION_UNAVAILABLE', 'The migration read was not bounded.');
    }

    const batch = records.slice(0, limit);
    const counts = {
      selected: batch.length,
      inspected: 0,
      wouldMigrate: 0,
      migrated: 0,
      alreadyCurrent: 0,
      failed: 0
    };
    let safeAfterRecordId = afterRecordId;
    let previousRecordId = afterRecordId;
    let blockedReason = null;

    for (const record of batch) {
      let evidence;
      try {
        evidence = classification(await plan.classify(record), previousRecordId);
      } catch (error) {
        if (error instanceof ForestAuthoredMigrationHarnessError) throw error;
        counts.failed += 1;
        blockedReason = 'malformed';
        break;
      }
      previousRecordId = evidence.recordId;
      counts.inspected += 1;

      if (['malformed', 'unsupported'].includes(evidence.state)) {
        counts.failed += 1;
        blockedReason = evidence.state;
        break;
      }
      if (evidence.state === 'target') {
        counts.alreadyCurrent += 1;
        safeAfterRecordId = evidence.recordId;
        continue;
      }

      let target;
      try {
        target = await plan.transform(record);
        if (await plan.validate(record, target) !== true) {
          counts.failed += 1;
          blockedReason = 'invariant';
          break;
        }
      } catch {
        counts.failed += 1;
        blockedReason = 'malformed';
        break;
      }

      if (mode === 'dry-run') {
        counts.wouldMigrate += 1;
        safeAfterRecordId = evidence.recordId;
        continue;
      }

      let writeOutcome;
      try {
        writeOutcome = await plan.compareAndSet(record, target);
      } catch {
        counts.failed += 1;
        blockedReason = 'unavailable';
        break;
      }
      if (!WRITE_OUTCOMES.has(writeOutcome)) {
        fail('AUTHORED_MIGRATION_UNAVAILABLE', 'The migration write returned an invalid outcome.');
      }
      if (writeOutcome === 'conflict') {
        counts.failed += 1;
        blockedReason = 'conflict';
        break;
      }
      if (writeOutcome === 'migrated') counts.migrated += 1;
      else counts.alreadyCurrent += 1;
      safeAfterRecordId = evidence.recordId;
    }

    const hasMore = blockedReason !== null || records.length > limit;
    return result({
      mode,
      counts,
      blockedReason,
      nextCheckpoint: hasMore ? encodeCheckpoint(safeAfterRecordId, fingerprint) : null
    });
  }

  return Object.freeze({ processBatch });
}

import {
  buildForestAuthoredMigrationHarness,
  FOREST_AUTHORED_MIGRATION_MAX_BATCH_SIZE,
  ForestAuthoredMigrationHarnessError
} from '../server/services/forestAuthoredMigrationHarness.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function record(ordinal, overrides = {}) {
  return {
    recordId: `record-${String(ordinal).padStart(3, '0')}`,
    schemaVersion: 7,
    objectId: `object-${ordinal}`,
    position: { worldX: ordinal * 30, worldY: 0 },
    revision: ordinal,
    state: ordinal % 2 ? 'active' : 'removed',
    createdAt: `2026-08-${String(ordinal).padStart(2, '0')}T12:00:00.000Z`,
    changedAt: `2026-08-${String(ordinal).padStart(2, '0')}T12:00:00.000Z`,
    ...overrides
  };
}

function harness(initialRecords, overrides = {}) {
  const records = initialRecords.map(value => clone(value));
  const readBatch = jasmine.createSpy('readBatch').and.callFake(async ({ afterRecordId, limit }) => (
    records.filter(value => !afterRecordId || value.recordId > afterRecordId).slice(0, limit)
  ));
  const compareAndSet = jasmine.createSpy('compareAndSet')
    .and.callFake(async (source, target) => {
      const index = records.findIndex(value => value.recordId === source.recordId);
      if (index < 0) return 'conflict';
      if (records[index].schemaVersion === 8) return 'already-current';
      if (JSON.stringify(records[index]) !== JSON.stringify(source)) return 'conflict';
      records[index] = clone(target);
      return 'migrated';
    });
  const plan = {
    planId: 'disposable-marker-fixture',
    sourceVersion: 7,
    targetVersion: 8,
    readBatch,
    classify: async value => ({
      recordId: value.recordId,
      state: value.schemaVersion === 7
        ? 'source'
        : value.schemaVersion === 8 ? 'target' : 'unsupported'
    }),
    transform: async value => ({ ...clone(value), schemaVersion: 8 }),
    validate: async (source, target) => (
      target.schemaVersion === 8
      && target.objectId === source.objectId
      && JSON.stringify(target.position) === JSON.stringify(source.position)
      && target.revision === source.revision
      && target.state === source.state
      && target.createdAt === source.createdAt
      && target.changedAt === source.changedAt
    ),
    compareAndSet,
    ...overrides
  };
  return {
    records,
    readBatch,
    compareAndSet,
    service: buildForestAuthoredMigrationHarness({ plan })
  };
}

describe('forest authored migration harness', () => {
  it('defaults to a bounded dry run that verifies transformations without writing', async () => {
    const test = harness([record(1), record(2)]);

    const result = await test.service.processBatch();

    expect(result).toEqual({
      harnessVersion: 1,
      mode: 'dry-run',
      selected: 2,
      inspected: 2,
      wouldMigrate: 2,
      migrated: 0,
      alreadyCurrent: 0,
      failed: 0,
      blockedReason: null,
      nextCheckpoint: null
    });
    expect(test.readBatch).toHaveBeenCalledWith({ afterRecordId: null, limit: 101 });
    expect(test.compareAndSet).not.toHaveBeenCalled();
    expect(test.records.every(value => value.schemaVersion === 7)).toBeTrue();
  });

  it('continues an apply migration through a plan-bound opaque checkpoint', async () => {
    const test = harness([record(1), record(2), record(3)]);

    const first = await test.service.processBatch({ mode: 'apply', batchSize: 2 });
    const second = await test.service.processBatch({
      mode: 'apply', batchSize: 2, checkpoint: first.nextCheckpoint
    });

    expect(first).toEqual(jasmine.objectContaining({
      selected: 2, migrated: 2, failed: 0, blockedReason: null
    }));
    expect(first.nextCheckpoint).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(second).toEqual(jasmine.objectContaining({
      selected: 1, migrated: 1, failed: 0, nextCheckpoint: null
    }));
    expect(test.readBatch.calls.mostRecent().args[0]).toEqual({
      afterRecordId: 'record-002', limit: 3
    });
    expect(test.records.every(value => value.schemaVersion === 8)).toBeTrue();
  });

  it('resumes after an interrupted write and does not repeat the accepted record', async () => {
    const test = harness([record(1), record(2)]);
    let calls = 0;
    test.compareAndSet.and.callFake(async (source, target) => {
      calls += 1;
      if (calls === 2) throw new Error('interrupted');
      const index = test.records.findIndex(value => value.recordId === source.recordId);
      if (index < 0) return 'conflict';
      test.records[index] = clone(target);
      return 'migrated';
    });

    const interrupted = await test.service.processBatch({ mode: 'apply' });
    const resumed = await test.service.processBatch({
      mode: 'apply', checkpoint: interrupted.nextCheckpoint
    });

    expect(interrupted).toEqual(jasmine.objectContaining({
      migrated: 1, failed: 1, blockedReason: 'unavailable'
    }));
    expect(resumed).toEqual(jasmine.objectContaining({
      selected: 1, migrated: 1, failed: 0, nextCheckpoint: null
    }));
    expect(test.records.every(value => value.schemaVersion === 8)).toBeTrue();
  });

  it('is idempotent when an accepted migration is rerun from the beginning', async () => {
    const test = harness([record(1), record(2)]);
    await test.service.processBatch({ mode: 'apply' });
    test.compareAndSet.calls.reset();

    const rerun = await test.service.processBatch({ mode: 'apply' });

    expect(rerun).toEqual(jasmine.objectContaining({
      migrated: 0, alreadyCurrent: 2, failed: 0
    }));
    expect(test.compareAndSet).not.toHaveBeenCalled();
  });

  it('stops before unsupported evidence and retains a checkpoint for safe progress', async () => {
    const test = harness([record(1), record(2, { schemaVersion: 99 }), record(3)]);

    const result = await test.service.processBatch({ mode: 'apply' });

    expect(result).toEqual(jasmine.objectContaining({
      selected: 3,
      inspected: 2,
      migrated: 1,
      failed: 1,
      blockedReason: 'unsupported'
    }));
    expect(result.nextCheckpoint).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(test.compareAndSet).toHaveBeenCalledTimes(1);
    expect(test.records.map(value => value.schemaVersion)).toEqual([8, 99, 7]);
  });

  it('checks preservation invariants before any compare-and-set write', async () => {
    const test = harness([record(1)], {
      transform: async value => ({
        ...clone(value), schemaVersion: 8, position: { worldX: 999, worldY: 999 }
      })
    });

    const result = await test.service.processBatch({ mode: 'apply' });

    expect(result).toEqual(jasmine.objectContaining({
      migrated: 0, failed: 1, blockedReason: 'invariant', nextCheckpoint: null
    }));
    expect(test.compareAndSet).not.toHaveBeenCalled();
  });

  it('rejects checkpoints replayed under another mode before reading records', async () => {
    const test = harness([record(1), record(2)]);
    const dryRun = await test.service.processBatch({ batchSize: 1 });
    test.readBatch.calls.reset();

    await expectAsync(test.service.processBatch({
      mode: 'apply', checkpoint: dryRun.nextCheckpoint, batchSize: 1
    })).toBeRejectedWithError(ForestAuthoredMigrationHarnessError, /checkpoint/);
    expect(test.readBatch).not.toHaveBeenCalled();
  });

  it('rejects invalid bounds, oversized reads, and unstable record order', async () => {
    const valid = harness([]);
    await expectAsync(valid.service.processBatch({
      batchSize: FOREST_AUTHORED_MIGRATION_MAX_BATCH_SIZE + 1
    })).toBeRejectedWithError(ForestAuthoredMigrationHarnessError, /batchSize/);

    const oversized = harness([], {
      readBatch: async ({ limit }) => Array.from({ length: limit + 1 }, (_, index) => record(index))
    });
    await expectAsync(oversized.service.processBatch({ batchSize: 1 }))
      .toBeRejectedWithError(ForestAuthoredMigrationHarnessError, /bounded/);

    const unstable = harness([], {
      readBatch: async () => [record(2), record(1)]
    });
    await expectAsync(unstable.service.processBatch())
      .toBeRejectedWithError(ForestAuthoredMigrationHarnessError, /unstable/);
  });
});

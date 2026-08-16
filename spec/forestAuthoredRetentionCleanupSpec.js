import {
  buildForestAuthoredRetentionCleanupService,
  FOREST_AUTHORED_RESET_RETENTION_MS,
  FOREST_AUTHORED_RETENTION_MAX_BATCH_SIZE,
  ForestAuthoredRetentionCleanupError
} from '../server/services/forestAuthoredRetentionCleanup.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';
const RESET = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-14T12:00:00.000Z');
const REMOVED = new Date('2026-08-16T12:00:00.000Z');

function query(value) {
  const chain = {
    sort: jasmine.createSpy('sort').and.callFake(() => chain),
    limit: jasmine.createSpy('limit').and.callFake((limit) => {
      chain.maximum = limit;
      return chain;
    }),
    lean: jasmine.createSpy('lean').and.callFake(async () => (
      value.slice(0, chain.maximum)
    ))
  };
  return chain;
}

function tombstone(overrides = {}) {
  return {
    _id: 'object-record',
    schemaVersion: 1,
    identityVersion: 1,
    objectId: OBJECT,
    forestId: FOREST,
    ownerUserId: OWNER,
    kind: 'personal-marker',
    state: 'removed',
    placement: { worldX: 30, worldY: 0 },
    placementIndex: { version: 1, cellX: 0, cellY: 0 },
    worldVersionEvidence: {
      ownerWorldSchemaVersion: 1,
      placementPolicyVersion: 1,
      environmentPolicyVersion: 1,
      environmentSchemaVersion: 1,
      worldGenerationVersion: 1
    },
    appearance: { id: 'quiet-waymarker', version: 1 },
    creationFingerprint: { version: 1, digest: 'A'.repeat(43) },
    recordRevision: 2,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    changedAt: REMOVED,
    removedAt: REMOVED,
    purgeEligibleAt: NOW,
    ...overrides
  };
}

function completedReset(overrides = {}) {
  return {
    _id: 'reset-record',
    schemaVersion: 1,
    operationVersion: 1,
    resetId: RESET,
    forestId: FOREST,
    ownerUserId: OWNER,
    status: 'completed',
    afterObjectId: OBJECT,
    affectedObjectCount: 1,
    authoredObjectSchemaVersion: 1,
    spatialIndexVersion: 1,
    startedAt: new Date('2026-08-15T12:00:00.000Z'),
    completedAt: new Date(NOW.getTime() - FOREST_AUTHORED_RESET_RETENTION_MS),
    ...overrides
  };
}

function harness({ objects = [], operations = [], clock = () => NOW } = {}) {
  const models = {
    ForestAuthoredObject: {
      find: jasmine.createSpy('ForestAuthoredObject.find').and.returnValue(query(objects)),
      deleteOne: jasmine.createSpy('ForestAuthoredObject.deleteOne')
        .and.resolveTo({ deletedCount: 1 })
    },
    ForestAuthoredResetOperation: {
      find: jasmine.createSpy('ForestAuthoredResetOperation.find')
        .and.returnValue(query(operations)),
      deleteOne: jasmine.createSpy('ForestAuthoredResetOperation.deleteOne')
        .and.resolveTo({ deletedCount: 1 })
    }
  };
  return {
    models,
    service: buildForestAuthoredRetentionCleanupService({ models, clock })
  };
}

describe('forest authored retention cleanup service', () => {
  it('purges an eligible tombstone with an exact lifecycle compare-and-set', async () => {
    const object = tombstone();
    const test = harness({ objects: [object] });

    const result = await test.service.purgeTombstones();

    expect(result).toEqual({ selected: 1, deleted: 1, failed: 0 });
    expect(test.models.ForestAuthoredObject.find).toHaveBeenCalledWith({
      state: 'removed', purgeEligibleAt: { $lte: NOW }
    });
    expect(test.models.ForestAuthoredObject.deleteOne).toHaveBeenCalledWith({
      _id: object._id,
      schemaVersion: 1,
      identityVersion: 1,
      state: 'removed',
      removedAt: REMOVED,
      purgeEligibleAt: NOW,
      recordRevision: 2
    });
  });

  it('fails closed per tombstone without deleting unsupported or conflicting evidence', async () => {
    const test = harness({
      objects: [tombstone({ schemaVersion: 2 }), tombstone({ _id: 'concurrent-record' })]
    });
    test.models.ForestAuthoredObject.deleteOne.and.resolveTo({ deletedCount: 0 });

    const result = await test.service.purgeTombstones();

    expect(result).toEqual({ selected: 2, deleted: 0, failed: 2 });
    expect(test.models.ForestAuthoredObject.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('purges completed reset evidence only after the shared 90-day window', async () => {
    const operation = completedReset();
    const test = harness({ operations: [operation] });

    const result = await test.service.purgeCompletedResetOperations({ batchSize: 1 });

    expect(result).toEqual({ selected: 1, deleted: 1, failed: 0 });
    expect(test.models.ForestAuthoredResetOperation.find).toHaveBeenCalledWith({
      status: 'completed', completedAt: { $lte: operation.completedAt }
    });
    expect(test.models.ForestAuthoredResetOperation.deleteOne).toHaveBeenCalledWith({
      _id: operation._id,
      schemaVersion: 1,
      operationVersion: 1,
      status: 'completed',
      completedAt: operation.completedAt
    });
  });

  it('never deletes malformed completed-reset evidence and reports delete failures', async () => {
    const test = harness({
      operations: [
        completedReset({ operationVersion: 2 }),
        completedReset({ _id: 'delete-error' }),
        completedReset({ _id: 'delete-conflict' })
      ]
    });
    test.models.ForestAuthoredResetOperation.deleteOne.and.callFake(async (filter) => {
      if (filter._id === 'delete-error') throw new Error('database unavailable');
      return { deletedCount: 0 };
    });

    const result = await test.service.purgeCompletedResetOperations();

    expect(result).toEqual({ selected: 3, deleted: 0, failed: 3 });
    expect(test.models.ForestAuthoredResetOperation.deleteOne).toHaveBeenCalledTimes(2);
  });

  it('rejects unbounded inputs and invalid clocks before reading either ledger', async () => {
    const oversized = harness();
    await expectAsync(oversized.service.purgeTombstones({
      batchSize: FOREST_AUTHORED_RETENTION_MAX_BATCH_SIZE + 1
    })).toBeRejectedWithError(ForestAuthoredRetentionCleanupError, /batchSize/);

    const invalidClock = harness({ clock: () => new Date('invalid') });
    await expectAsync(invalidClock.service.purgeCompletedResetOperations())
      .toBeRejectedWithError(ForestAuthoredRetentionCleanupError, /clock/);
    expect(oversized.models.ForestAuthoredObject.find).not.toHaveBeenCalled();
    expect(invalidClock.models.ForestAuthoredResetOperation.find).not.toHaveBeenCalled();
  });
});

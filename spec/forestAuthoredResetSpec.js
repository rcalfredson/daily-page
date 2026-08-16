import {
  buildForestAuthoredResetService,
  FOREST_AUTHORED_RESET_DEFAULT_BATCH_SIZE,
  ForestAuthoredResetError
} from '../server/services/forestAuthoredReset.js';
import { FOREST_AUTHORED_TOMBSTONE_RETENTION_MS } from '../server/services/forestAuthoredObjectMutation.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const RESET = '33333333-3333-4333-8333-333333333333';
const OTHER_RESET = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function query(value) {
  const chain = {
    session: jasmine.createSpy('session').and.callFake(() => chain),
    sort: jasmine.createSpy('sort').and.callFake(() => chain),
    limit: jasmine.createSpy('limit').and.callFake((limit) => {
      chain.maximum = limit;
      return chain;
    }),
    lean: jasmine.createSpy('lean').and.callFake(async () => {
      const result = typeof value === 'function' ? value() : value;
      return Array.isArray(result) && chain.maximum !== undefined
        ? result.slice(0, chain.maximum) : result;
    })
  };
  return chain;
}

function world(overrides = {}) {
  return {
    schemaVersion: 1,
    forestId: FOREST,
    ownerUserId: OWNER,
    worldRole: 'primary',
    status: 'active',
    placementPolicyVersion: 1,
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1,
    reconciliation: { state: 'idle' },
    ...overrides
  };
}

function marker(ordinal, overrides = {}) {
  const suffix = String(ordinal).padStart(12, '0');
  return {
    _id: `object-record-${ordinal}`,
    schemaVersion: 1,
    identityVersion: 1,
    objectId: `22222222-2222-4222-8222-${suffix}`,
    forestId: FOREST,
    ownerUserId: OWNER,
    kind: 'personal-marker',
    state: 'active',
    placement: { worldX: ordinal === 3 ? 750 : ordinal * 30, worldY: 0 },
    placementIndex: { version: 1, cellX: ordinal === 3 ? 1 : 0, cellY: 0 },
    worldVersionEvidence: {
      ownerWorldSchemaVersion: 1,
      placementPolicyVersion: 1,
      environmentPolicyVersion: 1,
      environmentSchemaVersion: 1,
      worldGenerationVersion: 1
    },
    appearance: { id: 'quiet-waymarker', version: 1 },
    creationFingerprint: { version: 1, digest: 'A'.repeat(43) },
    recordRevision: 1,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    changedAt: new Date('2026-08-01T12:00:00.000Z'),
    removedAt: null,
    purgeEligibleAt: null,
    ...overrides
  };
}

function harness({
  initialObjects = [],
  initialOperation = null,
  ownerWorld = world(),
  deletion = null,
  clock = () => NOW
} = {}) {
  const objects = initialObjects.map(object => ({ ...object }));
  let operation = initialOperation ? { ...initialOperation } : null;
  const regionRevisions = new Map();
  const models = {
    AccountDeletionRequest: {
      exists: jasmine.createSpy('AccountDeletionRequest.exists').and.returnValue(query(deletion))
    },
    ForestOwnerWorld: {
      findOne: jasmine.createSpy('ForestOwnerWorld.findOne').and.returnValue(query(ownerWorld))
    },
    ForestAuthoredResetOperation: {
      findOne: jasmine.createSpy('ForestAuthoredResetOperation.findOne').and.callFake((filter) => (
        query(() => {
          if (!operation) return null;
          if (filter.resetId && operation.resetId !== filter.resetId) return null;
          if (filter.status && operation.status !== filter.status) return null;
          return operation;
        })
      )),
      find: jasmine.createSpy('ForestAuthoredResetOperation.find').and.callFake(() => (
        query(() => operation?.status === 'processing' ? [operation] : [])
      )),
      create: jasmine.createSpy('ForestAuthoredResetOperation.create')
        .and.callFake(async ([value]) => {
          operation = {
            _id: 'reset-record',
            schemaVersion: 1,
            operationVersion: 1,
            ...value,
            createdAt: NOW,
            updatedAt: NOW
          };
          return [operation];
        }),
      findOneAndUpdate: jasmine.createSpy('ForestAuthoredResetOperation.findOneAndUpdate')
        .and.callFake(async (filter, update) => {
          if (!operation
            || operation.status !== filter.status
            || (operation.afterObjectId ?? null) !== filter.afterObjectId) return null;
          operation = {
            ...operation,
            ...update.$set,
            affectedObjectCount: operation.affectedObjectCount
              + update.$inc.affectedObjectCount,
            updatedAt: NOW
          };
          return operation;
        })
    },
    ForestAuthoredObject: {
      find: jasmine.createSpy('ForestAuthoredObject.find').and.callFake((filter) => query(() => (
        objects.filter(object => object.ownerUserId === filter.ownerUserId
          && object.forestId === filter.forestId
          && object.state === filter.state
          && (!filter.objectId || object.objectId > filter.objectId.$gt))
          .sort((left, right) => left.objectId.localeCompare(right.objectId))
      ))),
      exists: jasmine.createSpy('ForestAuthoredObject.exists').and.callFake((filter) => query(() => (
        objects.some(object => object.ownerUserId === filter.ownerUserId
          && object.forestId === filter.forestId
          && object.state === filter.state) ? { _id: 'remaining' } : null
      ))),
      bulkWrite: jasmine.createSpy('ForestAuthoredObject.bulkWrite')
        .and.callFake(async (writes) => {
          let matchedCount = 0;
          for (const { updateOne } of writes) {
            const object = objects.find(candidate => candidate._id === updateOne.filter._id
              && candidate.state === updateOne.filter.state
              && candidate.recordRevision === updateOne.filter.recordRevision);
            if (!object) continue;
            Object.assign(object, updateOne.update.$set);
            object.recordRevision += updateOne.update.$inc.recordRevision;
            matchedCount += 1;
          }
          return { matchedCount, modifiedCount: matchedCount };
        })
    },
    ForestAuthoredRegionRevision: {
      findOneAndUpdate: jasmine.createSpy('ForestAuthoredRegionRevision.findOneAndUpdate')
        .and.callFake(async (filter, update) => {
          const key = `${filter.cellX}:${filter.cellY}`;
          const revision = (regionRevisions.get(key) || 0) + update.$inc.revision;
          regionRevisions.set(key, revision);
          return {
            schemaVersion: 1,
            ownerUserId: filter.ownerUserId,
            forestId: filter.forestId,
            spatialIndexVersion: filter.spatialIndexVersion,
            cellX: filter.cellX,
            cellY: filter.cellY,
            revision
          };
        })
    },
    User: {}
  };
  const acquireFence = jasmine.createSpy('acquireFence').and.resolveTo({ acquired: true });
  const service = buildForestAuthoredResetService({
    models,
    transactionRunner: work => work('transaction-session'),
    acquireFence,
    clock
  });
  return {
    service,
    models,
    acquireFence,
    objects,
    operation: () => operation,
    regionRevisions
  };
}

function operation(overrides = {}) {
  return {
    _id: 'reset-record',
    schemaVersion: 1,
    operationVersion: 1,
    resetId: RESET,
    forestId: FOREST,
    ownerUserId: OWNER,
    status: 'processing',
    afterObjectId: null,
    affectedObjectCount: 0,
    authoredObjectSchemaVersion: 1,
    spatialIndexVersion: 1,
    startedAt: NOW,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

describe('forest authored reset service', () => {
  it('starts one fenced operation and recovers the same logical request without another write',
    async () => {
      const test = harness();
      const first = await test.service.request({ ownerUserId: OWNER, resetId: RESET });
      const retry = await test.service.request({ ownerUserId: OWNER, resetId: RESET });

      expect(first).toEqual(jasmine.objectContaining({ outcome: 'started', status: 'processing' }));
      expect(retry).toEqual(jasmine.objectContaining({ outcome: 'existing', resetId: RESET }));
      expect(test.models.ForestAuthoredResetOperation.create).toHaveBeenCalledTimes(1);
      expect(test.acquireFence).toHaveBeenCalledTimes(2);
    });

  it('rejects another reset identity while one operation is processing', async () => {
    const test = harness({ initialOperation: operation() });
    await expectAsync(test.service.request({ ownerUserId: OWNER, resetId: OTHER_RESET }))
      .toBeRejectedWithError(ForestAuthoredResetError, /already processing/);
    expect(test.models.ForestAuthoredResetOperation.create).not.toHaveBeenCalled();
  });

  it('converts one bounded batch to tombstones and advances each affected cell by its count',
    async () => {
      const test = harness({
        initialOperation: operation(),
        initialObjects: [marker(1), marker(2), marker(3)]
      });
      const result = await test.service.processBatch({
        ownerUserId: OWNER,
        resetId: RESET,
        batchSize: FOREST_AUTHORED_RESET_DEFAULT_BATCH_SIZE
      });

      expect(result).toEqual(jasmine.objectContaining({
        outcome: 'completed', status: 'completed', affectedObjectCount: 3
      }));
      expect(test.objects.every(object => (
        object.state === 'removed'
        && object.recordRevision === 2
        && object.removedAt.getTime() === NOW.getTime()
        && object.purgeEligibleAt.getTime() - NOW.getTime()
          === FOREST_AUTHORED_TOMBSTONE_RETENTION_MS
      ))).toBeTrue();
      expect(test.regionRevisions).toEqual(new Map([['0:0', 2], ['1:0', 1]]));
    });

  it('resumes after a stable object-id cursor and returns completed retries unchanged', async () => {
    const test = harness({
      initialOperation: operation(),
      initialObjects: [marker(1), marker(2), marker(3)]
    });
    const first = await test.service.processBatch({
      ownerUserId: OWNER, resetId: RESET, batchSize: 1
    });
    const second = await test.service.processBatch({
      ownerUserId: OWNER, resetId: RESET, batchSize: 2
    });
    const retry = await test.service.processBatch({
      ownerUserId: OWNER, resetId: RESET, batchSize: 2
    });

    expect(first.outcome).toBe('progressed');
    expect(first.affectedObjectCount).toBe(1);
    expect(second.outcome).toBe('completed');
    expect(second.affectedObjectCount).toBe(3);
    expect(retry).toEqual(jasmine.objectContaining({
      outcome: 'already-completed', affectedObjectCount: 3
    }));
    expect(test.models.ForestAuthoredObject.bulkWrite).toHaveBeenCalledTimes(2);
  });

  it('fails closed before writes when active state uses unsupported schema evidence', async () => {
    const test = harness({
      initialOperation: operation(),
      initialObjects: [marker(1, { schemaVersion: 2 })]
    });
    await expectAsync(test.service.processBatch({ ownerUserId: OWNER, resetId: RESET }))
      .toBeRejectedWithError(ForestAuthoredResetError, /cannot be reset safely/);
    expect(test.models.ForestAuthoredObject.bulkWrite).not.toHaveBeenCalled();
    expect(test.operation().afterObjectId).toBeNull();
  });

  it('does not advance region or operation cursors after a partial object compare-and-set',
    async () => {
      const test = harness({
        initialOperation: operation(),
        initialObjects: [marker(1), marker(2)]
      });
      test.models.ForestAuthoredObject.bulkWrite.and.resolveTo({
        matchedCount: 1,
        modifiedCount: 1
      });

      await expectAsync(test.service.processBatch({ ownerUserId: OWNER, resetId: RESET }))
        .toBeRejectedWithError(ForestAuthoredResetError, /changed concurrently/);
      expect(test.models.ForestAuthoredRegionRevision.findOneAndUpdate).not.toHaveBeenCalled();
      expect(test.models.ForestAuthoredResetOperation.findOneAndUpdate).not.toHaveBeenCalled();
    });

  it('rejects malformed public identity and account deletion before reset writes', async () => {
    const invalid = harness();
    await expectAsync(invalid.service.request({ ownerUserId: 'owner', resetId: RESET }))
      .toBeRejectedWithError(ForestAuthoredResetError, /ownerUserId/);
    expect(invalid.acquireFence).not.toHaveBeenCalled();

    const deleting = harness({ deletion: { _id: 'deletion' } });
    await expectAsync(deleting.service.request({ ownerUserId: OWNER, resetId: RESET }))
      .toBeRejectedWithError(ForestAuthoredResetError, /unavailable/);
    expect(deleting.models.ForestAuthoredResetOperation.create).not.toHaveBeenCalled();
  });

  it('processes only the bounded worker selection without exposing operation identity', async () => {
    const test = harness({ initialOperation: operation(), initialObjects: [] });
    const result = await test.service.processOperations({ limit: 1, batchSize: 1 });
    expect(result).toEqual({ requested: 1, progressed: 0, completed: 1, failed: 0 });
    expect(Object.keys(result)).not.toContain('resetId');
  });
});

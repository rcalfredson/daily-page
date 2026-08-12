import {
  buildForestAuthoredObjectMutationService,
  createForestAuthoredCreationFingerprint,
  FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION,
  FOREST_AUTHORED_TOMBSTONE_RETENTION_MS,
  ForestAuthoredMutationError
} from '../server/services/forestAuthoredObjectMutation.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-08-12T12:00:00.000Z');

function query(value) {
  const chain = {
    session: jasmine.createSpy('session').and.callFake(() => chain),
    lean: jasmine.createSpy('lean').and.callFake(async () => (
      typeof value === 'function' ? value() : value
    ))
  };
  return chain;
}

function world(overrides = {}) {
  return {
    _id: 'world-record',
    schemaVersion: 1,
    forestId: FOREST,
    ownerUserId: OWNER,
    worldRole: 'primary',
    status: 'active',
    worldSeed: 'owner_world_seed_0123456789abcdef',
    placementPolicyVersion: 1,
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1,
    reconciliation: { state: 'idle' },
    ...overrides
  };
}

function authoredObject(overrides = {}) {
  const fingerprint = createForestAuthoredCreationFingerprint({
    objectId: OBJECT,
    kind: 'personal-marker',
    worldX: 10,
    worldY: 20
  });
  return {
    _id: 'authored-record',
    schemaVersion: 1,
    identityVersion: 1,
    objectId: OBJECT,
    forestId: FOREST,
    ownerUserId: OWNER,
    kind: 'personal-marker',
    state: 'active',
    placement: { worldX: 10, worldY: 20 },
    placementIndex: { version: 1, cellX: 0, cellY: 0 },
    worldVersionEvidence: {
      ownerWorldSchemaVersion: 1,
      placementPolicyVersion: 1,
      environmentPolicyVersion: 1,
      environmentSchemaVersion: 1,
      worldGenerationVersion: 1
    },
    appearance: { id: 'quiet-waymarker', version: 1 },
    creationFingerprint: fingerprint,
    recordRevision: 1,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    changedAt: new Date('2026-08-01T12:00:00.000Z'),
    removedAt: null,
    purgeEligibleAt: null,
    ...overrides
  };
}

function harness({
  current = null,
  ownerWorld = world(),
  deletion = null,
  reset = null,
  transactionRunner = work => work('transaction-session'),
  inspectPlacement = jasmine.createSpy('inspectPlacement').and.resolveTo({}),
  clock = () => NOW
} = {}) {
  let stored = current;
  const regionWrites = [];
  const objectWrites = [];
  const models = {
    AccountDeletionRequest: {
      exists: jasmine.createSpy('AccountDeletionRequest.exists')
        .and.returnValue(query(deletion))
    },
    ForestOwnerWorld: {
      findOne: jasmine.createSpy('ForestOwnerWorld.findOne')
        .and.returnValue(query(ownerWorld))
    },
    ForestAuthoredResetOperation: {
      exists: jasmine.createSpy('ForestAuthoredResetOperation.exists')
        .and.returnValue(query(reset))
    },
    ForestAuthoredObject: {
      findOne: jasmine.createSpy('ForestAuthoredObject.findOne')
        .and.callFake(() => query(() => stored)),
      create: jasmine.createSpy('ForestAuthoredObject.create')
        .and.callFake(async ([value]) => {
          stored = {
            _id: 'created-record',
            schemaVersion: 1,
            identityVersion: 1,
            createdAt: NOW,
            updatedAt: NOW,
            ...value
          };
          objectWrites.push({ type: 'create', value });
          return [stored];
        }),
      findOneAndUpdate: jasmine.createSpy('ForestAuthoredObject.findOneAndUpdate')
        .and.callFake(async (filter, update) => {
          if (!stored
            || stored.recordRevision !== filter.recordRevision
            || stored.state !== filter.state) return null;
          stored = {
            ...stored,
            ...update.$set,
            recordRevision: stored.recordRevision + update.$inc.recordRevision,
            updatedAt: NOW
          };
          objectWrites.push({ type: 'update', filter, update });
          return stored;
        })
    },
    ForestAuthoredRegionRevision: {
      findOneAndUpdate: jasmine.createSpy('ForestAuthoredRegionRevision.findOneAndUpdate')
        .and.callFake(async (filter) => {
          regionWrites.push(filter);
          return {
            schemaVersion: 1,
            ownerUserId: filter.ownerUserId,
            forestId: filter.forestId,
            spatialIndexVersion: filter.spatialIndexVersion,
            cellX: filter.cellX,
            cellY: filter.cellY,
            revision: regionWrites.length
          };
        })
    },
    ForestWritingTree: {},
    User: {}
  };
  const acquireFence = jasmine.createSpy('acquireFence').and.resolveTo({ acquired: true });
  const service = buildForestAuthoredObjectMutationService({
    models,
    transactionRunner,
    acquireFence,
    inspectPlacement,
    clock
  });
  return {
    service,
    models,
    acquireFence,
    inspectPlacement,
    objectWrites,
    regionWrites,
    stored: () => stored
  };
}

function createInput(overrides = {}) {
  return {
    ownerUserId: OWNER,
    objectId: OBJECT,
    protocolVersion: 1,
    kind: 'personal-marker',
    worldX: 10,
    worldY: 20,
    ...overrides
  };
}

function moveInput(overrides = {}) {
  return {
    ownerUserId: OWNER,
    objectId: OBJECT,
    protocolVersion: 1,
    expectedRevision: 1,
    worldX: 30,
    worldY: 40,
    ...overrides
  };
}

function removeInput(overrides = {}) {
  return {
    ownerUserId: OWNER,
    objectId: OBJECT,
    protocolVersion: 1,
    expectedRevision: 1,
    ...overrides
  };
}

async function rejectedError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected promise to reject.');
}

describe('forest authored-object transactional mutation', () => {
  it('computes a deterministic fixed-length creation fingerprint over original intent', () => {
    const first = createForestAuthoredCreationFingerprint({
      objectId: OBJECT,
      kind: 'personal-marker',
      worldX: -1,
      worldY: 2
    });
    const repeated = createForestAuthoredCreationFingerprint({
      objectId: OBJECT,
      kind: 'personal-marker',
      worldX: -1,
      worldY: 2
    });
    const changed = createForestAuthoredCreationFingerprint({
      objectId: OBJECT,
      kind: 'personal-marker',
      worldX: -1,
      worldY: 3
    });

    expect(first).toEqual(repeated);
    expect(first.version).toBe(1);
    expect(first.digest).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(changed.digest).not.toBe(first.digest);
  });

  it('rejects malformed and unknown public input before transactional authority work', async () => {
    const transactionRunner = jasmine.createSpy('transactionRunner');
    const test = harness({ transactionRunner });

    for (const input of [
      createInput({ protocolVersion: 2 }),
      createInput({ kind: 'bench' }),
      createInput({ objectId: 'not-a-uuid' }),
      createInput({ worldX: 0.5 }),
      createInput({ nearbyObjectId: OBJECT })
    ]) {
      await expectAsync(test.service.create(input)).toBeRejected();
    }
    expect(transactionRunner).not.toHaveBeenCalled();
  });

  it('creates one marker and advances its destination cell in the same transaction', async () => {
    const test = harness();

    const result = await test.service.create(createInput());

    expect(result.protocolVersion).toBe(FOREST_AUTHORED_MUTATION_PROTOCOL_VERSION);
    expect(result.outcome).toBe('created');
    expect(result.object).toEqual(jasmine.objectContaining({
      objectId: OBJECT,
      state: 'active',
      recordRevision: 1,
      placement: { worldX: 10, worldY: 20 }
    }));
    expect(test.acquireFence).toHaveBeenCalledWith(jasmine.objectContaining({
      ownerUserId: OWNER,
      session: 'transaction-session'
    }));
    expect(test.inspectPlacement).toHaveBeenCalledWith(jasmine.objectContaining({
      objectId: OBJECT,
      worldX: 10,
      worldY: 20,
      enforceDensity: true,
      session: 'transaction-session'
    }));
    expect(test.objectWrites.length).toBe(1);
    expect(test.regionWrites).toEqual([
      jasmine.objectContaining({ cellX: 0, cellY: 0, spatialIndexVersion: 1 })
    ]);
  });

  it('recovers matching create retries without validating placement or writing again', async () => {
    const moved = authoredObject({
      placement: { worldX: 800, worldY: -1 },
      placementIndex: { version: 1, cellX: 1, cellY: -1 },
      recordRevision: 4
    });
    const test = harness({ current: moved });

    const result = await test.service.create(createInput());

    expect(result.outcome).toBe('existing-active');
    expect(result.object.recordRevision).toBe(4);
    expect(result.object.placement).toEqual({ worldX: 800, worldY: -1 });
    expect(test.inspectPlacement).not.toHaveBeenCalled();
    expect(test.objectWrites).toEqual([]);
    expect(test.regionWrites).toEqual([]);
  });

  it('returns a removed matching create retry without resurrecting it', async () => {
    const removedAt = new Date('2026-08-10T12:00:00.000Z');
    const test = harness({
      current: authoredObject({
        state: 'removed',
        recordRevision: 2,
        changedAt: removedAt,
        removedAt,
        purgeEligibleAt: new Date(
          removedAt.getTime() + FOREST_AUTHORED_TOMBSTONE_RETENTION_MS
        )
      })
    });

    const result = await test.service.create(createInput());

    expect(result.outcome).toBe('existing-removed');
    expect(result.object.state).toBe('removed');
    expect(test.objectWrites).toEqual([]);
  });

  it('rejects reuse of one object id for different creation intent', async () => {
    const test = harness({ current: authoredObject() });

    const error = await rejectedError(test.service.create(createInput({ worldY: 21 })));

    expect(error).toEqual(jasmine.any(ForestAuthoredMutationError));
    expect(error.code).toBe('AUTHORED_CREATE_IDEMPOTENCY_CONFLICT');
    expect(error.object.objectId).toBe(OBJECT);
    expect(test.objectWrites).toEqual([]);
  });

  it('recovers a committed move by desired state before considering a stale revision', async () => {
    const test = harness({
      current: authoredObject({
        placement: { worldX: 30, worldY: 40 },
        placementIndex: { version: 1, cellX: 0, cellY: 0 },
        recordRevision: 3
      })
    });

    const result = await test.service.move(moveInput({ expectedRevision: 1 }));

    expect(result.outcome).toBe('unchanged');
    expect(result.object.recordRevision).toBe(3);
    expect(test.inspectPlacement).not.toHaveBeenCalled();
    expect(test.regionWrites).toEqual([]);
  });

  it('returns the current safe object for a stale move to a different position', async () => {
    const test = harness({ current: authoredObject({ recordRevision: 2 }) });

    const error = await rejectedError(test.service.move(moveInput({ expectedRevision: 1 })));

    expect(error.code).toBe('AUTHORED_OBJECT_CONFLICT');
    expect(error.object.recordRevision).toBe(2);
    expect(test.inspectPlacement).not.toHaveBeenCalled();
  });

  it('does not move a tombstone or create a missing object through move', async () => {
    const removedAt = new Date('2026-08-10T12:00:00.000Z');
    const removed = harness({
      current: authoredObject({
        state: 'removed',
        recordRevision: 2,
        changedAt: removedAt,
        removedAt,
        purgeEligibleAt: new Date(
          removedAt.getTime() + FOREST_AUTHORED_TOMBSTONE_RETENTION_MS
        )
      })
    });
    const missing = harness();

    const removedError = await rejectedError(removed.service.move(moveInput()));
    const missingError = await rejectedError(missing.service.move(moveInput()));

    expect(removedError.code).toBe('AUTHORED_OBJECT_REMOVED');
    expect(removedError.object.state).toBe('removed');
    expect(missingError.code).toBe('AUTHORED_OBJECT_NOT_FOUND');
    expect(removed.objectWrites).toEqual([]);
    expect(missing.objectWrites).toEqual([]);
  });

  it('moves within a full cell without applying the destination density guard', async () => {
    const test = harness({ current: authoredObject() });

    const result = await test.service.move(moveInput());

    expect(result.outcome).toBe('moved');
    expect(result.object.recordRevision).toBe(2);
    expect(test.inspectPlacement).toHaveBeenCalledWith(jasmine.objectContaining({
      enforceDensity: false
    }));
    expect(test.regionWrites.length).toBe(1);
    expect(test.regionWrites[0]).toEqual(jasmine.objectContaining({ cellX: 0, cellY: 0 }));
  });

  it('moves across cells and advances source and destination revisions exactly once', async () => {
    const test = harness({ current: authoredObject() });

    const result = await test.service.move(moveInput({ worldX: 720, worldY: -1 }));

    expect(result.outcome).toBe('moved');
    expect(test.inspectPlacement).toHaveBeenCalledWith(jasmine.objectContaining({
      enforceDensity: true,
      destinationIndex: { version: 1, cellX: 1, cellY: -1 }
    }));
    expect(test.regionWrites).toEqual([
      jasmine.objectContaining({ cellX: 0, cellY: 0 }),
      jasmine.objectContaining({ cellX: 1, cellY: -1 })
    ]);
  });

  it('turns an active marker into a 90-day tombstone and advances its cell', async () => {
    const test = harness({ current: authoredObject() });

    const result = await test.service.remove(removeInput());

    expect(result.outcome).toBe('removed');
    expect(result.object.state).toBe('removed');
    expect(result.object.recordRevision).toBe(2);
    expect(result.object.removedAt).toEqual(NOW);
    expect(result.object.purgeEligibleAt).toEqual(new Date(
      NOW.getTime() + FOREST_AUTHORED_TOMBSTONE_RETENTION_MS
    ));
    expect(test.regionWrites.length).toBe(1);
  });

  it('rejects stale removal and fails closed before overflowing a record revision', async () => {
    const stale = harness({ current: authoredObject({ recordRevision: 2 }) });
    const exhausted = harness({
      current: authoredObject({ recordRevision: Number.MAX_SAFE_INTEGER })
    });

    const staleError = await rejectedError(stale.service.remove(removeInput()));
    const exhaustedError = await rejectedError(exhausted.service.remove(removeInput({
      expectedRevision: Number.MAX_SAFE_INTEGER
    })));

    expect(staleError.code).toBe('AUTHORED_OBJECT_CONFLICT');
    expect(staleError.object.recordRevision).toBe(2);
    expect(exhaustedError.code).toBe('AUTHORED_OBJECT_UNAVAILABLE');
    expect(stale.objectWrites).toEqual([]);
    expect(exhausted.objectWrites).toEqual([]);
  });

  it('makes removal retry idempotent regardless of the repeated expected revision', async () => {
    const removedAt = new Date('2026-08-10T12:00:00.000Z');
    const test = harness({
      current: authoredObject({
        state: 'removed',
        recordRevision: 4,
        changedAt: removedAt,
        removedAt,
        purgeEligibleAt: new Date(
          removedAt.getTime() + FOREST_AUTHORED_TOMBSTONE_RETENTION_MS
        )
      })
    });

    const result = await test.service.remove(removeInput({ expectedRevision: 1 }));

    expect(result.outcome).toBe('already-removed');
    expect(result.object.recordRevision).toBe(4);
    expect(test.objectWrites).toEqual([]);
    expect(test.regionWrites).toEqual([]);
  });

  it('fails closed for deletion, reset, unsupported world, and running reconciliation', async () => {
    const cases = [
      { options: { deletion: { _id: 'deletion' } }, code: 'AUTHORED_OWNER_UNAVAILABLE' },
      { options: { reset: { _id: 'reset' } }, code: 'AUTHORED_RESETTING' },
      {
        options: { ownerWorld: world({ worldGenerationVersion: 2 }) },
        code: 'AUTHORED_MIGRATION_REQUIRED'
      },
      {
        options: { ownerWorld: world({ reconciliation: { state: 'running' } }) },
        code: 'AUTHORED_OWNER_UNAVAILABLE'
      }
    ];
    for (const testCase of cases) {
      const test = harness(testCase.options);
      const error = await rejectedError(test.service.create(createInput()));
      expect(error.code).toBe(testCase.code);
      expect(test.objectWrites).toEqual([]);
    }
  });

  it('does not perform object or revision writes when the transaction aborts before work', async () => {
    const aborted = new Error('transaction aborted');
    const test = harness({
      transactionRunner: jasmine.createSpy('transactionRunner').and.rejectWith(aborted)
    });

    await expectAsync(test.service.create(createInput())).toBeRejectedWith(aborted);
    expect(test.acquireFence).not.toHaveBeenCalled();
    expect(test.objectWrites).toEqual([]);
    expect(test.regionWrites).toEqual([]);
  });
});

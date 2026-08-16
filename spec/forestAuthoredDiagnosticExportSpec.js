import {
  buildForestAuthoredDiagnosticExportService,
  FOREST_AUTHORED_DIAGNOSTIC_MAX_PAGE_SIZE,
  ForestAuthoredDiagnosticExportError
} from '../server/services/forestAuthoredDiagnosticExport.js';

const OWNER = '507f1f77bcf86cd799439011';
const OTHER_OWNER = '507f1f77bcf86cd799439012';
const FOREST = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';
const LATER_OBJECT = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-08-16T12:00:00.000Z');
const CREATED = new Date('2026-08-01T12:00:00.000Z');
const CHANGED = new Date('2026-08-12T12:00:00.000Z');

function chain(value) {
  const query = {
    sort: jasmine.createSpy('sort').and.callFake(() => query),
    limit: jasmine.createSpy('limit').and.callFake(() => query),
    lean: jasmine.createSpy('lean').and.callFake(() => query),
    exec: jasmine.createSpy('exec').and.callFake(async () => value)
  };
  return query;
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

function object(overrides = {}) {
  const base = {
    schemaVersion: 1,
    identityVersion: 1,
    objectId: OBJECT,
    forestId: FOREST,
    ownerUserId: OWNER,
    kind: 'personal-marker',
    state: 'active',
    placement: { worldX: -1, worldY: 721 },
    placementIndex: { version: 1, cellX: -1, cellY: 1 },
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
    createdAt: CREATED,
    changedAt: CHANGED,
    removedAt: null,
    purgeEligibleAt: null
  };
  return {
    ...base,
    ...overrides,
    placement: { ...base.placement, ...overrides.placement },
    placementIndex: { ...base.placementIndex, ...overrides.placementIndex },
    worldVersionEvidence: {
      ...base.worldVersionEvidence,
      ...overrides.worldVersionEvidence
    },
    appearance: { ...base.appearance, ...overrides.appearance },
    creationFingerprint: {
      ...base.creationFingerprint,
      ...overrides.creationFingerprint
    }
  };
}

function removedObject(overrides = {}) {
  const removedAt = new Date('2026-08-13T12:00:00.000Z');
  return object({
    objectId: LATER_OBJECT,
    state: 'removed',
    recordRevision: 3,
    changedAt: removedAt,
    removedAt,
    purgeEligibleAt: new Date('2026-11-11T12:00:00.000Z'),
    ...overrides
  });
}

function harness({ ownerWorld = world(), objects = [object()] } = {}) {
  const worldQuery = chain(ownerWorld);
  const objectQuery = chain(objects);
  const ForestOwnerWorldModel = {
    findOne: jasmine.createSpy('ForestOwnerWorld.findOne').and.returnValue(worldQuery)
  };
  const ForestAuthoredObjectModel = {
    find: jasmine.createSpy('ForestAuthoredObject.find').and.returnValue(objectQuery)
  };
  return {
    read: buildForestAuthoredDiagnosticExportService({
      ForestOwnerWorldModel,
      ForestAuthoredObjectModel,
      now: () => NOW
    }),
    ForestOwnerWorldModel,
    ForestAuthoredObjectModel,
    objectQuery
  };
}

async function diagnosticError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected an authored diagnostic error.');
}

describe('forest authored diagnostic export', () => {
  it('returns the exact private active-object inventory without owner identity', async () => {
    const test = harness({ objects: [object(), removedObject()] });

    const result = await test.read({ ownerUserId: OWNER, includeRemoved: false });

    expect(result).toEqual({
      exportVersion: 1,
      status: 'ready',
      forestId: FOREST,
      includeRemoved: false,
      exportStartedAt: NOW,
      objects: [{
        objectId: OBJECT,
        kind: 'personal-marker',
        state: 'active',
        placement: { worldX: -1, worldY: 721 },
        placementIndex: { version: 1, cellX: -1, cellY: 1 },
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
        createdAt: CREATED,
        changedAt: CHANGED,
        removedAt: null,
        purgeEligibleAt: null
      }],
      page: { inspectedObjectCount: 2, returnedObjectCount: 1, nextCursor: null }
    });
    expect(JSON.stringify(result)).not.toContain(OWNER);
    expect(JSON.stringify(result)).not.toContain(OTHER_OWNER);
    const [filter, projection] = test.ForestAuthoredObjectModel.find.calls.first().args;
    expect(filter).toEqual({
      ownerUserId: OWNER,
      forestId: FOREST,
      createdAt: { $lte: NOW }
    });
    expect(projection.ownerUserId).toBe(1);
    expect(test.objectQuery.sort).toHaveBeenCalledOnceWith({ objectId: 1 });
    expect(test.objectQuery.limit).toHaveBeenCalledOnceWith(101);
  });

  it('includes compact tombstone lifecycle evidence only when explicitly requested', async () => {
    const tombstone = removedObject();
    const result = await harness({ objects: [tombstone] }).read({
      ownerUserId: OWNER,
      includeRemoved: true,
      limit: 10
    });

    expect(result.objects).toEqual([jasmine.objectContaining({
      objectId: LATER_OBJECT,
      state: 'removed',
      placement: { worldX: -1, worldY: 721 },
      removedAt: tombstone.removedAt,
      purgeEligibleAt: tombstone.purgeEligibleAt
    })]);
    expect(result.page).toEqual({
      inspectedObjectCount: 1,
      returnedObjectCount: 1,
      nextCursor: null
    });
  });

  it('requires explicit inclusion and rejects malformed bounds before private reads', async () => {
    for (const input of [
      { ownerUserId: OWNER },
      { ownerUserId: OWNER, includeRemoved: 'false' },
      { ownerUserId: 'invalid', includeRemoved: false },
      { ownerUserId: OWNER, includeRemoved: false, limit: 0 },
      {
        ownerUserId: OWNER,
        includeRemoved: false,
        limit: FOREST_AUTHORED_DIAGNOSTIC_MAX_PAGE_SIZE + 1
      }
    ]) {
      const test = harness();
      const error = await diagnosticError(test.read(input));
      expect(error).toEqual(jasmine.any(ForestAuthoredDiagnosticExportError));
      expect(error.code).toBe('INVALID_AUTHORED_DIAGNOSTIC_INPUT');
      expect(test.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();
    }
  });

  it('binds continuation to forest, inclusion choice, schema, and export start time', async () => {
    const first = harness({ objects: [object(), removedObject()] });
    const firstPage = await first.read({
      ownerUserId: OWNER,
      includeRemoved: true,
      limit: 1
    });
    expect(firstPage.page.nextCursor).toEqual(jasmine.any(String));

    const next = harness({ objects: [removedObject()] });
    const nextPage = await next.read({
      ownerUserId: OWNER,
      includeRemoved: true,
      cursor: firstPage.page.nextCursor,
      limit: 1
    });
    expect(nextPage.exportStartedAt).toEqual(NOW);
    expect(next.ForestAuthoredObjectModel.find.calls.first().args[0]).toEqual({
      ownerUserId: OWNER,
      forestId: FOREST,
      createdAt: { $lte: NOW },
      objectId: { $gt: OBJECT }
    });

    const changedChoice = harness();
    const choiceError = await diagnosticError(changedChoice.read({
      ownerUserId: OWNER,
      includeRemoved: false,
      cursor: firstPage.page.nextCursor
    }));
    expect(choiceError.code).toBe('INVALID_AUTHORED_DIAGNOSTIC_INPUT');
    expect(changedChoice.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();

    const changedForest = harness({ ownerWorld: world({
      forestId: '44444444-4444-4444-8444-444444444444'
    }) });
    const forestError = await diagnosticError(changedForest.read({
      ownerUserId: OWNER,
      includeRemoved: true,
      cursor: firstPage.page.nextCursor
    }));
    expect(forestError.code).toBe('INVALID_AUTHORED_DIAGNOSTIC_INPUT');
    expect(changedForest.ForestAuthoredObjectModel.find).not.toHaveBeenCalled();
  });

  it('returns an honest empty envelope when no primary forest exists', async () => {
    const test = harness({ ownerWorld: null });
    const result = await test.read({ ownerUserId: OWNER, includeRemoved: true });

    expect(result).toEqual({
      exportVersion: 1,
      status: 'not-established',
      forestId: null,
      includeRemoved: true,
      exportStartedAt: NOW,
      objects: [],
      page: { inspectedObjectCount: 0, returnedObjectCount: 0, nextCursor: null }
    });
    expect(test.ForestAuthoredObjectModel.find).not.toHaveBeenCalled();
  });

  it('distinguishes unsupported versions from malformed current records', async () => {
    const unsupportedCases = [
      harness({ ownerWorld: world({ worldGenerationVersion: 2 }) }),
      harness({ objects: [object({ schemaVersion: 2 })] }),
      harness({ objects: [object({ appearance: { version: 2 } })] }),
      harness({ objects: [object({ state: 'future-state' })] })
    ];
    for (const test of unsupportedCases) {
      const error = await diagnosticError(test.read({
        ownerUserId: OWNER, includeRemoved: true
      }));
      expect(error.code).toBe('AUTHORED_DIAGNOSTIC_MIGRATION_REQUIRED');
    }

    for (const malformed of [
      object({ objectId: 'invalid' }),
      object({ placement: { worldX: 720 } }),
      object({ creationFingerprint: { digest: 'bad' } }),
      removedObject({ purgeEligibleAt: CHANGED })
    ]) {
      const error = await diagnosticError(harness({ objects: [malformed] }).read({
        ownerUserId: OWNER, includeRemoved: true
      }));
      expect(error.code).toBe('AUTHORED_DIAGNOSTIC_UNAVAILABLE');
    }
  });

  it('rejects model results that exceed the requested bounded read', async () => {
    const test = harness({
      objects: [object(), removedObject(), object({
        objectId: '44444444-4444-4444-8444-444444444444'
      })]
    });
    const error = await diagnosticError(test.read({
      ownerUserId: OWNER,
      includeRemoved: true,
      limit: 1
    }));

    expect(error.code).toBe('AUTHORED_DIAGNOSTIC_UNAVAILABLE');
  });
});

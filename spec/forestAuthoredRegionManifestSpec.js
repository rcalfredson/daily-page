import {
  buildForestAuthoredRegionManifestService,
  FOREST_AUTHORED_REGION_MAX_CELLS,
  FOREST_AUTHORED_REGION_MAX_PAGE_SIZE,
  ForestAuthoredRegionManifestError
} from '../server/services/forestAuthoredRegionManifest.js';

const OWNER = '507f1f77bcf86cd799439011';
const OTHER_OWNER = '507f1f77bcf86cd799439012';
const FOREST = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';
const LATER_OBJECT = '33333333-3333-4333-8333-333333333333';
const CELLS = Object.freeze([{ cellX: -1, cellY: 1 }]);
const CHANGED_AT = new Date('2026-08-12T12:00:00.000Z');

function chain(value) {
  const query = {
    sort: jasmine.createSpy('sort').and.callFake(() => query),
    limit: jasmine.createSpy('limit').and.callFake(() => query),
    lean: jasmine.createSpy('lean').and.callFake(() => query),
    exec: jasmine.createSpy('exec').and.callFake(async () => (
      typeof value === 'function' ? value() : value
    ))
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

function revision(overrides = {}) {
  return {
    schemaVersion: 1,
    forestId: FOREST,
    ownerUserId: OWNER,
    spatialIndexVersion: 1,
    cellX: -1,
    cellY: 1,
    revision: 4,
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
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    changedAt: CHANGED_AT,
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

function reset(overrides = {}) {
  return {
    schemaVersion: 1,
    operationVersion: 1,
    ownerUserId: OWNER,
    forestId: FOREST,
    status: 'processing',
    authoredObjectSchemaVersion: 1,
    spatialIndexVersion: 1,
    ...overrides
  };
}

function harness({
  ownerWorld = world(),
  resetOperation = null,
  revisions = [[revision()], [revision()]],
  unsupportedObject = null,
  objects = [object()]
} = {}) {
  const worldQuery = chain(ownerWorld);
  const objectQuery = chain(objects);
  let revisionReadIndex = 0;
  let resetReadIndex = 0;
  const revisionQueries = [];
  const ForestOwnerWorldModel = {
    findOne: jasmine.createSpy('ForestOwnerWorld.findOne').and.returnValue(worldQuery)
  };
  const ForestAuthoredResetOperationModel = {
    findOne: jasmine.createSpy('ForestAuthoredResetOperation.findOne')
      .and.callFake(() => {
        const values = Array.isArray(resetOperation) ? resetOperation : [resetOperation];
        const value = values[Math.min(resetReadIndex, values.length - 1)];
        resetReadIndex += 1;
        return chain(value);
      })
  };
  const ForestAuthoredRegionRevisionModel = {
    find: jasmine.createSpy('ForestAuthoredRegionRevision.find').and.callFake(() => {
      const value = revisions[Math.min(revisionReadIndex, revisions.length - 1)];
      revisionReadIndex += 1;
      const query = chain(value);
      revisionQueries.push(query);
      return query;
    })
  };
  const ForestAuthoredObjectModel = {
    findOne: jasmine.createSpy('ForestAuthoredObject.findOne')
      .and.returnValue(chain(unsupportedObject)),
    find: jasmine.createSpy('ForestAuthoredObject.find').and.returnValue(objectQuery)
  };
  return {
    read: buildForestAuthoredRegionManifestService({
      ForestOwnerWorldModel,
      ForestAuthoredObjectModel,
      ForestAuthoredRegionRevisionModel,
      ForestAuthoredResetOperationModel
    }),
    ForestOwnerWorldModel,
    ForestAuthoredObjectModel,
    ForestAuthoredRegionRevisionModel,
    ForestAuthoredResetOperationModel,
    objectQuery,
    revisionQueries
  };
}

async function regionError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected an authored region error.');
}

describe('forest authored-region manifest', () => {
  it('returns honest non-ready states without reading partial authored state', async () => {
    const absent = harness({ ownerWorld: null });
    const absentResult = await absent.read({ ownerUserId: OWNER, cells: CELLS });
    expect(absentResult.status).toBe('not-established');
    expect(absentResult.objects).toEqual([]);
    expect(absent.ForestAuthoredRegionRevisionModel.find).not.toHaveBeenCalled();

    const reconciling = harness({
      ownerWorld: world({ reconciliation: { state: 'running' } })
    });
    const reconcilingResult = await reconciling.read({ ownerUserId: OWNER, cells: CELLS });
    expect(reconcilingResult.status).toBe('reconciling');
    expect(reconciling.ForestAuthoredRegionRevisionModel.find).not.toHaveBeenCalled();

    const resetting = harness({ resetOperation: reset() });
    const resettingResult = await resetting.read({ ownerUserId: OWNER, cells: CELLS });
    expect(resettingResult.status).toBe('resetting');
    expect(resetting.ForestAuthoredObjectModel.find).not.toHaveBeenCalled();
  });

  it('returns only render-safe active objects between two equal revision-vector reads',
    async () => {
      const test = harness();
      const result = await test.read({ ownerUserId: OWNER, cells: CELLS, limit: 4 });

      expect(result).toEqual({
        manifestVersion: 1,
        status: 'ready',
        spatialIndex: { version: 1, cellSize: 720 },
        requestedRegions: [{ id: '-1:1', cellX: -1, cellY: 1, revision: 4 }],
        objects: [{
          objectId: OBJECT,
          kind: 'personal-marker',
          regionId: '-1:1',
          worldX: -1,
          worldY: 721,
          appearance: { id: 'quiet-waymarker', version: 1 },
          recordRevision: 2,
          changedAt: CHANGED_AT
        }],
        page: { returnedObjectCount: 1, nextCursor: null }
      });
      expect(test.ForestAuthoredRegionRevisionModel.find).toHaveBeenCalledTimes(2);
      expect(test.revisionQueries.every(query => (
        query.limit.calls.first().args[0] === 2
      ))).toBeTrue();
      const [filter, projection] = test.ForestAuthoredObjectModel.find.calls.first().args;
      expect(filter).toEqual(jasmine.objectContaining({
        ownerUserId: OWNER,
        forestId: FOREST,
        state: 'active',
        $or: [{ 'placementIndex.cellX': -1, 'placementIndex.cellY': 1 }]
      }));
      expect(filter.schemaVersion).toBeUndefined();
      expect(filter['placementIndex.version']).toBe(1);
      expect(projection.ownerUserId).toBe(1);
      expect(test.objectQuery.sort).toHaveBeenCalledOnceWith({ objectId: 1 });
      expect(test.objectQuery.limit).toHaveBeenCalledOnceWith(5);
      const serialized = JSON.stringify(result);
      for (const privateValue of [OWNER, OTHER_OWNER, FOREST, 'A'.repeat(43), 'worldVersionEvidence']) {
        expect(serialized).not.toContain(privateValue);
      }
    });

  it('canonicalizes cells and rejects malformed bounds before private reads', async () => {
    const sorted = harness({ revisions: [[], []], objects: [] });
    const result = await sorted.read({
      ownerUserId: OWNER,
      cells: [{ cellX: 2, cellY: 1 }, { cellX: -3, cellY: -1 }]
    });
    expect(result.requestedRegions.map(region => region.id)).toEqual(['-3:-1', '2:1']);
    expect(result.requestedRegions.map(region => region.revision)).toEqual([0, 0]);

    for (const input of [
      { ownerUserId: 'invalid', cells: CELLS },
      { ownerUserId: OWNER, cells: [] },
      { ownerUserId: OWNER, cells: [{ cellX: 0, cellY: 0 }, { cellX: 0, cellY: 0 }] },
      { ownerUserId: OWNER, cells: [{ cellX: 0.5, cellY: 0 }] },
      {
        ownerUserId: OWNER,
        cells: Array.from({ length: FOREST_AUTHORED_REGION_MAX_CELLS + 1 }, (_, cellX) => ({
          cellX, cellY: 0
        }))
      },
      { ownerUserId: OWNER, cells: CELLS, limit: FOREST_AUTHORED_REGION_MAX_PAGE_SIZE + 1 }
    ]) {
      const invalid = harness();
      const error = await regionError(invalid.read(input));
      expect(error.code).toBe('INVALID_AUTHORED_REGION_INPUT');
      expect(invalid.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();
    }
  });

  it('continues by stable object id with a cursor bound to cells and revisions', async () => {
    const first = harness({
      objects: [object(), object({ objectId: LATER_OBJECT })]
    });
    const firstPage = await first.read({ ownerUserId: OWNER, cells: CELLS, limit: 1 });
    expect(firstPage.objects.map(value => value.objectId)).toEqual([OBJECT]);
    expect(firstPage.page.nextCursor).toEqual(jasmine.any(String));

    const next = harness();
    await next.read({
      ownerUserId: OWNER,
      cells: CELLS,
      cursor: firstPage.page.nextCursor,
      limit: 1
    });
    expect(next.ForestAuthoredObjectModel.find.calls.first().args[0].objectId).toEqual({
      $gt: OBJECT
    });

    const changedCells = harness();
    const invalid = await regionError(changedCells.read({
      ownerUserId: OWNER,
      cells: [{ cellX: 0, cellY: 1 }],
      cursor: firstPage.page.nextCursor,
      limit: 1
    }));
    expect(invalid.code).toBe('INVALID_AUTHORED_REGION_INPUT');
    expect(changedCells.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects continuation after insertion, movement, removal, or disappearance changes a cell',
    async () => {
      const first = harness({ objects: [object(), object({ objectId: LATER_OBJECT })] });
      const firstPage = await first.read({ ownerUserId: OWNER, cells: CELLS, limit: 1 });
      for (const changedRevision of [5, 9, 100]) {
        const changed = harness({
          revisions: [[revision({ revision: changedRevision })]],
          objects: []
        });
        const error = await regionError(changed.read({
          ownerUserId: OWNER,
          cells: CELLS,
          cursor: firstPage.page.nextCursor,
          limit: 1
        }));
        expect(error.code).toBe('AUTHORED_REGION_CHANGED');
        expect(changed.ForestAuthoredObjectModel.find).not.toHaveBeenCalled();
      }
    });

  it('rejects a change between object selection and the final vector read', async () => {
    const test = harness({
      revisions: [[revision({ revision: 4 })], [revision({ revision: 5 })]]
    });

    const error = await regionError(test.read({ ownerUserId: OWNER, cells: CELLS }));

    expect(error.code).toBe('AUTHORED_REGION_CHANGED');
    expect(test.ForestAuthoredObjectModel.find).toHaveBeenCalledTimes(1);
  });

  it('returns resetting if reset begins after the initial state check', async () => {
    const test = harness({ resetOperation: [null, reset()] });

    const result = await test.read({ ownerUserId: OWNER, cells: CELLS });

    expect(result.status).toBe('resetting');
    expect(result.objects).toEqual([]);
    expect(test.ForestAuthoredObjectModel.find).toHaveBeenCalledTimes(1);
  });

  it('fails closed for cross-owner, unsupported object, revision, world, and reset evidence',
    async () => {
      const cases = [
        harness({ ownerWorld: world({ ownerUserId: OTHER_OWNER }) }),
        harness({ objects: [object({ schemaVersion: 2 })] }),
        harness({
          unsupportedObject: { _id: 'unsupported' },
          objects: []
        }),
        harness({ revisions: [[revision({ schemaVersion: 2 })]] }),
        harness({ revisions: [[], []] }),
        harness({ revisions: [[revision({ spatialIndexVersion: 2 })]] }),
        harness({ ownerWorld: world({ worldGenerationVersion: 2 }) }),
        harness({ resetOperation: reset({ operationVersion: 2 }) })
      ];
      for (const test of cases) {
        const error = await regionError(test.read({ ownerUserId: OWNER, cells: CELLS }));
        expect(error).toEqual(jasmine.any(ForestAuthoredRegionManifestError));
        expect(error.code).toBe('AUTHORED_REGION_MIGRATION_REQUIRED');
      }
    });

  it('rejects unbounded revision and object model results', async () => {
    const tooManyRevisions = harness({
      revisions: [[revision(), revision({ revision: 5 })]]
    });
    expect((await regionError(tooManyRevisions.read({
      ownerUserId: OWNER, cells: CELLS
    }))).code).toBe('AUTHORED_REGION_UNAVAILABLE');

    const tooManyObjects = harness({
      objects: [object(), object({ objectId: LATER_OBJECT }), object({
        objectId: '44444444-4444-4444-8444-444444444444'
      })]
    });
    expect((await regionError(tooManyObjects.read({
      ownerUserId: OWNER, cells: CELLS, limit: 1
    }))).code).toBe('AUTHORED_REGION_UNAVAILABLE');
  });
});

import {
  FOREST_AUTHORED_ACTIVE_CELL_LIMIT,
  FOREST_AUTHORED_MARKER_MINIMUM_SPACING,
  ForestAuthoredPlacementError,
  inspectForestAuthoredPlacement
} from '../server/services/forestAuthoredPlacement.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const OBJECT = '22222222-2222-4222-8222-222222222222';

function world() {
  return {
    forestId: FOREST,
    worldSeed: 'owner_world_seed_0123456789abcdef',
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1
  };
}

function environment() {
  return {
    policyVersion: 1,
    schemaVersion: 1,
    worldGenerationVersion: 1,
    originatingEnvironment: {
      regionId: 'signed-ground',
      groundSurfaceId: 'grove-moss'
    }
  };
}

function tree(overrides = {}) {
  return {
    schemaVersion: 1,
    identityVersion: 1,
    writingTreeId: '33333333-3333-4333-8333-333333333333',
    forestId: FOREST,
    ownerUserId: OWNER,
    sourceState: 'inactive',
    hiddenFromForest: true,
    placement: { policyVersion: 1, worldX: 100, worldY: 100 },
    placementIndex: { version: 1, cellX: 0, cellY: 0 },
    originatingEnvironment: {
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1
    },
    projection: {
      revision: 1,
      schemaVersion: 1,
      mappingVersion: 1,
      phenotypeId: 'open-crown-deciduous',
      phenotypeAssetVersion: 2
    },
    ...overrides
  };
}

function marker(index, overrides = {}) {
  const objectId = `${String(index).padStart(8, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return {
    schemaVersion: 1,
    identityVersion: 1,
    objectId,
    forestId: FOREST,
    ownerUserId: OWNER,
    kind: 'personal-marker',
    state: 'active',
    placement: { worldX: 100 + (index * 30), worldY: 100 },
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
    recordRevision: 1,
    changedAt: new Date('2026-08-12T12:00:00.000Z'),
    removedAt: null,
    purgeEligibleAt: null,
    ...overrides
  };
}

function query(records) {
  const chain = {
    sort: jasmine.createSpy('sort').and.callFake(() => chain),
    limit: jasmine.createSpy('limit').and.callFake(() => chain),
    session: jasmine.createSpy('session').and.callFake(() => chain),
    lean: jasmine.createSpy('lean').and.resolveTo(records)
  };
  return chain;
}

function harness({ trees = [], markers = [], resolvedEnvironment = environment() } = {}) {
  const treeQuery = query(trees);
  const markerQuery = query(markers);
  const ForestWritingTreeModel = {
    find: jasmine.createSpy('ForestWritingTree.find').and.returnValue(treeQuery)
  };
  const ForestAuthoredObjectModel = {
    find: jasmine.createSpy('ForestAuthoredObject.find').and.returnValue(markerQuery)
  };
  const resolveEnvironment = jasmine.createSpy('resolveEnvironment')
    .and.returnValue(resolvedEnvironment);

  return {
    inspect: overrides => inspectForestAuthoredPlacement({
      ownerUserId: OWNER,
      world: world(),
      objectId: OBJECT,
      worldX: 0,
      worldY: 0,
      session: 'transaction-session',
      ForestWritingTreeModel,
      ForestAuthoredObjectModel,
      resolveEnvironment,
      ...overrides
    }),
    ForestWritingTreeModel,
    ForestAuthoredObjectModel,
    resolveEnvironment,
    treeQuery,
    markerQuery
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

describe('forest authored placement authority', () => {
  it('resolves signed environment and reads bounded neighboring cells in the transaction', async () => {
    const test = harness();

    const result = await test.inspect({ worldX: -1, worldY: -721 });

    expect(result.placementIndex).toEqual({ version: 1, cellX: -1, cellY: -2 });
    expect(test.resolveEnvironment).toHaveBeenCalledWith(jasmine.objectContaining({
      worldX: -1,
      worldY: -721,
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1
    }));
    const treeFilter = test.ForestWritingTreeModel.find.calls.argsFor(0)[0];
    expect(treeFilter).toEqual(jasmine.objectContaining({
      ownerUserId: OWNER,
      forestId: FOREST,
      'placementIndex.cellX': { $in: [-2, -1, 0] },
      'placementIndex.cellY': { $in: [-3, -2, -1] }
    }));
    expect(test.treeQuery.session).toHaveBeenCalledWith('transaction-session');
    expect(test.markerQuery.session).toHaveBeenCalledWith('transaction-session');
  });

  it('rejects a marker closer than the accepted 26-unit center spacing', async () => {
    const test = harness({
      markers: [marker(1, {
        objectId: '44444444-4444-4444-8444-444444444444',
        placement: { worldX: FOREST_AUTHORED_MARKER_MINIMUM_SPACING - 1, worldY: 0 }
      })]
    });

    const error = await rejectedError(test.inspect());

    expect(error).toEqual(jasmine.any(ForestAuthoredPlacementError));
    expect(error.code).toBe('AUTHORED_PLACEMENT_COLLISION');
  });

  it('accepts a marker exactly at the spacing boundary', async () => {
    const test = harness({
      markers: [marker(1, {
        objectId: '44444444-4444-4444-8444-444444444444',
        placement: { worldX: FOREST_AUTHORED_MARKER_MINIMUM_SPACING, worldY: 0 }
      })]
    });

    await expectAsync(test.inspect()).toBeResolved();
  });

  it('excludes the moving object from its own collision and population checks', async () => {
    const test = harness({
      markers: [marker(1, {
        objectId: OBJECT,
        placement: { worldX: 0, worldY: 0 }
      })]
    });

    const result = await test.inspect();

    expect(result.destinationPopulation).toBe(0);
  });

  it('rejects a writing-tree collision using its registered phenotype radius and gap', async () => {
    const test = harness({
      trees: [tree({ placement: { policyVersion: 1, worldX: 27, worldY: 0 } })]
    });

    const error = await rejectedError(test.inspect());

    expect(error.code).toBe('AUTHORED_PLACEMENT_COLLISION');
  });

  it('accepts a writing tree exactly at radius plus marker radius plus visual gap', async () => {
    const test = harness({
      trees: [tree({ placement: { policyVersion: 1, worldX: 28, worldY: 0 } })]
    });

    await expectAsync(test.inspect()).toBeResolved();
  });

  it('fails closed on unsupported tree, marker, and environment evidence', async () => {
    const cases = [
      harness({ trees: [tree({ schemaVersion: 2 })] }),
      harness({ markers: [marker(1, { appearance: { id: 'unknown', version: 1 } })] }),
      harness({ resolvedEnvironment: { ...environment(), schemaVersion: 2 } })
    ];
    for (const test of cases) {
      const error = await rejectedError(test.inspect());
      expect(error.code).toBe('AUTHORED_PLACEMENT_UNAVAILABLE');
    }
  });

  it('applies the provisional destination-cell ceiling without treating it as lifetime quota', async () => {
    const markers = Array.from({ length: FOREST_AUTHORED_ACTIVE_CELL_LIMIT }, (_, index) => (
      marker(index + 1, {
        placement: {
          worldX: 100 + ((index % 16) * 30),
          worldY: 100 + (Math.floor(index / 16) * 30)
        },
        placementIndex: { version: 1, cellX: 0, cellY: 0 }
      })
    ));
    const test = harness({ markers });

    const error = await rejectedError(test.inspect());
    expect(error.code).toBe('AUTHORED_PLACEMENT_DENSITY');
    await expectAsync(test.inspect({ enforceDensity: false })).toBeResolved();
  });

  it('fails closed when either neighborhood exceeds its limit-plus-one bound', async () => {
    const tooManyMarkers = Array.from({ length: 1_153 }, (_, index) => marker(index + 1));
    const test = harness({ markers: tooManyMarkers });

    const error = await rejectedError(test.inspect());

    expect(error.code).toBe('AUTHORED_PLACEMENT_UNAVAILABLE');
    expect(test.markerQuery.limit).toHaveBeenCalledWith(1_153);
  });

  it('requires a transaction session for authoritative neighborhood reads', async () => {
    const test = harness();

    const error = await rejectedError(test.inspect({ session: null }));

    expect(error.code).toBe('INVALID_AUTHORED_PLACEMENT_DEPENDENCY');
    expect(test.ForestWritingTreeModel.find).not.toHaveBeenCalled();
  });
});

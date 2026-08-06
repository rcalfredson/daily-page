import {
  buildForestOwnerRegionManifestService,
  FOREST_OWNER_REGION_MAX_CELLS,
  ForestOwnerRegionManifestError
} from '../server/services/forestOwnerRegionManifest.js';
import {
  FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE
} from '../server/services/forestOwnerPlacementNeighborhood.js';
import {
  FOREST_RENDERER_ID,
  FOREST_TREE_ASSET_SCHEMA_VERSION,
  treeAssetCacheKey
} from '../server/services/forest/v3/treeAsset.js';
import {
  DECIDUOUS_PHENOTYPE_ASSET_VERSION,
  DECIDUOUS_PHENOTYPE_ID,
  FOREST_PHENOTYPE_SCENE_TRAITS
} from '../server/services/forest/v3/phenotype.js';
import { FOREST_RENDERER_VERSION_V3 } from '../server/services/forestTreeGeneratorV3.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_USER_ID = '507f1f77bcf86cd799439012';
const FOREST_ID = '11111111-1111-4111-8111-111111111111';
const TREE_ID = '22222222-2222-4222-8222-222222222222';
const LATER_TREE_ID = '33333333-3333-4333-8333-333333333333';
const GROUP_ID = '507f191e810c19729de860ea';
const BLOCK_ID = '507f1f77bcf86cd799439013';
const CELLS = Object.freeze([{ cellX: -1, cellY: 1 }]);

function chain(value) {
  const query = {
    sort: jasmine.createSpy('sort').and.callFake(() => query),
    limit: jasmine.createSpy('limit').and.callFake(() => query),
    lean: jasmine.createSpy('lean').and.callFake(() => query),
    exec: jasmine.createSpy('exec').and.resolveTo(value)
  };
  return query;
}

function world(overrides = {}) {
  return {
    schemaVersion: 1,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
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

function tree(overrides = {}) {
  const base = {
    schemaVersion: 1,
    identityVersion: 1,
    writingTreeId: TREE_ID,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    translationGroupId: GROUP_ID,
    sourceState: 'active',
    hiddenFromForest: false,
    foundingSource: { blockId: BLOCK_ID, createdAt: new Date('2026-07-01T00:00:00.000Z') },
    placement: { policyVersion: 1, slot: 7, worldX: -1, worldY: 721 },
    placementIndex: { version: 1, cellX: -1, cellY: 1 },
    originatingEnvironment: {
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1,
      regionId: 'temperate-grove',
      habitatId: 'neutral-grove',
      groundSurfaceId: 'meadow',
      transitionState: 'settled'
    },
    projection: {
      revision: 1,
      schemaVersion: 1,
      mappingVersion: 1,
      specimenSeed: 123456,
      phenotypeId: DECIDUOUS_PHENOTYPE_ID,
      phenotypeAssetVersion: DECIDUOUS_PHENOTYPE_ASSET_VERSION,
      creationSeason: 'summer',
      foliagePaletteId: 'summer-green',
      projectionFingerprint: 'private-projection-evidence',
      visualFingerprint: 'mapping-v1:foliage-summer-green'
    }
  };
  return {
    ...base,
    ...overrides,
    placement: { ...base.placement, ...overrides.placement },
    placementIndex: { ...base.placementIndex, ...overrides.placementIndex },
    originatingEnvironment: {
      ...base.originatingEnvironment,
      ...overrides.originatingEnvironment
    },
    projection: { ...base.projection, ...overrides.projection }
  };
}

function harness({ ownerWorld = world(), trees = [tree()] } = {}) {
  const worldQuery = chain(ownerWorld);
  const treeQuery = chain(trees);
  const ForestOwnerWorldModel = {
    findOne: jasmine.createSpy('ForestOwnerWorld.findOne').and.returnValue(worldQuery)
  };
  const ForestWritingTreeModel = {
    find: jasmine.createSpy('ForestWritingTree.find').and.returnValue(treeQuery)
  };
  return {
    read: buildForestOwnerRegionManifestService({
      ForestOwnerWorldModel,
      ForestWritingTreeModel
    }),
    ForestOwnerWorldModel,
    ForestWritingTreeModel,
    treeQuery
  };
}

async function expectRegionError(promise, code) {
  try {
    await promise;
    fail(`Expected ${code}.`);
  } catch (error) {
    expect(error).toEqual(jasmine.any(ForestOwnerRegionManifestError));
    expect(error.code).toBe(code);
  }
}

describe('forest owner region manifest', () => {
  it('returns honest empty states before establishment and during reconciliation', async () => {
    const absent = harness({ ownerWorld: null });
    const absentResult = await absent.read({ ownerUserId: OWNER_USER_ID, cells: CELLS });

    expect(absentResult.status).toBe('not-established');
    expect(absentResult.placements).toEqual([]);
    expect(absent.ForestWritingTreeModel.find).not.toHaveBeenCalled();

    const running = harness({
      ownerWorld: world({ reconciliation: { state: 'running', phase: 'owner-blocks' } })
    });
    const runningResult = await running.read({ ownerUserId: OWNER_USER_ID, cells: CELLS });

    expect(runningResult.status).toBe('reconciling');
    expect(runningResult.placements).toEqual([]);
    expect(running.ForestWritingTreeModel.find).not.toHaveBeenCalled();
  });

  it('returns a bounded scene-safe manifest from exact authorized cells', async () => {
    const test = harness();
    const result = await test.read({
      ownerUserId: OWNER_USER_ID,
      cells: [{ cellX: -1, cellY: 1 }],
      limit: 4
    });

    expect(result).toEqual({
      manifestVersion: 1,
      status: 'ready',
      spatialIndex: { version: 1, cellSize: FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE },
      requestedRegions: [{ id: '-1:1', cellX: -1, cellY: 1 }],
      assetContract: {
        schemaVersion: FOREST_TREE_ASSET_SCHEMA_VERSION,
        rendererId: FOREST_RENDERER_ID,
        rendererVersion: FOREST_RENDERER_VERSION_V3
      },
      placements: [{
        id: TREE_ID,
        regionId: '-1:1',
        worldX: -1,
        worldY: 721,
        scale: 1,
        collisionRadius: FOREST_PHENOTYPE_SCENE_TRAITS[DECIDUOUS_PHENOTYPE_ID].collisionRadius,
        phenotypeId: DECIDUOUS_PHENOTYPE_ID,
        assetKey: treeAssetCacheKey({
          seed: 123456,
          rendererVersion: FOREST_RENDERER_VERSION_V3,
          phenotypeId: DECIDUOUS_PHENOTYPE_ID,
          phenotypeAssetVersion: DECIDUOUS_PHENOTYPE_ASSET_VERSION,
          meaningProjection: {
            version: 1,
            visualFingerprint: 'mapping-v1:foliage-summer-green'
          }
        })
      }],
      page: { returnedPlacementCount: 1, nextCursor: null }
    });
    expect(test.ForestOwnerWorldModel.findOne).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      worldRole: 'primary'
    });
    const [filter, projection] = test.ForestWritingTreeModel.find.calls.first().args;
    expect(filter).toEqual(jasmine.objectContaining({
      ownerUserId: OWNER_USER_ID,
      forestId: FOREST_ID,
      sourceState: 'active',
      hiddenFromForest: false,
      'placementIndex.version': 1,
      $or: [{ 'placementIndex.cellX': -1, 'placementIndex.cellY': 1 }]
    }));
    expect(projection.translationGroupId).toBeUndefined();
    expect(projection.foundingSource).toBeUndefined();
    expect(test.treeQuery.sort).toHaveBeenCalledOnceWith({ writingTreeId: 1 });
    expect(test.treeQuery.limit).toHaveBeenCalledOnceWith(5);
    const serialized = JSON.stringify(result);
    for (const privateValue of [OWNER_USER_ID, OTHER_OWNER_USER_ID, FOREST_ID, GROUP_ID, BLOCK_ID,
      'private-projection-evidence', 'title', 'route']) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('canonicalizes exact signed cells and rejects malformed or excessive regions before reads', async () => {
    const sorted = harness({ trees: [] });
    const result = await sorted.read({
      ownerUserId: OWNER_USER_ID,
      cells: [{ cellX: 2, cellY: 1 }, { cellX: -3, cellY: -1 }, { cellX: -1, cellY: 1 }]
    });
    expect(result.requestedRegions.map(region => region.id)).toEqual(['-3:-1', '-1:1', '2:1']);

    for (const cells of [
      [{ cellX: 0, cellY: 0 }, { cellX: 0, cellY: 0 }],
      [{ cellX: 0, cellY: 0, radius: 4 }],
      [{ cellX: 0.5, cellY: 0 }],
      Array.from({ length: FOREST_OWNER_REGION_MAX_CELLS + 1 }, (_, cellX) => ({
        cellX,
        cellY: 0
      }))
    ]) {
      const invalid = harness();
      await expectRegionError(invalid.read({ ownerUserId: OWNER_USER_ID, cells }),
        'INVALID_OWNER_REGION_INPUT');
      expect(invalid.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();
      expect(invalid.ForestWritingTreeModel.find).not.toHaveBeenCalled();
    }
  });

  it('uses a region-bound opaque cursor and continues by stable tree identity', async () => {
    const first = harness({
      trees: [tree(), tree({ writingTreeId: LATER_TREE_ID })]
    });
    const firstPage = await first.read({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      limit: 1
    });
    expect(firstPage.placements.map(placement => placement.id)).toEqual([TREE_ID]);
    expect(firstPage.page.nextCursor).toEqual(jasmine.any(String));

    const next = harness();
    await next.read({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      cursor: firstPage.page.nextCursor,
      limit: 1
    });
    expect(next.ForestWritingTreeModel.find.calls.first().args[0].writingTreeId).toEqual({
      $gt: TREE_ID
    });

    const changedRegion = harness();
    await expectRegionError(changedRegion.read({
      ownerUserId: OWNER_USER_ID,
      cells: [{ cellX: 0, cellY: 1 }],
      cursor: firstPage.page.nextCursor,
      limit: 1
    }), 'INVALID_OWNER_REGION_INPUT');
    expect(changedRegion.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();
    expect(changedRegion.ForestWritingTreeModel.find).not.toHaveBeenCalled();
  });

  it('fails closed for stale spatial identity and unsupported projection identity', async () => {
    const invalidTrees = [
      tree({ placement: { worldX: Number.NaN } }),
      tree({ placementIndex: { cellX: 0 } }),
      tree({ projection: { phenotypeAssetVersion: 1 } }),
      tree({ projection: { creationSeason: 'winter' } }),
      tree({ projection: { visualFingerprint: 'mapping-v1:foliage-meadow-green' } }),
      tree({ ownerUserId: OTHER_OWNER_USER_ID })
    ];
    for (const invalidTree of invalidTrees) {
      const test = harness({ trees: [invalidTree] });
      await expectRegionError(test.read({ ownerUserId: OWNER_USER_ID, cells: CELLS }),
        'OWNER_REGION_UNAVAILABLE');
    }
  });

  it('rejects unsupported owner-world versions and unbounded model results', async () => {
    const unsupportedWorld = harness({ ownerWorld: world({ worldGenerationVersion: 99 }) });
    await expectRegionError(unsupportedWorld.read({ ownerUserId: OWNER_USER_ID, cells: CELLS }),
      'OWNER_REGION_UNAVAILABLE');
    expect(unsupportedWorld.ForestWritingTreeModel.find).not.toHaveBeenCalled();

    const unbounded = harness({
      trees: [tree(), tree({ writingTreeId: LATER_TREE_ID }), tree({
        writingTreeId: '44444444-4444-4444-8444-444444444444'
      })]
    });
    await expectRegionError(unbounded.read({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      limit: 1
    }), 'OWNER_REGION_UNAVAILABLE');
  });
});

import {
  buildForestOwnerRegionAssetDeliveryService,
  ForestOwnerRegionAssetDeliveryError,
  FOREST_OWNER_REGION_MAX_ASSET_REQUEST
} from '../server/services/forestOwnerRegionAssetDelivery.js';
import {
  FOREST_ASSET_TRANSPORT_RASTER,
  FOREST_ASSET_TRANSPORT_RUNS
} from '../server/services/forestSceneAssetTransport.js';
import { FOREST_RENDERER_VERSION_V3 } from '../server/services/forestTreeGeneratorV3.js';
import {
  DECIDUOUS_PHENOTYPE_ASSET_VERSION,
  DECIDUOUS_PHENOTYPE_ID
} from '../server/services/forest/v3/phenotype.js';
import {
  FOREST_RENDERER_ID,
  FOREST_TREE_ASSET_SCHEMA_VERSION,
  treeAssetCacheKey
} from '../server/services/forest/v3/treeAsset.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_USER_ID = '507f1f77bcf86cd799439012';
const TREE_ID = '22222222-2222-4222-8222-222222222222';
const CELLS = Object.freeze([{ cellX: -1, cellY: 1 }]);
const ASSET_KEY = treeAssetCacheKey({
  seed: 123456,
  rendererVersion: FOREST_RENDERER_VERSION_V3,
  phenotypeId: DECIDUOUS_PHENOTYPE_ID,
  phenotypeAssetVersion: DECIDUOUS_PHENOTYPE_ASSET_VERSION,
  meaningProjection: {
    version: 1,
    visualFingerprint: 'mapping-v1:foliage-summer-green'
  }
});

function chain(value) {
  const query = {
    limit: jasmine.createSpy('limit').and.callFake(() => query),
    lean: jasmine.createSpy('lean').and.callFake(() => query),
    exec: jasmine.createSpy('exec').and.resolveTo(value)
  };
  return query;
}

function manifest(overrides = {}) {
  return {
    manifestVersion: 1,
    status: 'ready',
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
      collisionRadius: 12,
      phenotypeId: DECIDUOUS_PHENOTYPE_ID,
      assetKey: ASSET_KEY
    }],
    page: { returnedPlacementCount: 1, nextCursor: null },
    ...overrides
  };
}

function tree(overrides = {}) {
  const base = {
    schemaVersion: 1,
    identityVersion: 1,
    writingTreeId: TREE_ID,
    ownerUserId: OWNER_USER_ID,
    sourceState: 'active',
    hiddenFromForest: false,
    projection: {
      revision: 1,
      schemaVersion: 1,
      mappingVersion: 1,
      specimenSeed: 123456,
      phenotypeId: DECIDUOUS_PHENOTYPE_ID,
      phenotypeAssetVersion: DECIDUOUS_PHENOTYPE_ASSET_VERSION,
      creationSeason: 'summer',
      foliagePaletteId: 'summer-green',
      projectionFingerprint: 'mapping-v1:foliage-summer-green:seed-123456',
      visualFingerprint: 'mapping-v1:foliage-summer-green'
    }
  };
  return {
    ...base,
    ...overrides,
    projection: { ...base.projection, ...overrides.projection }
  };
}

function harness({ manifestResult = manifest(), trees = [tree()], overrides = {} } = {}) {
  const readManifest = jasmine.createSpy('readManifest').and.resolveTo(manifestResult);
  const treeQuery = chain(trees);
  const ForestWritingTreeModel = {
    find: jasmine.createSpy('ForestWritingTree.find').and.returnValue(treeQuery)
  };
  const prepareAssets = jasmine.createSpy('prepareAssets').and.callFake(placements => ({
    assets: placements.map(placement => ({ cacheKey: placement.assetKey, layers: [] }))
  }));
  const encodeAssets = jasmine.createSpy('encodeAssets').and.callFake(async (assets, transport) => ({
    assets: assets.map(asset => ({ ...asset, transport }))
  }));
  return {
    deliver: buildForestOwnerRegionAssetDeliveryService({
      readManifest,
      ForestWritingTreeModel,
      prepareAssets,
      encodeAssets,
      ...overrides
    }),
    readManifest,
    ForestWritingTreeModel,
    treeQuery,
    prepareAssets,
    encodeAssets
  };
}

async function expectDeliveryError(promise, code) {
  try {
    await promise;
    fail(`Expected ${code}.`);
  } catch (error) {
    expect(error).toEqual(jasmine.any(ForestOwnerRegionAssetDeliveryError));
    expect(error.code).toBe(code);
  }
}

describe('forest owner region asset delivery', () => {
  it('rejects malformed identity, asset batches, and transport before regional authorization',
    async () => {
      const invalidInputs = [
        { ownerUserId: 'other', assetKeys: [ASSET_KEY] },
        { ownerUserId: OWNER_USER_ID, assetKeys: [] },
        { ownerUserId: OWNER_USER_ID, assetKeys: [ASSET_KEY, ASSET_KEY] },
        { ownerUserId: OWNER_USER_ID, assetKeys: ['invented-private-key'] },
        {
          ownerUserId: OWNER_USER_ID,
          assetKeys: Array.from({ length: FOREST_OWNER_REGION_MAX_ASSET_REQUEST + 1 },
            (_, index) => `${ASSET_KEY}:extra-${index}`)
        },
        { ownerUserId: OWNER_USER_ID, assetKeys: [ASSET_KEY], transport: 'jpeg' }
      ];
      for (const input of invalidInputs) {
        const test = harness();
        await expectDeliveryError(test.deliver({ cells: CELLS, ...input }),
          'INVALID_OWNER_REGION_ASSET_INPUT');
        expect(test.readManifest).not.toHaveBeenCalled();
        expect(test.ForestWritingTreeModel.find).not.toHaveBeenCalled();
      }
    });

  it('returns honest empty delivery states without loading projections or generating assets',
    async () => {
      for (const status of ['not-established', 'reconciling']) {
        const test = harness({
          manifestResult: manifest({ status, assetContract: undefined, placements: [] })
        });
        const result = await test.deliver({
          ownerUserId: OWNER_USER_ID,
          cells: CELLS,
          assetKeys: [ASSET_KEY],
          transport: FOREST_ASSET_TRANSPORT_RASTER
        });

        expect(result).toEqual({
          assetDeliveryVersion: 1,
          status,
          transport: FOREST_ASSET_TRANSPORT_RASTER,
          assetContract: null,
          assets: []
        });
        expect(test.ForestWritingTreeModel.find).not.toHaveBeenCalled();
        expect(test.prepareAssets).not.toHaveBeenCalled();
      }
    });

  it('reauthorizes exact regional keys and loads only their current owner projections', async () => {
    const test = harness();
    const result = await test.deliver({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      cursor: 'regional-page-cursor',
      assetKeys: [ASSET_KEY],
      transport: FOREST_ASSET_TRANSPORT_RUNS
    });

    expect(test.readManifest).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      cursor: 'regional-page-cursor',
      limit: 250
    });
    const [filter, projection] = test.ForestWritingTreeModel.find.calls.first().args;
    expect(filter).toEqual({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: { $in: [TREE_ID] },
      sourceState: 'active',
      hiddenFromForest: false
    });
    expect(projection.translationGroupId).toBeUndefined();
    expect(projection.foundingSource).toBeUndefined();
    expect(test.treeQuery.limit).toHaveBeenCalledOnceWith(1);
    const [placements, projections] = test.prepareAssets.calls.first().args;
    expect(placements).toEqual(manifest().placements);
    expect(projections.get(ASSET_KEY)).toEqual({
      schemaVersion: 1,
      mappingVersion: 1,
      specimen: { seed: 123456, source: 'stable-writing-identity' },
      phenotype: {
        id: DECIDUOUS_PHENOTYPE_ID,
        version: DECIDUOUS_PHENOTYPE_ASSET_VERSION
      },
      permanentTraits: { creationSeason: 'summer', foliagePaletteId: 'summer-green' },
      identity: {
        projectionFingerprint: 'mapping-v1:foliage-summer-green:seed-123456',
        visualFingerprint: 'mapping-v1:foliage-summer-green'
      }
    });
    expect(result).toEqual({
      assetDeliveryVersion: 1,
      status: 'ready',
      transport: FOREST_ASSET_TRANSPORT_RUNS,
      assetContract: manifest().assetContract,
      assets: [{ cacheKey: ASSET_KEY, layers: [], transport: FOREST_ASSET_TRANSPORT_RUNS }]
    });
    expect(JSON.stringify(result)).not.toContain(OWNER_USER_ID);
    expect(JSON.stringify(result)).not.toContain(TREE_ID);
    expect(result.serverPreparation).toBeUndefined();
  });

  it('rejects invented or cross-owner asset identity before reading durable projections',
    async () => {
      const otherKey = `${ASSET_KEY}:invented`;
      const test = harness();

      await expectDeliveryError(test.deliver({
        ownerUserId: OWNER_USER_ID,
        cells: CELLS,
        assetKeys: [otherKey]
      }), 'OWNER_REGION_ASSET_UNAVAILABLE');

      expect(test.ForestWritingTreeModel.find).not.toHaveBeenCalled();
      expect(test.prepareAssets).not.toHaveBeenCalled();
    });

  it('distinguishes disappeared projections from incoherent returned records', async () => {
    const disappeared = harness({ trees: [] });
    await expectDeliveryError(disappeared.deliver({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      assetKeys: [ASSET_KEY]
    }), 'OWNER_REGION_ASSET_UNAVAILABLE');
    expect(disappeared.prepareAssets).not.toHaveBeenCalled();

    for (const unsupportedTree of [
      tree({ ownerUserId: OTHER_OWNER_USER_ID }),
      tree({ sourceState: 'inactive' }),
      tree({ hiddenFromForest: true }),
      tree({ projection: { revision: 99 } })
    ]) {
      const unsupported = harness({ trees: [unsupportedTree] });
      await expectDeliveryError(unsupported.deliver({
        ownerUserId: OWNER_USER_ID,
        cells: CELLS,
        assetKeys: [ASSET_KEY]
      }), 'OWNER_REGION_ASSET_INCOHERENT');
      expect(unsupported.prepareAssets).not.toHaveBeenCalled();
    }
  });

  it('fails closed when preparation or encoding changes requested asset identity', async () => {
    const changedPreparation = harness({
      overrides: {
        prepareAssets: jasmine.createSpy('prepareAssets').and.returnValue({
          assets: [{ cacheKey: `${ASSET_KEY}:changed` }]
        })
      }
    });
    await expectDeliveryError(changedPreparation.deliver({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      assetKeys: [ASSET_KEY]
    }), 'OWNER_REGION_ASSET_INCOHERENT');

    const changedEncoding = harness({
      overrides: {
        encodeAssets: jasmine.createSpy('encodeAssets').and.resolveTo({
          assets: [{ cacheKey: `${ASSET_KEY}:changed` }]
        })
      }
    });
    await expectDeliveryError(changedEncoding.deliver({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      assetKeys: [ASSET_KEY]
    }), 'OWNER_REGION_ASSET_INCOHERENT');
  });

  it('reconstructs a real projected asset with the exact authorized cache identity', async () => {
    const test = harness({
      overrides: { prepareAssets: undefined, encodeAssets: undefined }
    });
    const deliver = buildForestOwnerRegionAssetDeliveryService({
      readManifest: test.readManifest,
      ForestWritingTreeModel: test.ForestWritingTreeModel
    });

    const result = await deliver({
      ownerUserId: OWNER_USER_ID,
      cells: CELLS,
      assetKeys: [ASSET_KEY],
      transport: FOREST_ASSET_TRANSPORT_RUNS
    });

    expect(result.status).toBe('ready');
    expect(result.assets.length).toBe(1);
    expect(result.assets[0].cacheKey).toBe(ASSET_KEY);
    expect(result.assets[0].layers.length).toBe(3);
    expect(result.assets[0].identity).toBeDefined();
    expect(JSON.stringify(result.assets[0])).not.toContain(OWNER_USER_ID);
    expect(JSON.stringify(result.assets[0])).not.toContain(TREE_ID);
  });
});

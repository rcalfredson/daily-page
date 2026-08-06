import {
  buildForestOwnerRegionAssetRouteHandler,
  buildForestOwnerRegionRouteHandler,
  privateForestApiResponse
} from '../server/api/v1/forest.js';
import {
  ForestOwnerRegionAssetDeliveryError
} from '../server/services/forestOwnerRegionAssetDelivery.js';
import {
  ForestOwnerRegionManifestError
} from '../server/services/forestOwnerRegionManifest.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_USER_ID = '507f1f77bcf86cd799439012';
const ASSET_KEY = 'tree-asset-v3:daily-page-forest-v3@4:test@1:seed-1';

function response() {
  return {
    statusCode: null,
    body: null,
    set: jasmine.createSpy('set'),
    vary: jasmine.createSpy('vary'),
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe('forest owner region API', () => {
  it('sets private no-store and cookie-vary boundaries before delivery', () => {
    const res = response();
    const next = jasmine.createSpy('next');

    privateForestApiResponse({}, res, next);

    expect(res.set).toHaveBeenCalledOnceWith('Cache-Control', 'private, no-store');
    expect(res.vary).toHaveBeenCalledOnceWith('Cookie');
    expect(next).toHaveBeenCalledOnceWith();
  });

  it('rejects missing or stale authentication before parsing or reading private state', async () => {
    const readManifest = jasmine.createSpy('readManifest');
    const handler = buildForestOwnerRegionRouteHandler({ readManifest });
    const res = response();

    await handler({ user: null, query: { cells: 'not:a-cell' } }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: 'AUTHENTICATION_REQUIRED',
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(readManifest).not.toHaveBeenCalled();
  });

  it('derives owner authority only from the session and parses canonical exact cells', async () => {
    const manifest = {
      manifestVersion: 1,
      status: 'ready',
      placements: [],
      page: { returnedPlacementCount: 0, nextCursor: null }
    };
    const readManifest = jasmine.createSpy('readManifest').and.resolveTo(manifest);
    const handler = buildForestOwnerRegionRouteHandler({ readManifest });
    const res = response();

    await handler({
      user: { id: OWNER_USER_ID },
      query: { cells: '-1:1,0:-2', cursor: 'opaque-cursor', limit: '25' },
      body: { ownerUserId: OTHER_OWNER_USER_ID }
    }, res);

    expect(readManifest).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      cells: [{ cellX: -1, cellY: 1 }, { cellX: 0, cellY: -2 }],
      cursor: 'opaque-cursor',
      limit: '25'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(manifest);
  });

  it('rejects forged owner and unsupported query fields before private reads', async () => {
    const readManifest = jasmine.createSpy('readManifest');
    const handler = buildForestOwnerRegionRouteHandler({ readManifest });
    const res = response();

    await handler({
      user: { id: OWNER_USER_ID },
      query: { cells: '0:0', ownerUserId: OTHER_OWNER_USER_ID }
    }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'INVALID_FOREST_REGION_REQUEST',
      code: 'INVALID_FOREST_REGION_REQUEST'
    });
    expect(readManifest).not.toHaveBeenCalled();
  });

  it('rejects noncanonical cells and repeated scalar query fields', async () => {
    const malformedQueries = [
      {},
      { cells: ['0:0', '1:0'] },
      { cells: '+1:0' },
      { cells: '01:0' },
      { cells: '-0:0' },
      { cells: '0:0', cursor: ['one', 'two'] },
      { cells: '0:0', limit: ['10', '20'] }
    ];
    for (const query of malformedQueries) {
      const readManifest = jasmine.createSpy('readManifest');
      const handler = buildForestOwnerRegionRouteHandler({ readManifest });
      const res = response();

      await handler({ user: { id: OWNER_USER_ID }, query }, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_FOREST_REGION_REQUEST');
      expect(readManifest).not.toHaveBeenCalled();
    }
  });

  it('maps adapter bounds failures to the same non-enumerating request error', async () => {
    const readManifest = jasmine.createSpy('readManifest').and.rejectWith(
      new ForestOwnerRegionManifestError(
        'INVALID_OWNER_REGION_INPUT',
        'Private validation detail that must not cross the route.'
      )
    );
    const handler = buildForestOwnerRegionRouteHandler({ readManifest });
    const res = response();

    await handler({ user: { id: OWNER_USER_ID }, query: { cells: '0:0' } }, res);

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('Private validation detail');
  });

  it('preserves honest not-established and reconciling manifests as successful states', async () => {
    for (const status of ['not-established', 'reconciling']) {
      const manifest = {
        manifestVersion: 1,
        status,
        placements: [],
        page: { returnedPlacementCount: 0, nextCursor: null }
      };
      const handler = buildForestOwnerRegionRouteHandler({
        readManifest: jasmine.createSpy('readManifest').and.resolveTo(manifest)
      });
      const res = response();

      await handler({ user: { id: OWNER_USER_ID }, query: { cells: '0:0' } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it('returns a generic unavailable response and logs no private error detail', async () => {
    const privateDetail = `${OWNER_USER_ID}:private-tree-title`;
    const error = new Error(privateDetail);
    const readManifest = jasmine.createSpy('readManifest').and.rejectWith(error);
    const handler = buildForestOwnerRegionRouteHandler({ readManifest });
    const res = response();
    spyOn(console, 'error');

    await handler({ user: { id: OWNER_USER_ID }, query: { cells: '0:0' } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: 'FOREST_REGION_UNAVAILABLE',
      code: 'FOREST_REGION_UNAVAILABLE'
    });
    expect(JSON.stringify(console.error.calls.allArgs())).not.toContain(privateDetail);
    expect(JSON.stringify(res.body)).not.toContain(privateDetail);
  });
});

describe('forest owner region asset API', () => {
  it('rejects missing or stale authentication before parsing or delivering assets', async () => {
    const deliverAssets = jasmine.createSpy('deliverAssets');
    const handler = buildForestOwnerRegionAssetRouteHandler({ deliverAssets });
    const res = response();

    await handler({ user: null, query: { cells: '0:0', assetKeys: ASSET_KEY } }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(deliverAssets).not.toHaveBeenCalled();
  });

  it('derives owner authority from the session and parses the bounded asset request', async () => {
    const delivery = {
      assetDeliveryVersion: 1,
      status: 'ready',
      transport: 'lossless-raster',
      assets: []
    };
    const deliverAssets = jasmine.createSpy('deliverAssets').and.resolveTo(delivery);
    const handler = buildForestOwnerRegionAssetRouteHandler({ deliverAssets });
    const res = response();

    await handler({
      user: { id: OWNER_USER_ID },
      query: {
        cells: '-1:1,0:-2',
        cursor: 'regional-page-cursor',
        assetKeys: `${ASSET_KEY},${ASSET_KEY}:second`,
        transport: 'lossless-raster'
      },
      body: { ownerUserId: OTHER_OWNER_USER_ID }
    }, res);

    expect(deliverAssets).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      cells: [{ cellX: -1, cellY: 1 }, { cellX: 0, cellY: -2 }],
      cursor: 'regional-page-cursor',
      assetKeys: [ASSET_KEY, `${ASSET_KEY}:second`],
      transport: 'lossless-raster'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(delivery);
  });

  it('rejects forged owner, malformed, and repeated asset query fields before delivery',
    async () => {
      const malformedQueries = [
        { cells: '0:0' },
        { cells: '0:0', assetKeys: [ASSET_KEY] },
        { cells: ['0:0'], assetKeys: ASSET_KEY },
        { cells: '0:0', assetKeys: ASSET_KEY, cursor: ['one', 'two'] },
        { cells: '0:0', assetKeys: ASSET_KEY, transport: ['one', 'two'] },
        { cells: '0:0', assetKeys: ASSET_KEY, ownerUserId: OTHER_OWNER_USER_ID }
      ];
      for (const query of malformedQueries) {
        const deliverAssets = jasmine.createSpy('deliverAssets');
        const handler = buildForestOwnerRegionAssetRouteHandler({ deliverAssets });
        const res = response();

        await handler({ user: { id: OWNER_USER_ID }, query }, res);

        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('INVALID_FOREST_ASSET_REQUEST');
        expect(deliverAssets).not.toHaveBeenCalled();
      }
    });

  it('maps private validation and authorization failures to generic responses', async () => {
    const privateDetail = `${OTHER_OWNER_USER_ID}:private-asset-evidence`;
    const cases = [
      {
        error: new ForestOwnerRegionAssetDeliveryError(
          'INVALID_OWNER_REGION_ASSET_INPUT', privateDetail
        ),
        status: 400,
        code: 'INVALID_FOREST_ASSET_REQUEST'
      },
      {
        error: new ForestOwnerRegionAssetDeliveryError(
          'OWNER_REGION_ASSET_UNAVAILABLE', privateDetail
        ),
        status: 404,
        code: 'FOREST_ASSETS_UNAVAILABLE'
      }
    ];
    for (const testCase of cases) {
      const handler = buildForestOwnerRegionAssetRouteHandler({
        deliverAssets: jasmine.createSpy('deliverAssets').and.rejectWith(testCase.error)
      });
      const res = response();

      await handler({
        user: { id: OWNER_USER_ID },
        query: { cells: '0:0', assetKeys: ASSET_KEY }
      }, res);

      expect(res.statusCode).toBe(testCase.status);
      expect(res.body.code).toBe(testCase.code);
      expect(JSON.stringify(res.body)).not.toContain(privateDetail);
    }
  });

  it('preserves honest not-established and reconciling delivery states', async () => {
    for (const status of ['not-established', 'reconciling']) {
      const delivery = {
        assetDeliveryVersion: 1,
        status,
        transport: 'color-runs',
        assets: []
      };
      const handler = buildForestOwnerRegionAssetRouteHandler({
        deliverAssets: jasmine.createSpy('deliverAssets').and.resolveTo(delivery)
      });
      const res = response();

      await handler({
        user: { id: OWNER_USER_ID },
        query: { cells: '0:0', assetKeys: ASSET_KEY }
      }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it('returns a generic unavailable response and logs no private error detail', async () => {
    const privateDetail = `${OWNER_USER_ID}:private-tree-title`;
    const handler = buildForestOwnerRegionAssetRouteHandler({
      deliverAssets: jasmine.createSpy('deliverAssets').and.rejectWith(new Error(privateDetail))
    });
    const res = response();
    spyOn(console, 'error');

    await handler({
      user: { id: OWNER_USER_ID },
      query: { cells: '0:0', assetKeys: ASSET_KEY }
    }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('FOREST_ASSET_DELIVERY_UNAVAILABLE');
    expect(JSON.stringify(console.error.calls.allArgs())).not.toContain(privateDetail);
    expect(JSON.stringify(res.body)).not.toContain(privateDetail);
  });
});

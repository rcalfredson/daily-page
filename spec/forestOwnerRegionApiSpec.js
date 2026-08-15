import {
  buildForestAuthoredMutationRouteHandler,
  buildForestAuthoredRegionRouteHandler,
  buildForestOwnerRegionAssetRouteHandler,
  buildForestOwnerRegionRouteHandler,
  buildForestOwnerTreeInclusionRouteHandler,
  buildForestOwnerTreeInspectionRouteHandler,
  privateForestApiResponse,
  requireForestAuthoredMutationOrigin
} from '../server/api/v1/forest.js';
import {
  ForestAuthoredMutationError
} from '../server/services/forestAuthoredObjectMutation.js';
import {
  ForestAuthoredMutationRateLimitError
} from '../server/services/forestAuthoredMutationRateLimit.js';
import {
  ForestAuthoredPlacementError
} from '../server/services/forestAuthoredPlacement.js';
import {
  ForestAuthoredRegionManifestError
} from '../server/services/forestAuthoredRegionManifest.js';
import {
  ForestOwnerRegionAssetDeliveryError
} from '../server/services/forestOwnerRegionAssetDelivery.js';
import {
  ForestOwnerRegionManifestError
} from '../server/services/forestOwnerRegionManifest.js';
import {
  ForestOwnerTreeInspectionError
} from '../server/services/forestOwnerTreeInspection.js';
import {
  ForestOwnerTreeInclusionError
} from '../server/services/forestOwnerTreeInclusion.js';

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

describe('forest owner tree inspection API', () => {
  it('rejects missing authentication before inspecting private writing', async () => {
    const inspectTree = jasmine.createSpy('inspectTree');
    const handler = buildForestOwnerTreeInspectionRouteHandler({ inspectTree });
    const res = response();

    await handler({ user: null, params: { writingTreeId: 'invalid' }, query: {} }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(inspectTree).not.toHaveBeenCalled();
  });

  it('derives owner and preferred language from authenticated request context', async () => {
    const inspection = { inspectionVersion: 1, status: 'ready' };
    const inspectTree = jasmine.createSpy('inspectTree').and.resolveTo(inspection);
    const handler = buildForestOwnerTreeInspectionRouteHandler({ inspectTree });
    const res = response();
    res.locals = { uiLang: 'es' };

    await handler({
      user: { id: OWNER_USER_ID },
      params: { writingTreeId: '22222222-2222-4222-8222-222222222222' },
      query: { cursor: 'opaque', limit: '12' },
      body: { ownerUserId: OTHER_OWNER_USER_ID }
    }, res);

    expect(inspectTree).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: '22222222-2222-4222-8222-222222222222',
      preferredContentLang: 'es',
      cursor: 'opaque',
      limit: '12'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(inspection);
  });

  it('maps malformed and unavailable trees to generic non-enumerating responses', async () => {
    const cases = [
      {
        error: new ForestOwnerTreeInspectionError(
          'INVALID_TREE_INSPECTION_INPUT', 'private invalid detail'
        ),
        status: 400,
        code: 'INVALID_FOREST_TREE_INSPECTION_REQUEST'
      },
      {
        error: new ForestOwnerTreeInspectionError(
          'TREE_INSPECTION_NOT_FOUND', 'private missing detail'
        ),
        status: 404,
        code: 'FOREST_TREE_UNAVAILABLE'
      }
    ];
    for (const testCase of cases) {
      const handler = buildForestOwnerTreeInspectionRouteHandler({
        inspectTree: jasmine.createSpy('inspectTree').and.rejectWith(testCase.error)
      });
      const res = response();

      await handler({
        user: { id: OWNER_USER_ID },
        params: { writingTreeId: '22222222-2222-4222-8222-222222222222' },
        query: {}
      }, res);

      expect(res.statusCode).toBe(testCase.status);
      expect(res.body.code).toBe(testCase.code);
      expect(JSON.stringify(res.body)).not.toContain('private');
    }
  });

  it('rejects forged query authority and logs generic unexpected failures', async () => {
    const inspectTree = jasmine.createSpy('inspectTree');
    const malformed = buildForestOwnerTreeInspectionRouteHandler({ inspectTree });
    const malformedResponse = response();

    await malformed({
      user: { id: OWNER_USER_ID },
      params: { writingTreeId: '22222222-2222-4222-8222-222222222222' },
      query: { ownerUserId: OTHER_OWNER_USER_ID }
    }, malformedResponse);

    expect(malformedResponse.statusCode).toBe(400);
    expect(inspectTree).not.toHaveBeenCalled();

    const privateDetail = `${OWNER_USER_ID}:private-inspection-title`;
    const failed = buildForestOwnerTreeInspectionRouteHandler({
      inspectTree: jasmine.createSpy('inspectTree').and.rejectWith(new Error(privateDetail))
    });
    const failedResponse = response();
    spyOn(console, 'error');

    await failed({
      user: { id: OWNER_USER_ID },
      params: { writingTreeId: '22222222-2222-4222-8222-222222222222' },
      query: {}
    }, failedResponse);

    expect(failedResponse.statusCode).toBe(503);
    expect(failedResponse.body.code).toBe('FOREST_TREE_INSPECTION_UNAVAILABLE');
    expect(JSON.stringify(console.error.calls.allArgs())).not.toContain(privateDetail);
  });
});

describe('forest owner tree inclusion API', () => {
  it('derives the owner from the session and accepts only the exact mutation body', async () => {
    const setInclusion = jasmine.createSpy('setInclusion').and.resolveTo({ outcome: 'hidden' });
    const handler = buildForestOwnerTreeInclusionRouteHandler({ setInclusion });
    const res = response();
    await handler({
      user: { id: OWNER_USER_ID },
      params: { writingTreeId: '22222222-2222-4222-8222-222222222222' },
      body: { hidden: true, expectedRevision: 4 }
    }, res);
    expect(setInclusion).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: '22222222-2222-4222-8222-222222222222',
      hidden: true,
      expectedRevision: 4
    });
    expect(res.statusCode).toBe(200);

    const malformed = response();
    await handler({
      user: { id: OWNER_USER_ID }, params: { writingTreeId: 'tree' },
      body: { hidden: true, expectedRevision: 4, ownerUserId: OTHER_OWNER_USER_ID }
    }, malformed);
    expect(malformed.statusCode).toBe(400);
    expect(setInclusion).toHaveBeenCalledTimes(1);
  });

  it('maps absence and conflicts without exposing private error details', async () => {
    for (const testCase of [
      ['TREE_INCLUSION_NOT_FOUND', 404, 'FOREST_TREE_UNAVAILABLE'],
      ['TREE_INCLUSION_CONFLICT', 409, 'FOREST_TREE_INCLUSION_CONFLICT']
    ]) {
      const handler = buildForestOwnerTreeInclusionRouteHandler({
        setInclusion: jasmine.createSpy('setInclusion').and.rejectWith(
          new ForestOwnerTreeInclusionError(testCase[0], 'private tree detail')
        )
      });
      const res = response();
      await handler({
        user: { id: OWNER_USER_ID }, params: { writingTreeId: 'tree' },
        body: { hidden: false, expectedRevision: 2 }
      }, res);
      expect(res.statusCode).toBe(testCase[1]);
      expect(res.body.code).toBe(testCase[2]);
      expect(JSON.stringify(res.body)).not.toContain('private');
    }
  });

  it('rejects unauthenticated mutation before reading its body', async () => {
    const setInclusion = jasmine.createSpy('setInclusion');
    const handler = buildForestOwnerTreeInclusionRouteHandler({ setInclusion });
    const res = response();
    await handler({ user: null, params: {}, body: null }, res);
    expect(res.statusCode).toBe(401);
    expect(setInclusion).not.toHaveBeenCalled();
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

describe('forest authored private API defenses', () => {
  function originRequest({
    origin = 'https://forest.example.test',
    host = 'forest.example.test',
    contentType = true
  } = {}) {
    return {
      protocol: 'https',
      get: jasmine.createSpy('get').and.callFake(name => ({
        origin,
        host
      })[String(name).toLowerCase()]),
      is: jasmine.createSpy('is').and.callFake(() => contentType)
    };
  }

  it('requires exact same-origin JSON before authenticated mutation work', () => {
    const accepted = originRequest();
    const acceptedResponse = response();
    const next = jasmine.createSpy('next');
    requireForestAuthoredMutationOrigin(accepted, acceptedResponse, next);
    expect(next).toHaveBeenCalledOnceWith();

    for (const request of [
      originRequest({ origin: null }),
      originRequest({ origin: 'https://other.example.test' }),
      originRequest({ origin: 'not-an-origin' })
    ]) {
      const res = response();
      const rejectedNext = jasmine.createSpy('next');
      requireForestAuthoredMutationOrigin(request, res, rejectedNext);
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FOREST_AUTHORED_MUTATION_ORIGIN_REQUIRED');
      expect(rejectedNext).not.toHaveBeenCalled();
    }

    const nonJson = response();
    requireForestAuthoredMutationOrigin(
      originRequest({ contentType: false }),
      nonJson,
      jasmine.createSpy('next')
    );
    expect(nonJson.statusCode).toBe(415);
    expect(nonJson.body.code).toBe('FOREST_AUTHORED_MUTATION_JSON_REQUIRED');
  });

  it('derives authored-region ownership from the session and parses canonical cells', async () => {
    const manifest = { manifestVersion: 1, status: 'ready', objects: [] };
    const readManifest = jasmine.createSpy('readManifest').and.resolveTo(manifest);
    const handler = buildForestAuthoredRegionRouteHandler({ readManifest });
    const res = response();

    await handler({
      user: { id: OWNER_USER_ID },
      query: { cells: '-1:1,0:-2', cursor: 'opaque', limit: '25' },
      body: { ownerUserId: OTHER_OWNER_USER_ID }
    }, res);

    expect(readManifest).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      cells: [{ cellX: -1, cellY: 1 }, { cellX: 0, cellY: -2 }],
      cursor: 'opaque',
      limit: '25'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(manifest);
  });

  it('returns the same committed marker to separate authenticated sessions for one owner',
    async () => {
      const manifest = {
        manifestVersion: 1,
        status: 'ready',
        objects: [{
          objectId: '22222222-2222-4222-8222-222222222222',
          kind: 'personal-marker',
          regionId: '0:0',
          worldX: 40,
          worldY: 0,
          recordRevision: 1
        }],
        page: { returnedObjectCount: 1, nextCursor: null }
      };
      const readManifest = jasmine.createSpy('readManifest').and.resolveTo(manifest);
      const handler = buildForestAuthoredRegionRouteHandler({ readManifest });
      const first = response();
      const second = response();

      await handler({
        user: { id: OWNER_USER_ID },
        authSession: { _id: '507f1f77bcf86cd799439091' },
        query: { cells: '0:0' }
      }, first);
      await handler({
        user: { id: OWNER_USER_ID },
        authSession: { _id: '507f1f77bcf86cd799439092' },
        query: { cells: '0:0' }
      }, second);

      expect(first.body).toEqual(second.body);
      expect(readManifest.calls.allArgs()).toEqual([
        [{ ownerUserId: OWNER_USER_ID, cells: [{ cellX: 0, cellY: 0 }], cursor: null,
          limit: undefined }],
        [{ ownerUserId: OWNER_USER_ID, cells: [{ cellX: 0, cellY: 0 }], cursor: null,
          limit: undefined }]
      ]);
    });

  it('rejects stale sessions and malformed authored-region queries before reads', async () => {
    const readManifest = jasmine.createSpy('readManifest');
    const handler = buildForestAuthoredRegionRouteHandler({ readManifest });
    const stale = response();
    await handler({ user: null, query: { cells: 'invalid' } }, stale);
    expect(stale.statusCode).toBe(401);

    for (const query of [
      {},
      { cells: '+1:0' },
      { cells: '-0:0' },
      { cells: ['0:0'] },
      { cells: '0:0', cursor: ['one', 'two'] },
      { cells: '0:0', ownerUserId: OTHER_OWNER_USER_ID }
    ]) {
      const res = response();
      await handler({ user: { id: OWNER_USER_ID }, query }, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_FOREST_AUTHORED_REGION_REQUEST');
    }
    expect(readManifest).not.toHaveBeenCalled();
  });

  it('maps changed and unsupported authored regions without private details', async () => {
    for (const testCase of [
      ['AUTHORED_REGION_CHANGED', 409, 'FOREST_AUTHORED_REGION_CHANGED'],
      ['AUTHORED_REGION_MIGRATION_REQUIRED', 409, 'FOREST_AUTHORED_MIGRATION_REQUIRED']
    ]) {
      const privateDetail = `${OTHER_OWNER_USER_ID}:private-marker`;
      const handler = buildForestAuthoredRegionRouteHandler({
        readManifest: jasmine.createSpy('readManifest').and.rejectWith(
          new ForestAuthoredRegionManifestError(testCase[0], privateDetail)
        )
      });
      const res = response();
      await handler({ user: { id: OWNER_USER_ID }, query: { cells: '0:0' } }, res);
      expect(res.statusCode).toBe(testCase[1]);
      expect(res.body.code).toBe(testCase[2]);
      expect(JSON.stringify(res.body)).not.toContain(privateDetail);
    }
  });

  it('logs only a bounded authored-region code for unavailable failures', async () => {
    const privateDetail = `${OWNER_USER_ID}:private-coordinate`;
    const handler = buildForestAuthoredRegionRouteHandler({
      readManifest: jasmine.createSpy('readManifest').and.rejectWith(
        new ForestAuthoredRegionManifestError('AUTHORED_REGION_UNAVAILABLE', privateDetail)
      )
    });
    const res = response();
    spyOn(console, 'error');

    await handler({ user: { id: OWNER_USER_ID }, query: { cells: '0:0' } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('FOREST_AUTHORED_REGION_UNAVAILABLE');
    expect(JSON.stringify(console.error.calls.allArgs())).not.toContain(privateDetail);
    expect(JSON.stringify(console.error.calls.allArgs())).toContain('AUTHORED_REGION_UNAVAILABLE');
  });
});

describe('forest authored mutation API', () => {
  const OBJECT_ID = '22222222-2222-4222-8222-222222222222';
  const AUTH_SESSION_ID = '507f1f77bcf86cd799439099';

  function request({ body, objectId = OBJECT_ID } = {}) {
    return {
      user: { id: OWNER_USER_ID },
      authSession: { _id: AUTH_SESSION_ID },
      params: { objectId },
      body
    };
  }

  it('passes exact create, move, and removal shapes with only session-derived authority',
    async () => {
      const cases = [
        {
          operation: 'create',
          body: { protocolVersion: 1, kind: 'personal-marker', worldX: -1, worldY: 2 },
          expected: {
            objectId: OBJECT_ID,
            protocolVersion: 1,
            kind: 'personal-marker',
            worldX: -1,
            worldY: 2
          }
        },
        {
          operation: 'move',
          body: { protocolVersion: 1, expectedRevision: 2, worldX: 3, worldY: -4 },
          expected: {
            objectId: OBJECT_ID,
            protocolVersion: 1,
            expectedRevision: 2,
            worldX: 3,
            worldY: -4
          }
        },
        {
          operation: 'remove',
          body: { protocolVersion: 1, expectedRevision: 3 },
          expected: { objectId: OBJECT_ID, protocolVersion: 1, expectedRevision: 3 }
        }
      ];
      for (const testCase of cases) {
        const result = { protocolVersion: 1, outcome: 'accepted', object: null };
        const mutate = jasmine.createSpy('mutate').and.resolveTo(result);
        const enforceRateLimit = jasmine.createSpy('enforceRateLimit');
        const handler = buildForestAuthoredMutationRouteHandler({
          operation: testCase.operation,
          mutate,
          enforceRateLimit
        });
        const res = response();

        await handler(request({
          body: { ...testCase.body, ownerUserId: OTHER_OWNER_USER_ID }
        }), res);
        expect(res.statusCode).toBe(400);
        expect(mutate).not.toHaveBeenCalled();
        expect(enforceRateLimit).not.toHaveBeenCalled();

        const accepted = response();
        await handler(request({ body: testCase.body }), accepted);
        expect(enforceRateLimit).toHaveBeenCalledOnceWith({
          ownerUserId: OWNER_USER_ID,
          authSessionId: AUTH_SESSION_ID
        });
        expect(mutate).toHaveBeenCalledOnceWith({
          ownerUserId: OWNER_USER_ID,
          ...testCase.expected
        });
        expect(accepted.statusCode).toBe(200);
        expect(accepted.body).toBe(result);
      }
    });

  it('rejects missing or stale auth and invalid public shape before rate or mutation work',
    async () => {
      const mutate = jasmine.createSpy('mutate');
      const enforceRateLimit = jasmine.createSpy('enforceRateLimit');
      const handler = buildForestAuthoredMutationRouteHandler({
        operation: 'create', mutate, enforceRateLimit
      });
      for (const req of [
        { user: null, authSession: null, params: {}, body: null },
        {
          user: { id: OWNER_USER_ID },
          authSession: null,
          params: { objectId: OBJECT_ID },
          body: { protocolVersion: 1, kind: 'personal-marker', worldX: 0, worldY: 0 }
        }
      ]) {
        const res = response();
        await handler(req, res);
        expect(res.statusCode).toBe(401);
      }
      for (const req of [
        request({ body: { protocolVersion: 1, kind: 'personal-marker', worldX: 0 } }),
        request({
          body: { protocolVersion: 2, kind: 'personal-marker', worldX: 0, worldY: 0 }
        }),
        request({
          objectId: 'invalid',
          body: { protocolVersion: 1, kind: 'personal-marker', worldX: 0, worldY: 0 }
        })
      ]) {
        const res = response();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
      }
      expect(enforceRateLimit).not.toHaveBeenCalled();
      expect(mutate).not.toHaveBeenCalled();
    });

  it('maps owner and session rate limits with Retry-After', async () => {
    const handler = buildForestAuthoredMutationRouteHandler({
      operation: 'remove',
      mutate: jasmine.createSpy('mutate'),
      enforceRateLimit: jasmine.createSpy('enforceRateLimit').and.throwError(
        new ForestAuthoredMutationRateLimitError('AUTHORED_MUTATION_RATE_LIMITED', 17)
      )
    });
    const res = response();

    await handler(request({ body: { protocolVersion: 1, expectedRevision: 1 } }), res);

    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('FOREST_AUTHORED_MUTATION_RATE_LIMITED');
    expect(res.set).toHaveBeenCalledWith('Retry-After', '17');
  });

  it('maps conflicts, absence, collision, density, migration, and reset to bounded codes',
    async () => {
      const safeObject = { objectId: OBJECT_ID, recordRevision: 2 };
      const cases = [
        [
          new ForestAuthoredMutationError(
            'AUTHORED_OBJECT_CONFLICT', 'private', safeObject
          ),
          409,
          'FOREST_AUTHORED_OBJECT_CONFLICT',
          safeObject
        ],
        [
          new ForestAuthoredMutationError('AUTHORED_OBJECT_NOT_FOUND', 'private'),
          404,
          'FOREST_AUTHORED_OBJECT_UNAVAILABLE'
        ],
        [
          new ForestAuthoredPlacementError('AUTHORED_PLACEMENT_COLLISION', 'private'),
          409,
          'FOREST_AUTHORED_PLACEMENT_COLLISION'
        ],
        [
          new ForestAuthoredPlacementError('AUTHORED_PLACEMENT_DENSITY', 'private'),
          409,
          'FOREST_AUTHORED_PLACEMENT_DENSITY'
        ],
        [
          new ForestAuthoredMutationError('AUTHORED_MIGRATION_REQUIRED', 'private'),
          409,
          'FOREST_AUTHORED_MIGRATION_REQUIRED'
        ],
        [
          new ForestAuthoredMutationError('AUTHORED_RESETTING', 'private'),
          409,
          'FOREST_AUTHORED_RESETTING'
        ]
      ];
      for (const [error, status, code, currentObject] of cases) {
        const handler = buildForestAuthoredMutationRouteHandler({
          operation: 'move',
          mutate: jasmine.createSpy('mutate').and.rejectWith(error),
          enforceRateLimit: jasmine.createSpy('enforceRateLimit')
        });
        const res = response();
        await handler(request({
          body: { protocolVersion: 1, expectedRevision: 1, worldX: 0, worldY: 0 }
        }), res);
        expect(res.statusCode).toBe(status);
        expect(res.body.code).toBe(code);
        expect(res.body.object).toBe(currentObject);
        expect(JSON.stringify(res.body)).not.toContain('private');
      }
    });

  it('returns generic unavailable and logs no unexpected private detail', async () => {
    const privateDetail = `${OWNER_USER_ID}:${OBJECT_ID}:private-coordinate`;
    const handler = buildForestAuthoredMutationRouteHandler({
      operation: 'remove',
      mutate: jasmine.createSpy('mutate').and.rejectWith(new Error(privateDetail)),
      enforceRateLimit: jasmine.createSpy('enforceRateLimit')
    });
    const res = response();
    spyOn(console, 'error');

    await handler(request({ body: { protocolVersion: 1, expectedRevision: 1 } }), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('FOREST_AUTHORED_MUTATION_UNAVAILABLE');
    expect(JSON.stringify(console.error.calls.allArgs())).not.toContain(privateDetail);
  });
});

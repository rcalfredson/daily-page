import {
  buildForestOwnerSceneBootstrapService,
  ForestOwnerSceneBootstrapError
} from '../server/services/forestOwnerSceneBootstrap.js';
import pug from 'pug';
import { buildForestRouteHandler } from '../server/routes/forest.js';
import { isLocalizedPath } from '../server/services/localizedPaths.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_USER_ID = '507f1f77bcf86cd799439012';
const FOREST_ID = '11111111-1111-4111-8111-111111111111';
const WORLD_SEED = 'abcdefghijklmnopqrstuvwxyzABCDEF';

function chain(value) {
  return {
    lean() { return this; },
    exec: jasmine.createSpy('exec').and.resolveTo(value)
  };
}

function world(overrides = {}) {
  return {
    schemaVersion: 1,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    worldRole: 'primary',
    status: 'active',
    worldSeed: WORLD_SEED,
    placementPolicyVersion: 1,
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1,
    reconciliation: { state: 'idle' },
    ...overrides
  };
}

function harness(ownerWorld = world()) {
  const ForestOwnerWorldModel = {
    findOne: jasmine.createSpy('ForestOwnerWorld.findOne').and.returnValue(chain(ownerWorld))
  };
  return {
    read: buildForestOwnerSceneBootstrapService({ ForestOwnerWorldModel }),
    ForestOwnerWorldModel
  };
}

function response() {
  return {
    locals: { t: key => key },
    statusCode: null,
    view: null,
    model: null,
    status(code) { this.statusCode = code; return this; },
    render(view, model) { this.view = view; this.model = model; return this; }
  };
}

describe('forest owner scene bootstrap', () => {
  it('returns an honest bounded empty bootstrap before a world exists', async () => {
    const test = harness(null);
    const result = await test.read({ ownerUserId: OWNER_USER_ID });

    expect(result.status).toBe('not-established');
    expect(result.environment).toBeNull();
    expect(result.delivery.initialCells.length).toBe(9);
    expect(result.delivery.assetBatchSize).toBe(24);
    expect(result.spatialIndex).toEqual({ version: 1, cellSize: 720 });
  });

  it('does not expose a partial scene while owner reconciliation is running', async () => {
    const test = harness(world({ reconciliation: { state: 'running', phase: 'owner-blocks' } }));
    const result = await test.read({ ownerUserId: OWNER_USER_ID });

    expect(result.status).toBe('reconciling');
    expect(result.environment).toBeNull();
  });

  it('returns only versioned signed-world presentation bootstrap identity', async () => {
    const test = harness();
    const result = await test.read({ ownerUserId: OWNER_USER_ID });

    expect(result.status).toBe('ready');
    expect(result.spawn).toEqual({
      worldX: 0, worldY: 0, radius: 11, movementSpeed: 108, interactionRadius: 48
    });
    expect(result.environment).toEqual({
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1,
      groundPresentationVersion: 2,
      grammarId: 'owner-grove-patchwork-v1',
      seed: WORLD_SEED
    });
    expect(result.delivery).toEqual(jasmine.objectContaining({
      regionPath: '/api/v1/forest/regions',
      assetPath: '/api/v1/forest/assets',
      inspectionPath: '/api/v1/forest/trees',
      authoredRegionPath: '/api/v1/forest/authored-regions',
      authoredObjectPath: '/api/v1/forest/authored-objects',
      placementPageSize: 100,
      authoredPageSize: 100,
      authoredMutationProtocolVersion: 1,
      assetBatchSize: 24,
      transport: 'lossless-raster'
    }));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(OWNER_USER_ID);
    expect(serialized).not.toContain(FOREST_ID);
  });

  it('fails closed on malformed owner or unsupported world identity', async () => {
    const invalidOwner = harness();
    await expectAsync(invalidOwner.read({ ownerUserId: 'other' }))
      .toBeRejectedWithError(ForestOwnerSceneBootstrapError, /ownerUserId/);
    expect(invalidOwner.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();

    const unsupported = harness(world({ worldGenerationVersion: 99 }));
    await expectAsync(unsupported.read({ ownerUserId: OWNER_USER_ID }))
      .toBeRejectedWithError(ForestOwnerSceneBootstrapError, /unsupported/);
  });
});

describe('forest production route', () => {
  it('renders semantic placement, synchronization, and marker-management controls', () => {
    const html = pug.renderFile('views/forest/index.pug', {
      t: key => key,
      uiPath: path => path,
      uiPathFor: (_lang, path) => path,
      forestStatus: 'ready',
      bootstrap: { status: 'ready' },
      user: { id: OWNER_USER_ID, username: 'forest-owner' },
      title: 'Forest',
      description: 'Forest',
      uiLang: 'en',
      uiDir: 'ltr',
      unprefixedPath: '/forest'
    });

    for (const attribute of [
      'data-owner-forest-place-marker',
      'data-owner-forest-authored-status',
      'data-owner-forest-placement',
      'data-owner-forest-marker-inspection',
      'data-owner-forest-marker-remove-confirm'
    ]) expect(html).toContain(attribute);
    expect(html).toContain('class="owner-forest__status-stack"');
    expect(html).toContain('class="owner-forest__hud-actions"');
    expect(html).toContain('forestScene.markers.place');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="dialog"');
  });

  it('participates in localized routing and derives owner only from the session', async () => {
    expect(isLocalizedPath('/forest')).toBeTrue();
    const bootstrap = { status: 'ready' };
    const readBootstrap = jasmine.createSpy('readBootstrap').and.resolveTo(bootstrap);
    const handler = buildForestRouteHandler({ readBootstrap });
    const req = {
      user: { id: OWNER_USER_ID },
      query: { ownerUserId: OTHER_OWNER_USER_ID }
    };
    const res = response();

    await handler(req, res);

    expect(readBootstrap).toHaveBeenCalledOnceWith({ ownerUserId: OWNER_USER_ID });
    expect(res.statusCode).toBe(200);
    expect(res.view).toBe('forest/index');
    expect(res.model.bootstrap).toBe(bootstrap);
  });

  it('renders generic unavailable state without logging private error details', async () => {
    const privateDetail = `${OWNER_USER_ID}:private-world-seed`;
    const handler = buildForestRouteHandler({
      readBootstrap: jasmine.createSpy('readBootstrap').and.rejectWith(new Error(privateDetail))
    });
    const res = response();
    spyOn(console, 'error');

    await handler({ user: { id: OWNER_USER_ID } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.model.forestStatus).toBe('unavailable');
    expect(res.model.bootstrap).toBeNull();
    expect(JSON.stringify(console.error.calls.allArgs())).not.toContain(privateDetail);
  });
});

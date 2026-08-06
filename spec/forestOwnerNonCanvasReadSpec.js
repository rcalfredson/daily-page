import {
  buildForestOwnerNonCanvasReadService,
  decodeForestOwnerNonCanvasCursor,
  ForestOwnerNonCanvasReadError
} from '../server/services/forestOwnerNonCanvasRead.js';
import {
  buildForestWritingRouteHandler,
  privateForestResponse
} from '../server/routes/forestWriting.js';
import { isLocalizedPath } from '../server/services/localizedPaths.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_USER_ID = '507f1f77bcf86cd799439012';
const GROUP_ID = '507f191e810c19729de860ea';
const BLOCK_ID = '507f1f77bcf86cd799439013';
const PREFERRED_BLOCK_ID = '507f1f77bcf86cd799439014';
const FOREST_ID = '11111111-1111-4111-8111-111111111111';
const TREE_ID = '22222222-2222-4222-8222-222222222222';

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
    reconciliation: { state: 'idle' },
    ...overrides
  };
}

function tree(overrides = {}) {
  return {
    schemaVersion: 1,
    identityVersion: 1,
    writingTreeId: TREE_ID,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    translationGroupId: GROUP_ID,
    sourceState: 'active',
    hiddenFromForest: false,
    foundingSource: {
      blockId: BLOCK_ID,
      createdAt: new Date('2025-03-10T10:00:00.000Z')
    },
    placement: { slot: 7, worldX: -120, worldY: 340 },
    projection: {
      phenotypeId: 'open-crown-deciduous',
      phenotypeAssetVersion: 1,
      creationSeason: 'spring',
      foliagePaletteId: 'spring-green'
    },
    ...overrides
  };
}

function block(overrides = {}) {
  return {
    _id: BLOCK_ID,
    userId: OWNER_USER_ID,
    authorshipState: 'live',
    groupId: GROUP_ID,
    lang: 'en',
    status: 'locked',
    visibility: 'public',
    createdAt: new Date('2025-03-10T10:00:00.000Z'),
    roomId: 'general',
    title: 'A walk under old branches',
    ...overrides
  };
}

function harness({
  ownerWorld = world(),
  trees = [tree()],
  preferred = [],
  founding = [block()],
  earliest = [block()]
} = {}) {
  const worldQuery = chain(ownerWorld);
  const treeQuery = chain(trees);
  const preferredQuery = chain(preferred);
  const foundingQuery = chain(founding);
  const ForestOwnerWorldModel = {
    findOne: jasmine.createSpy('ForestOwnerWorld.findOne').and.returnValue(worldQuery)
  };
  const ForestWritingTreeModel = {
    find: jasmine.createSpy('ForestWritingTree.find').and.returnValue(treeQuery)
  };
  const BlockModel = {
    find: jasmine.createSpy('Block.find').and.returnValues(preferredQuery, foundingQuery),
    aggregate: jasmine.createSpy('Block.aggregate').and.resolveTo(earliest)
  };
  return {
    list: buildForestOwnerNonCanvasReadService({
      ForestOwnerWorldModel,
      ForestWritingTreeModel,
      BlockModel
    }),
    ForestOwnerWorldModel,
    ForestWritingTreeModel,
    BlockModel,
    treeQuery
  };
}

describe('forest owner non-canvas read', () => {
  it('returns an honest empty state before an owner world is established', async () => {
    const test = harness({ ownerWorld: null });

    const result = await test.list({ ownerUserId: OWNER_USER_ID });

    expect(result.status).toBe('not-established');
    expect(result.trees).toEqual([]);
    expect(test.ForestWritingTreeModel.find).not.toHaveBeenCalled();
  });

  it('does not present a running reconciliation as a complete forest', async () => {
    const test = harness({
      ownerWorld: world({ reconciliation: { state: 'running', phase: 'owner-blocks' } })
    });

    const result = await test.list({ ownerUserId: OWNER_USER_ID });

    expect(result.status).toBe('reconciling');
    expect(result.trees).toEqual([]);
    expect(test.ForestWritingTreeModel.find).not.toHaveBeenCalled();
  });

  it('selects current preferred owner writing without exposing ledger evidence', async () => {
    const preferredBlock = block({
      _id: PREFERRED_BLOCK_ID,
      lang: 'es',
      title: 'Un paseo bajo ramas antiguas',
      createdAt: new Date('2025-04-12T09:00:00.000Z')
    });
    const test = harness({ preferred: [preferredBlock] });

    const result = await test.list({
      ownerUserId: OWNER_USER_ID,
      preferredContentLang: 'es'
    });

    expect(result.status).toBe('ready');
    expect(result.trees).toEqual([{
      writingTreeId: TREE_ID,
      placement: { worldX: -120, worldY: 340 },
      projection: {
        phenotypeId: 'open-crown-deciduous',
        phenotypeAssetVersion: 1,
        creationSeason: 'spring',
        foliagePaletteId: 'spring-green'
      },
      writing: {
        title: 'Un paseo bajo ramas antiguas',
        roomId: 'general',
        lang: 'es',
        status: 'locked',
        visibility: 'public',
        createdAt: '2025-04-12T09:00:00.000Z',
        path: `/rooms/general/blocks/${PREFERRED_BLOCK_ID}`
      },
      displayReason: 'preferred-owner-language'
    }]);
    expect(test.ForestOwnerWorldModel.findOne).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      worldRole: 'primary'
    });
    const [treeFilter] = test.ForestWritingTreeModel.find.calls.first().args;
    expect(treeFilter).toEqual(jasmine.objectContaining({
      ownerUserId: OWNER_USER_ID,
      forestId: FOREST_ID,
      sourceState: 'active',
      hiddenFromForest: false
    }));
    expect(test.BlockModel.find.calls.allArgs().every(([filter]) => (
      filter.userId === OWNER_USER_ID
    ))).toBeTrue();
    expect(JSON.stringify(result)).not.toContain(GROUP_ID);
    expect(JSON.stringify(result)).not.toContain(OTHER_OWNER_USER_ID);
  });

  it('omits a ledger tree when no current owner writing remains eligible', async () => {
    const test = harness({ preferred: [], founding: [], earliest: [] });

    const result = await test.list({ ownerUserId: OWNER_USER_ID });

    expect(result.trees).toEqual([]);
    expect(result.page.omittedUnavailableCount).toBe(1);
  });

  it('uses a bounded opaque placement cursor without silently truncating', async () => {
    const extra = tree({
      writingTreeId: '33333333-3333-4333-8333-333333333333',
      translationGroupId: '507f191e810c19729de860eb',
      foundingSource: {
        blockId: '507f1f77bcf86cd799439015',
        createdAt: new Date('2025-05-01T00:00:00.000Z')
      },
      placement: { slot: 8, worldX: 80, worldY: 420 }
    });
    const test = harness({ trees: [tree(), extra] });

    const result = await test.list({ ownerUserId: OWNER_USER_ID, limit: 1 });
    const cursor = decodeForestOwnerNonCanvasCursor(result.page.nextCursor);

    expect(cursor.direction).toBe('after');
    expect(cursor.anchorPlacementSlot).toBe(7);
    expect(cursor.anchorWritingTreeId).toBe(TREE_ID);
    expect(result.page.previousCursor).toBeNull();
    expect(test.treeQuery.limit).toHaveBeenCalledOnceWith(2);
  });

  it('uses reverse keyset ordering to return to an earlier page', async () => {
    const initial = harness({
      trees: [tree(), tree({
        writingTreeId: '33333333-3333-4333-8333-333333333333',
        translationGroupId: '507f191e810c19729de860eb',
        foundingSource: {
          blockId: '507f1f77bcf86cd799439015',
          createdAt: new Date('2025-05-01T00:00:00.000Z')
        },
        placement: { slot: 8, worldX: 80, worldY: 420 }
      })]
    });
    const firstPage = await initial.list({ ownerUserId: OWNER_USER_ID, limit: 1 });
    const forward = firstPage.page.nextCursor;
    const later = harness();

    const laterPage = await later.list({
      ownerUserId: OWNER_USER_ID,
      cursor: forward,
      limit: 1
    });
    const backward = decodeForestOwnerNonCanvasCursor(laterPage.page.previousCursor);

    expect(backward).toEqual({
      version: 2,
      direction: 'before',
      anchorPlacementSlot: 7,
      anchorWritingTreeId: TREE_ID
    });
    expect(later.ForestWritingTreeModel.find.calls.first().args[0].$or).toEqual([
      { 'placement.slot': { $gt: 7 } },
      { 'placement.slot': 7, writingTreeId: { $gt: TREE_ID } }
    ]);

    const earlier = harness();
    const earlierPage = await earlier.list({
      ownerUserId: OWNER_USER_ID,
      cursor: laterPage.page.previousCursor,
      limit: 1
    });

    expect(earlier.treeQuery.sort).toHaveBeenCalledOnceWith({
      'placement.slot': -1,
      writingTreeId: -1
    });
    expect(earlier.ForestWritingTreeModel.find.calls.first().args[0].$or).toEqual([
      { 'placement.slot': { $lt: 7 } },
      { 'placement.slot': 7, writingTreeId: { $lt: TREE_ID } }
    ]);
    expect(earlierPage.page.previousCursor).toBeNull();
    expect(decodeForestOwnerNonCanvasCursor(earlierPage.page.nextCursor).direction).toBe('after');
  });

  it('rejects malformed cursors before querying private state', async () => {
    const test = harness();

    await expectAsync(test.list({
      ownerUserId: OWNER_USER_ID,
      cursor: 'not-a-cursor'
    })).toBeRejectedWith(jasmine.objectContaining({
      name: 'ForestOwnerNonCanvasReadError',
      code: 'INVALID_FOREST_READ_INPUT'
    }));
    expect(test.ForestOwnerWorldModel.findOne).not.toHaveBeenCalled();
  });

  it('fails closed on unsupported tree records', async () => {
    const test = harness({ trees: [tree({ schemaVersion: 2 })] });

    await expectAsync(test.list({ ownerUserId: OWNER_USER_ID }))
      .toBeRejectedWithError(ForestOwnerNonCanvasReadError, /unsupported state/);
    expect(test.BlockModel.find).not.toHaveBeenCalled();
  });
});

describe('forest writing route', () => {
  function response() {
    const res = {
      locals: {
        uiLang: 'en',
        t: key => key
      },
      set: jasmine.createSpy('set'),
      vary: jasmine.createSpy('vary'),
      status: jasmine.createSpy('status').and.callFake(() => res),
      render: jasmine.createSpy('render').and.callFake(() => res)
    };
    return res;
  }

  it('sets private cache boundaries for every forest response', () => {
    const res = response();
    const next = jasmine.createSpy('next');

    privateForestResponse({}, res, next);

    expect(res.set).toHaveBeenCalledOnceWith('Cache-Control', 'private, no-store');
    expect(res.vary).toHaveBeenCalledOnceWith('Cookie');
    expect(next).toHaveBeenCalled();
  });

  it('participates in localized HTML routing', () => {
    expect(isLocalizedPath('/forest/writing')).toBeTrue();
  });

  it('derives the owner only from the authenticated session', async () => {
    const result = {
      status: 'ready',
      trees: [],
      page: { omittedUnavailableCount: 0, previousCursor: null, nextCursor: null }
    };
    const listWritingTrees = jasmine.createSpy('listWritingTrees').and.resolveTo(result);
    const handler = buildForestWritingRouteHandler({ listWritingTrees });
    const req = {
      user: { id: OWNER_USER_ID, username: 'owner' },
      query: { ownerUserId: OTHER_OWNER_USER_ID }
    };
    const res = response();

    await handler(req, res);

    expect(listWritingTrees).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      preferredContentLang: 'en',
      cursor: null
    });
    expect(res.status).toHaveBeenCalledOnceWith(200);
    expect(res.render.calls.first().args[0]).toBe('forest/writing');
  });

  it('turns durable tree identity into localized, user-facing card context', async () => {
    const listWritingTrees = jasmine.createSpy('listWritingTrees').and.resolveTo({
      status: 'ready',
      trees: [{
        writingTreeId: TREE_ID,
        projection: {
          phenotypeId: 'sunset-lanternwood',
          creationSeason: 'autumn'
        },
        writing: {
          title: 'Un paseo bajo ramas antiguas',
          roomId: 'general',
          lang: 'es',
          createdAt: '2025-04-12T09:00:00.000Z',
          path: `/rooms/general/blocks/${PREFERRED_BLOCK_ID}`
        }
      }],
      page: { omittedUnavailableCount: 0, previousCursor: null, nextCursor: null }
    });
    const loadRoomMetadata = jasmine.createSpy('loadRoomMetadata').and.resolveTo({
      displayName: 'The Common Room'
    });
    const handler = buildForestWritingRouteHandler({ listWritingTrees, loadRoomMetadata });
    const req = {
      user: { id: OWNER_USER_ID, username: 'owner' },
      query: {}
    };
    const res = response();

    await handler(req, res);

    const view = res.render.calls.first().args[1];
    expect(loadRoomMetadata).toHaveBeenCalledOnceWith('general', 'en');
    expect(view.trees[0]).toEqual(jasmine.objectContaining({
      treeTypeLabel: 'forestWriting.treeTypes.lanternwood',
      treeTypeClass: 'lanternwood',
      seasonLabel: 'forestWriting.seasons.autumn'
    }));
    expect(view.trees[0].writing).toEqual(jasmine.objectContaining({
      roomName: 'The Common Room',
      languageName: 'Spanish',
      showLanguage: true,
      formattedCreatedAt: 'Apr 12, 2025'
    }));
  });
});

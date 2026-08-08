import {
  buildForestOwnerTreeInspectionService,
  ForestOwnerTreeInspectionError,
} from '../server/services/forestOwnerTreeInspection.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_USER_ID = '507f1f77bcf86cd799439012';
const GROUP_ID = '507f191e810c19729de860ea';
const BLOCK_ID = '507f1f77bcf86cd799439013';
const PREFERRED_BLOCK_ID = '507f1f77bcf86cd799439014';
const FOREIGN_BLOCK_ID = '507f1f77bcf86cd799439015';
const HIDDEN_BLOCK_ID = '507f1f77bcf86cd799439016';
const FOREST_ID = '11111111-1111-4111-8111-111111111111';
const TREE_ID = '22222222-2222-4222-8222-222222222222';

function chain(value) {
  const query = {
    sort: jasmine.createSpy('sort').and.callFake(() => query),
    limit: jasmine.createSpy('limit').and.callFake(() => query),
    lean: jasmine.createSpy('lean').and.callFake(() => query),
    exec: jasmine.createSpy('exec').and.resolveTo(value),
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
    ...overrides,
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
    recordRevision: 4,
    foundingSource: {
      blockId: BLOCK_ID,
      createdAt: new Date('2025-03-10T10:00:00.000Z'),
    },
    projection: {
      revision: 1,
      schemaVersion: 1,
      mappingVersion: 1,
      specimenSeed: 123456,
      phenotypeId: 'open-crown-deciduous',
      phenotypeAssetVersion: 2,
      creationSeason: 'spring',
      foliagePaletteId: 'meadow-green',
      projectionFingerprint: 'mapping-v1:fixture-projection',
      visualFingerprint: 'mapping-v1:foliage-meadow-green',
    },
    ...overrides,
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
    ...overrides,
  };
}

function harness({
  ownerWorld = world(),
  writingTree = tree(),
  preferred = [],
  founding = [block()],
  earliest = [block()],
  translations = [block()],
} = {}) {
  const ForestOwnerWorldModel = {
    findOne: jasmine.createSpy('ForestOwnerWorld.findOne').and.returnValue(chain(ownerWorld)),
  };
  const ForestWritingTreeModel = {
    findOne: jasmine.createSpy('ForestWritingTree.findOne').and.returnValue(chain(writingTree)),
  };
  const BlockModel = {
    find: jasmine.createSpy('Block.find').and.returnValues(
      chain(preferred),
      chain(founding),
      chain(earliest),
      chain(translations),
    ),
  };
  return {
    inspect: buildForestOwnerTreeInspectionService({
      ForestOwnerWorldModel,
      ForestWritingTreeModel,
      BlockModel,
    }),
    ForestOwnerWorldModel,
    ForestWritingTreeModel,
    BlockModel,
  };
}

describe('forest owner tree inspection', () => {
  it('reauthorizes the live owner tree and chooses current preferred owner writing', async () => {
    const preferred = block({
      _id: PREFERRED_BLOCK_ID,
      lang: 'es',
      title: 'Un paseo bajo ramas antiguas',
      createdAt: new Date('2025-04-12T09:00:00.000Z'),
    });
    const foreign = block({
      _id: FOREIGN_BLOCK_ID,
      userId: OTHER_OWNER_USER_ID,
      lang: 'fr',
      title: 'Une promenade sous les vieilles branches',
    });
    const retained = block({
      _id: HIDDEN_BLOCK_ID,
      userId: undefined,
      authorshipState: 'deleted-author',
      lang: 'de',
      title: 'Ein Spaziergang unter alten Zweigen',
    });
    const test = harness({
      preferred: [preferred],
      translations: [block(), preferred, foreign, retained],
    });

    const result = await test.inspect({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: TREE_ID,
      preferredContentLang: 'es',
    });

    expect(result.status).toBe('ready');
    expect(result.tree).toEqual({
      id: TREE_ID,
      phenotypeId: 'open-crown-deciduous',
      creationSeason: 'spring',
      recordRevision: 4,
    });
    expect(result.writing).toEqual({
      title: 'Un paseo bajo ramas antiguas',
      lang: 'es',
      createdAt: '2025-04-12T09:00:00.000Z',
      path: `/rooms/general/blocks/${PREFERRED_BLOCK_ID}`,
    });
    expect(result.translations.map(({ lang, ownerAuthored }) => ({ lang, ownerAuthored })))
      .toEqual([
        { lang: 'en', ownerAuthored: true },
        { lang: 'es', ownerAuthored: true },
        { lang: 'fr', ownerAuthored: false },
        { lang: 'de', ownerAuthored: false },
      ]);
    expect(JSON.stringify(result)).not.toContain(GROUP_ID);
    expect(JSON.stringify(result)).not.toContain(OWNER_USER_ID);
    expect(test.ForestWritingTreeModel.findOne).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      forestId: FOREST_ID,
      writingTreeId: TREE_ID,
      sourceState: 'active',
      hiddenFromForest: false,
    }, jasmine.any(Object));
  });

  it('omits currently hidden foreign translations without changing owner display selection',
    async () => {
      const hidden = block({
        _id: FOREIGN_BLOCK_ID,
        userId: OTHER_OWNER_USER_ID,
        lang: 'fr',
        visibility: 'unlisted',
        status: 'in-progress',
      });
      const test = harness({ translations: [block(), hidden] });

      const result = await test.inspect({
        ownerUserId: OWNER_USER_ID,
        writingTreeId: TREE_ID,
      });

      expect(result.writing.title).toBe('A walk under old branches');
      expect(result.translations.map(translation => translation.lang)).toEqual(['en']);
    });

  it('returns an honest reconciling state without reading a partial tree', async () => {
    const test = harness({
      ownerWorld: world({ reconciliation: { state: 'running', phase: 'owner-blocks' } }),
    });

    const result = await test.inspect({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: TREE_ID,
    });

    expect(result.status).toBe('reconciling');
    expect(result.tree).toBeNull();
    expect(test.ForestWritingTreeModel.findOne).not.toHaveBeenCalled();
  });

  it('uses an owner-scoped tree lookup and does not disclose unavailable identities', async () => {
    const test = harness({ writingTree: null });

    await expectAsync(test.inspect({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: TREE_ID,
    })).toBeRejectedWithError(ForestOwnerTreeInspectionError, /unavailable/);

    expect(test.ForestWritingTreeModel.findOne.calls.first().args[0].ownerUserId)
      .toBe(OWNER_USER_ID);
  });

  it('paginates raw group evidence with a cursor bound to the selected tree', async () => {
    const later = block({
      _id: PREFERRED_BLOCK_ID,
      lang: 'es',
      title: 'Un paseo bajo ramas antiguas',
    });
    const test = harness({ translations: [block(), later] });
    const first = await test.inspect({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: TREE_ID,
      limit: 1,
    });

    expect(first.translations).toHaveSize(1);
    expect(first.page.nextCursor).toEqual(jasmine.any(String));

    const nextTest = harness({ translations: [later] });
    const second = await nextTest.inspect({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: TREE_ID,
      cursor: first.page.nextCursor,
      limit: 1,
    });
    const translationFilter = nextTest.BlockModel.find.calls.argsFor(3)[0];

    expect(second.status).toBe('ready');
    expect(String(translationFilter._id.$gt)).toBe(BLOCK_ID);
    await expectAsync(nextTest.inspect({
      ownerUserId: OWNER_USER_ID,
      writingTreeId: '33333333-3333-4333-8333-333333333333',
      cursor: first.page.nextCursor,
    })).toBeRejectedWithError(ForestOwnerTreeInspectionError, /cursor/);
  });
});

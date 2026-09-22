import {
  buildReadingTrailPostContext,
  buildReadingTrailReadService
} from '../server/db/readingTrailService.js';

function query(result) {
  const chain = {
    sort: jasmine.createSpy('sort').and.callFake(() => chain),
    select: jasmine.createSpy('select').and.callFake(() => chain),
    lean: jasmine.createSpy('lean').and.resolveTo(result)
  };
  return chain;
}

function trail(overrides = {}) {
  return {
    _id: 'trail-1',
    slug: 'a-short-trail',
    status: 'published',
    sourceLanguage: 'en',
    publishedLocales: ['en'],
    title_i18n: { en: 'A short trail' },
    description_i18n: { en: 'Two readings.' },
    coverGroupId: 'group-2',
    items: [
      { groupId: 'group-1', note_i18n: { en: 'Begin.' } },
      { groupId: 'group-2', note_i18n: { en: 'Continue.' } }
    ],
    ...overrides
  };
}

function post(groupId, roomId, overrides = {}) {
  return {
    _id: `${groupId}-en`,
    groupId,
    lang: 'en',
    title: `Post ${groupId}`,
    description: `Description ${groupId}`,
    roomId,
    creator: 'writer',
    status: 'locked',
    visibility: 'public',
    bannerImage: { kind: 'image', url: `https://example.com/${groupId}.jpg` },
    ...overrides
  };
}

function harness({ trails = [trail()], posts = [post('group-1', 'physics'), post('group-2', 'history')] } = {}) {
  const ReadingTrailModel = {
    find: jasmine.createSpy('find').and.callFake(() => query(trails)),
    findOne: jasmine.createSpy('findOne').and.callFake(() => query(trails[0] || null))
  };
  const BlockModel = {
    find: jasmine.createSpy('find').and.callFake(() => query(posts))
  };
  const getRooms = jasmine.createSpy('getRooms').and.resolveTo({
    physics: { displayName: 'Physics' },
    history: { displayName: 'History' }
  });
  return {
    service: buildReadingTrailReadService({ ReadingTrailModel, BlockModel, getRooms }),
    ReadingTrailModel,
    BlockModel,
    getRooms
  };
}

describe('reading trail read service', () => {
  it('hydrates ordered localized stops, room totals, and the configured cover', async () => {
    const { service, ReadingTrailModel, BlockModel, getRooms } = harness();
    const trails = await service.listPublicReadingTrails({ locale: 'en' });

    expect(ReadingTrailModel.find).toHaveBeenCalledWith({
      status: 'published', publishedLocales: 'en'
    });
    expect(BlockModel.find).toHaveBeenCalledWith({
      status: 'locked',
      visibility: 'public',
      $or: [
        { groupId: { $in: ['group-1', 'group-2'] }, lang: { $in: ['en'] } },
        { groupId: { $in: ['group-2'] } }
      ]
    });
    expect(getRooms).toHaveBeenCalledWith(['physics', 'history'], 'en');
    expect(trails).toHaveSize(1);
    expect(trails[0]).toEqual(jasmine.objectContaining({
      title: 'A short trail', readingCount: 2, roomCount: 2
    }));
    expect(trails[0].items.map(item => item.position)).toEqual([1, 2]);
    expect(trails[0].items[0].note).toBe('Begin.');
    expect(trails[0].coverPost.groupId).toBe('group-2');
  });

  it('uses a banner from an independent cover post without adding a trail stop', async () => {
    const externalCoverTrail = trail({ coverGroupId: 'stories-index' });
    const posts = [
      post('group-1', 'physics'),
      post('group-2', 'history'),
      post('stories-index', 'portraits-in-words', {
        _id: 'stories-index-ja',
        lang: 'ja',
        sourceLanguage: 'ja',
        title: 'Stories index',
        bannerImage: { kind: 'image', url: 'https://example.com/stories.jpg' }
      })
    ];
    const { service } = harness({ trails: [externalCoverTrail], posts });
    const [result] = await service.listPublicReadingTrails({ locale: 'en' });

    expect(result.items.map(item => item.groupId)).toEqual(['group-1', 'group-2']);
    expect(result.coverPost).toEqual(jasmine.objectContaining({
      groupId: 'stories-index',
      lang: 'ja',
      bannerImage: jasmine.objectContaining({ url: 'https://example.com/stories.jpg' })
    }));
  });

  it('prefers trail-owned cover art without querying another post family', async () => {
    const intrinsicCoverTrail = trail({
      coverGroupId: undefined,
      coverImage: {
        url: 'https://images.example.com/trail.png',
        caption_i18n: { en: 'A trail-specific cover.' }
      }
    });
    const { service, BlockModel } = harness({ trails: [intrinsicCoverTrail] });
    const [result] = await service.listPublicReadingTrails({ locale: 'en' });

    expect(BlockModel.find).toHaveBeenCalledWith(jasmine.objectContaining({
      $or: [
        { groupId: { $in: ['group-1', 'group-2'] }, lang: { $in: ['en'] } }
      ]
    }));
    expect(result.coverPost).toEqual(jasmine.objectContaining({
      id: null,
      groupId: null,
      title: 'A short trail',
      bannerImage: {
        kind: 'image',
        url: 'https://images.example.com/trail.png',
        caption: 'A trail-specific cover.'
      }
    }));
  });

  it('suppresses a trail at runtime when any exact-language stop is unavailable', async () => {
    const { service } = harness({ posts: [post('group-1', 'physics')] });
    expect(await service.listPublicReadingTrails({ locale: 'en' })).toEqual([]);
  });

  it('never returns a published source-language fallback for another locale', async () => {
    const spanishTrail = trail({
      publishedLocales: ['en', 'es'],
      title_i18n: { en: 'A short trail', es: 'Un sendero corto' },
      description_i18n: { en: 'Two readings.', es: 'Dos lecturas.' },
      items: [
        { groupId: 'group-1', note_i18n: { en: 'Begin.', es: 'Empieza.' } },
        { groupId: 'group-2', note_i18n: { en: 'Continue.', es: 'Continúa.' } }
      ]
    });
    const { service } = harness({ trails: [spanishTrail] });

    expect(await service.getPublicReadingTrail({ slug: 'A-SHORT-TRAIL', locale: 'es' }))
      .toBeNull();
  });

  it('reports only runtime-ready declared locales on a detail result', async () => {
    const bilingual = trail({
      publishedLocales: ['en', 'es'],
      title_i18n: { en: 'A short trail', es: 'Un sendero corto' },
      description_i18n: { en: 'Two readings.', es: 'Dos lecturas.' },
      items: [{ groupId: 'group-1' }, { groupId: 'group-2' }]
    });
    const posts = [
      post('group-1', 'physics'),
      post('group-2', 'history'),
      post('group-1', 'physics', { _id: 'group-1-es', lang: 'es' })
    ];
    const { service } = harness({ trails: [bilingual], posts });
    const result = await service.getPublicReadingTrail({ slug: bilingual.slug, locale: 'en' });

    expect(result.availableLocales).toEqual(['en']);
  });

  it('builds previous and next navigation from the concrete locale edition', () => {
    const subject = trail();
    const hydrated = {
      ...subject,
      title: 'A short trail',
      items: [
        { groupId: 'group-1', post: { id: 'post-1', roomId: 'physics', title: 'First' } },
        { groupId: 'group-2', post: { id: 'post-2', roomId: 'history', title: 'Second' } },
        { groupId: 'group-3', post: { id: 'post-3', roomId: 'fiction', title: 'Third' } }
      ]
    };
    const context = buildReadingTrailPostContext(hydrated, {
      _id: 'post-2', groupId: 'group-2'
    });

    expect(context).toEqual({
      slug: 'a-short-trail',
      title: 'A short trail',
      position: 2,
      total: 3,
      overviewPath: '/trails/a-short-trail',
      previous: {
        title: 'First',
        path: '/rooms/physics/blocks/post-1?trail=a-short-trail'
      },
      next: {
        title: 'Third',
        path: '/rooms/fiction/blocks/post-3?trail=a-short-trail'
      },
      isFirst: false,
      isLast: false
    });
  });

  it('rejects another concrete translation even when its family belongs to the trail', () => {
    const hydrated = {
      ...trail(),
      title: 'A short trail',
      items: [{
        groupId: 'group-1',
        post: { id: 'english-post', roomId: 'physics', title: 'English reading' }
      }]
    };

    expect(buildReadingTrailPostContext(hydrated, {
      _id: 'spanish-post', groupId: 'group-1'
    })).toBeNull();
  });
});

import { resolveSeo } from '../server/services/seoPolicy.js';
import { meaningfulRoomLocales, roomDiscoveryStatsPipeline, roomSeoFacts } from '../server/db/roomSeoService.js';
import { PUBLIC_BLOCK_VISIBILITY_MATCH } from '../server/services/blockVisibility.js';

const baseUrl = 'https://dailypage.org';
const article = { _id: 'abc', roomId: 'science', groupId: 'family', lang: 'en', visibility: 'public', status: 'locked' };
const path = '/rooms/science/blocks/abc';
const seo = options => resolveSeo({ baseUrl, path, ...options });

describe('central indexing policy', () => {
  for (const [label, changes] of [
    ['original', {}], ['translation', { lang: 'nl', originalBlock: 'source' }],
    ['public in-progress', { status: 'in-progress' }],
    ['locked unlisted', { visibility: 'unlisted', status: 'locked' }]
  ]) {
    it(`keeps ${label} articles indexable`, () => {
      const result = seo({ block: { ...article, ...changes } });
      expect(result.indexable).toBeTrue();
      expect(result.sitemapEligible).toBeTrue();
      expect(result.canonicalUrl).toBe(baseUrl + path);
    });
  }

  it('excludes nonpublic articles without changing access rules', () => {
    for (const visibility of ['unlisted', 'private', undefined]) {
      const result = seo({ block: { ...article, visibility, status: 'in-progress' } });
      expect(result.indexable).toBeFalse();
      expect(result.sitemapEligible).toBeFalse();
      expect(result.canonicalUrl).toBeNull();
      expect(result.hreflang).toEqual([]);
    }
  });

  for (const path of [
    '/tags', '/tags/something', '/archive', '/archive/best-of', '/archive/2026/10/14',
    '/rooms/science/archive', '/rooms/science/archive/best-of', '/rooms/science/index',
    '/2024/10', '/login', '/signup', '/verify-email', '/forgot-password', '/reset-password',
    '/search', '/dashboard/security', '/forest/writing', '/quests/review', '/quests/one/leaderboard',
    '/rooms/science/blocks/new', '/rooms/science/blocks/abc/edit', '/random-writer',
    '/users/anonymous', '/music/meta/song', '/music/meta/artist/example'
  ]) {
    it(`excludes ${path} while retaining follow`, () => {
      const result = seo({ path });
      expect(result.robots).toBe('noindex, follow');
      expect(result.canonicalUrl).toBeNull();
      expect(result.hreflang).toEqual([]);
      expect(result.sitemapEligible).toBeFalse();
    });
  }

  it('counts public families using the existing discovery predicate', () => {
    const pipeline = roomDiscoveryStatsPipeline();
    expect(pipeline[0]).toEqual({ $match: PUBLIC_BLOCK_VISIBILITY_MATCH });
    expect(pipeline[1].$group._id).toEqual({ roomId: '$roomId', family: { $ifNull: ['$groupId', '$_id'] } });
    expect(pipeline[2].$group.postCount).toEqual({ $sum: 1 });
  });

  it('applies the same global room threshold in every locale', () => {
    const room = { _id: 'science' };
    for (const locale of ['en', 'nl', 'ja']) {
      const options = { path: '/rooms/science', locale, room };
      expect(seo({ ...options, roomStats: { postCount: 9, availableLocales: ['en', 'nl', 'ja'] } }).indexable).toBeFalse();
      expect(seo({ ...options, roomStats: { postCount: 10, availableLocales: ['en', 'nl', 'ja'] } }).indexable).toBeTrue();
      expect(seo({ ...options, roomStats: { postCount: 11, availableLocales: ['en', 'nl', 'ja'] } }).sitemapEligible).toBeTrue();
    }
    expect(seo({ path: '/rooms/missing', roomStats: { postCount: 10, availableLocales: ['en', 'nl', 'ja'] } }).indexable).toBeFalse();
  });

  it('requires actual room metadata and a public post language for alternates', () => {
    const room = {
      _id: 'science', name: 'Science', description: 'Source introduction',
      name_i18n: new Map([['nl', 'Wetenschap'], ['ja', 'Science']]),
      description_i18n: new Map([['nl', 'Introduction']])
    };
    expect(meaningfulRoomLocales(room, ['en', 'nl', 'ja', 'fr'])).toEqual(['en', 'nl']);
    const roomStats = roomSeoFacts(room, { science: { postCount: 10, languages: ['en', 'nl', 'ja'] } });
    const options = { path: '/rooms/science', room, roomStats };
    expect(seo({ ...options, locale: 'nl' }).hreflang.map(alt => alt.lang)).toEqual(['en', 'nl', 'x-default']);
    expect(seo({ ...options, locale: 'ja' }).hreflang).toEqual([]);
    expect(seo({ ...options, roomStats: { ...roomStats, postCount: 9 } }).hreflang).toEqual([]);
  });

  it('uses only genuine article variants, with reciprocal concrete URLs', () => {
    const translated = { ...article, _id: 'def', roomId: 'other-room', lang: 'nl' };
    const translations = [article, translated, translated];
    const originalSeo = seo({ block: article, translations });
    const translatedSeo = seo({ block: translated, translations });
    expect(originalSeo.hreflang).toEqual(translatedSeo.hreflang);
    expect(originalSeo.hreflang).toContain({ lang: 'nl', href: `${baseUrl}/rooms/other-room/blocks/def` });
    expect(originalSeo.hreflang).toHaveSize(3);
  });

  it('does not turn UI selection into a content translation', () => {
    const result = seo({ block: article, locale: 'nl', query: { ui: 'nl', trail: 'guide', commentId: 'comment' }, translations: [article] });
    expect(result.canonicalUrl).toBe(baseUrl + path);
    expect(result.hreflang.some(alt => alt.lang === 'nl')).toBeFalse();
  });

  it('preserves substantive pagination and filtering on indexable lists', () => {
    const result = seo({ path: '/quests/reading', locale: 'nl', query: { page: '2', view: 'items', state: 'open', q: 'heat & light', ui: 'en', utm_source: 'mail' } });
    expect(result.canonicalUrl).toBe(`${baseUrl}/nl/quests/reading?page=2&view=items&state=open&q=heat+%26+light`);
    expect(seo({ path: '/quests', query: { page: '1' } }).canonicalUrl).toBe(`${baseUrl}/en/quests`);
    expect(seo({ path: '/users/author/blocks', query: { page: '2', sort: 'title', dir: 'asc' } }).canonicalUrl)
      .toBe(`${baseUrl}/en/users/author/blocks?page=2&sort=title&dir=asc`);
  });

  it('preserves localized homes and eligible trail editions', () => {
    expect(seo({ path: '/', locale: 'nl', availableLocales: ['en', 'nl'] }).canonicalUrl).toBe(`${baseUrl}/nl/`);
    const trail = { availableLocales: ['en', 'nl'], sourceLanguage: 'en' };
    expect(seo({ path: '/trails/guide', locale: 'nl', trail }).indexable).toBeTrue();
    expect(seo({ path: '/trails/guide', locale: 'ja', trail }).indexable).toBeFalse();
  });

  it('preserves legacy writing but excludes legacy listings and error responses', () => {
    expect(seo({ path: '/rooms/overview/2024-10-14', legacyHasWriting: true }).indexable).toBeTrue();
    expect(seo({ path: '/rooms/science/2024-10-14', legacyHasWriting: true }).indexable).toBeTrue();
    expect(seo({ path: '/rooms/science/2024-10-14', legacyHasWriting: false }).indexable).toBeFalse();
    expect(seo({ path: '/2024/10' }).indexable).toBeFalse();
    for (const status of [404, 403, 500]) expect(seo({ block: article, status }).indexable).toBeFalse();
  });

  it('preserves reviewed public families classified as other', () => {
    for (const path of [
      '/about', '/support', '/privacy', '/rooms', '/trails', '/quests', '/quests/a-project',
      '/users/an-author', '/users/an-author/blocks', '/users/anonymous-writer',
      '/random', '/baseball', '/baseball/one-note', '/music', '/artist', '/album',
      '/artist/an-artist', '/iPod/1g', '/audio/recording.wav'
    ]) {
      const result = seo({ path });
      expect(result.family).toBe('other');
      expect(result.indexable).toBeTrue();
    }
  });
});

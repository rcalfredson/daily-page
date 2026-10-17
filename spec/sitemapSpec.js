import { JSDOM } from 'jsdom';
import { buildSitemapEntries, renderSitemap } from '../server/services/sitemap.js';
import { resolveSeo } from '../server/services/seoPolicy.js';
import { createSeoRouter } from '../server/routes/seo.js';
import { inject } from './support/inject.js';
import express from 'express';

const baseUrl = 'https://dailypage.org';
const original = { _id: '0123456789abcdef01234567', groupId: 'group', roomId: 'science', lang: 'en', visibility: 'public', status: 'in-progress', updatedAt: '2026-10-14T12:00:00Z' };
const translation = { ...original, _id: 'abcdef0123456789abcdef01', lang: 'nl', originalBlock: original._id };

describe('policy-driven sitemap', () => {
  it('includes eligible editions, excludes inaccessible records and subthreshold rooms', () => {
    const rooms = [
      { _id: 'science', name: 'Science', description: 'An introduction' },
      { _id: 'small', name: 'Small', description: 'An introduction' }
    ];
    const resources = {
      baseUrl,
      blocks: [original, translation, { ...original, _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', visibility: 'unlisted', status: 'locked' },
        { ...original, _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', visibility: 'unlisted', status: 'in-progress' },
        { ...original, _id: 'cccccccccccccccccccccccc', visibility: 'private' }],
      rooms,
      roomStats: { science: { postCount: 10, languages: ['en'] }, small: { postCount: 9, languages: ['en'] } },
      trails: [
        { locale: 'en', trail: { slug: 'guide', availableLocales: ['en'], sourceLanguage: 'en' } },
        { locale: 'nl', trail: { slug: 'guide', availableLocales: ['en'], sourceLanguage: 'en' } }
      ]
    };
    const entries = buildSitemapEntries(resources);
    const urls = entries.map(entry => entry.loc);
    for (const id of [original._id, translation._id, 'aaaaaaaaaaaaaaaaaaaaaaaa']) expect(urls).toContain(`${baseUrl}/rooms/science/blocks/${id}`);
    for (const id of ['bbbbbbbbbbbbbbbbbbbbbbbb', 'cccccccccccccccccccccccc']) expect(urls).not.toContain(`${baseUrl}/rooms/science/blocks/${id}`);
    expect(urls).toContain(`${baseUrl}/en/rooms/science`);
    expect(urls).not.toContain(`${baseUrl}/nl/rooms/science`);
    expect(urls).not.toContain(`${baseUrl}/en/rooms/small`);
    expect(urls).toContain(`${baseUrl}/en/trails/guide`);
    expect(urls).not.toContain(`${baseUrl}/nl/trails/guide`);
    expect(urls).toContain(`${baseUrl}/nl/`);
    expect(urls.every(url => !url.includes('?') && !/\/(tags|archive|login|search)(\/|$)/.test(url))).toBeTrue();
    for (const block of resources.blocks) {
      const result = resolveSeo({ baseUrl, path: `/rooms/${block.roomId}/blocks/${block._id}`, block });
      expect(urls.includes(`${baseUrl}/rooms/${block.roomId}/blocks/${block._id}`)).toBe(result.sitemapEligible);
    }
    const xml = renderSitemap(entries);
    const document = new JSDOM(xml, { contentType: 'application/xml' }).window.document;
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.querySelectorAll('url')).toHaveSize(entries.length);
    expect([...document.querySelectorAll('lastmod')].every(node => node.textContent === '2026-10-14T12:00:00.000Z')).toBeTrue();
  });

  it('escapes XML and deduplicates canonical URLs', () => {
    const entries = buildSitemapEntries({ baseUrl, blocks: [original, original], rooms: [{ _id: 'science' }] });
    expect(entries.filter(entry => entry.loc.endsWith('/blocks/' + original._id))).toHaveSize(1);
    const xml = renderSitemap([{ loc: baseUrl + '/example?a=1&b=<test>' }]);
    expect(xml).toContain('&amp;b=&lt;test&gt;');
    expect(new JSDOM(xml, { contentType: 'application/xml' }).window.document.querySelector('loc').textContent)
      .toBe(baseUrl + '/example?a=1&b=<test>');
  });

  it('does not infer directory editions from UI support, while retaining localized homes', () => {
    const trail = { slug: 'guide', availableLocales: ['en'], sourceLanguage: 'en' };
    const entries = buildSitemapEntries({ baseUrl, trails: [
      { locale: 'en', trail }, { locale: 'nl', trail }
    ] });
    const urls = entries.map(entry => entry.loc);
    expect(urls).toContain(baseUrl + '/en/trails');
    expect(urls).not.toContain(baseUrl + '/nl/trails');
    expect(urls.some(url => url.endsWith('/quests'))).toBeFalse();
    expect(urls).toContain(baseUrl + '/nl/');
    expect(buildSitemapEntries({ baseUrl }).some(entry => /\/trails$/.test(entry.loc))).toBeFalse();
    expect(resolveSeo({ path: '/trails', locale: 'nl' }).indexable).toBeTrue();
    expect(resolveSeo({ path: '/quests', locale: 'nl' }).indexable).toBeTrue();
    expect(resolveSeo({ path: '/trails', directoryHasContent: false }).sitemapEligible).toBeFalse();
    expect(resolveSeo({ path: '/trails', directoryHasContent: true }).sitemapEligible).toBeTrue();
    expect(resolveSeo({ path: '/quests' }).sitemapEligible).toBeFalse();
  });

  it('excludes missing-room articles and IDs that the actual article router cannot serve', () => {
    const orphan = { ...original, _id: 'dddddddddddddddddddddddd', roomId: 'deleted-room' };
    const malformed = { ...original, _id: 'not-a-mongo-id' };
    const entries = buildSitemapEntries({ baseUrl, blocks: [original, orphan, malformed], rooms: [{ _id: 'science' }] });
    expect(entries.map(entry => entry.loc).filter(url => url.includes('/blocks/')))
      .toEqual([`${baseUrl}/rooms/science/blocks/${original._id}`]);
    expect(buildSitemapEntries({ baseUrl, blocks: [original] }).some(entry => entry.loc.includes('/blocks/'))).toBeFalse();
    expect(resolveSeo({ path: `/rooms/deleted-room/blocks/${orphan._id}`, block: orphan, roomExists: false }).sitemapEligible).toBeFalse();
  });

  it('returns 503 if resource loading fails instead of serving a partial sitemap', async () => {
    const app = express();
    app.use((req, res, next) => { res.locals.baseUrl = baseUrl; next(); });
    app.use(createSeoRouter({
      loadResources: async () => { throw new Error('Unavailable'); },
      getCached: async (key, load) => load()
    }));
    spyOn(console, 'error');
    const response = await inject(app, '/sitemap.xml');
    expect(response.status).toBe(503);
    expect(response.body).not.toContain('<urlset');
  });
});

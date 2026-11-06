import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { JSDOM } from 'jsdom';

import { forestWritingPostPath, forestMarkerWritingPostPath } from '../public/js/forest-writing-navigation.js';
import { forestWritingReturn } from '../server/middleware/forestWritingReturn.js';
import { uiPrefixAndLangContext } from '../server/middleware/uiPrefix.js';
import { addSeoLocals } from '../server/middleware/seo.js';
import { resolveBlockLangParam } from '../server/middleware/resolveBlockLangParam.js';
import { buildForestWritingRouteHandler, privateForestResponse } from '../server/routes/forestWriting.js';
import { initI18n, getTranslatorRuntime } from '../server/services/i18n.js';
import { SUPPORTED_UI_LANGS } from '../server/services/localeContext.js';
import { canonicalBlockPath } from '../server/utils/canonical.js';
import { inject } from './support/inject.js';

const OWNER = '507f1f77bcf86cd799439011';
const TREE = '22222222-2222-4222-8222-222222222222';
const POST = {
  _id: '507f1f77bcf86cd799439013',
  roomId: 'general',
  title: 'A remembered walk',
  contentHTML: '<p>The writing remains readable.</p>',
  lang: 'en',
  visibility: 'public',
  status: 'locked',
  createdAt: new Date('2026-04-10T10:00:00Z'),
  tags: []
};
const PATH = canonicalBlockPath(POST);

// Exercise the real context middleware, localization, SEO, forest writing handler and full
// templates without requiring authentication credentials or reading a database. Authentication
// and post reads here are explicit test fixtures; their policies have separate production specs.
function application({ authenticated = true } = {}) {
  const app = express();
  app.set('views', `${process.cwd()}/views`);
  app.set('view engine', 'pug');
  app.use(cookieParser());
  app.use(uiPrefixAndLangContext);
  app.use(addSeoLocals);
  app.use(initI18n(['layout', 'nav', 'notifications', 'blockView', 'forestWriting']));
  app.use((req, res, next) => {
    req.user = authenticated ? { id: OWNER, username: 'forest-owner' } : null;
    res.locals.query = req.query;
    next();
  });
  app.get('/forest/writing', privateForestResponse, buildForestWritingRouteHandler({
    loadRoomMetadata: async () => ({ displayName: 'Common room' }),
    listMarked: async () => ({ status: 'ready', markers: [
      { object: { objectId: TREE, schemaVersion: 2, recordRevision: 4 }, writingState: 'ready', writing: { ...POST, path: PATH } },
      { object: { objectId: '33333333-3333-4333-8333-333333333333', schemaVersion: 2, recordRevision: 2 }, writingState: 'unavailable' }
    ], page: { nextCursor: 'next-marked-page' } }),
    listWritingTrees: async () => ({
      status: 'ready',
      trees: [{
        writingTreeId: '22222222-2222-4222-8222-222222222222',
        projection: { phenotypeId: 'open-crown-deciduous', creationSeason: 'spring' },
        inclusion: { hidden: false, recordRevision: 1 },
        writing: { ...POST, path: PATH }
      }],
      page: { omittedUnavailableCount: 0, previousCursor: null, nextCursor: null }
    })
  }));
  app.get('/rooms/:room_id/blocks/:block_id',
    resolveBlockLangParam({
      loadBlock: async () => POST,
      getTranslation: async () => ({ ...POST, lang: 'es' }),
      canonicalPathForBlock: canonicalBlockPath
    }),
    forestWritingReturn,
    (req, res) => res.render('rooms/block-view', {
      block: POST,
      translations: [POST],
      title: POST.title,
      description: 'Writing from the forest',
      room_id: 'general',
      roomName: 'Common room',
      lang: 'en',
      user: req.user,
      authorProfile: null,
      editorialContext: null,
      trailContext: null,
      recommendations: { related: [], elsewhere: [] },
      comments: [],
      commentsTotal: 0,
      commentsTopLevelTotal: 0,
      commentsFocusedThread: null,
      commentsDeepLinkCommentId: null,
      commentsSortDir: 'asc',
      canManageBlock: false,
      canMutateBlock: false,
      questSubmissions: [],
      reactionCounts: {},
      userReactions: []
    })
  );
  return app;
}

function document(response) {
  expect(response.status).toBe(200);
  return new JSDOM(response.body).window.document;
}

describe('forest writing read and return', () => {
  it('carries localized return context from both semantic writing links to the full post', async () => {
    const app = application();
    const listing = await inject(app, '/es/forest/writing');
    const cards = document(listing);
    const links = [...cards.querySelectorAll('.forest-writing__card h2 a, .forest-writing__open')];
    expect(links.length).toBe(2);
    for (const link of links) expect(link.getAttribute('href')).toBe(`/es${PATH}?from=forest&returnTree=${TREE}`);

    const post = await inject(app, links[0].getAttribute('href'));
    const page = document(post);
    const returns = [...page.querySelectorAll('.block-forest-return a')];
    expect(returns.length).toBe(2);
    for (const link of returns) {
      expect(link.getAttribute('href')).toBe(`/es/forest?returnTree=${TREE}`);
      expect(link.textContent).toContain('Volver al bosque');
      expect(link.getAttribute('target')).toBeNull();
    }
    expect(page.querySelector('.block-content').textContent).toContain('The writing remains readable.');
    expect(post.headers['cache-control']).toBe('private, no-store');
    expect(post.headers.vary).toContain('Cookie');
    expect(page.querySelector('link[rel="canonical"]').href).toBe(`http://dailypage.org${PATH}`);
  });

  it('accepts the same return context used by canvas inspection and its translation links', async () => {
    const response = await inject(application(), `/en${forestWritingPostPath(PATH)}`);
    expect(document(response).querySelector('.block-forest-return a').getAttribute('href'))
      .toBe('/en/forest');
  });

  it('preserves return context when resolving the post language selector', async () => {
    const app = application();
    const redirect = await inject(app, `/es${PATH}?from=forest&returnTree=${TREE}&lang=es`);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe(`${PATH}?from=forest&returnTree=${TREE}`);
    const page = document(await inject(app, redirect.headers.location, { headers: { cookie: 'ui=es' } }));
    expect(page.querySelector('.block-forest-return a').getAttribute('href')).toBe(`/es/forest?returnTree=${TREE}`);
  });

  it('does not show a personal forest return action to an unauthenticated visitor', async () => {
    const response = await inject(application({ authenticated: false }), `${PATH}?from=forest`);
    const page = document(response);
    expect(page.querySelector('.block-forest-return')).toBeNull();
    expect(page.querySelector('.block-content').textContent).toContain('The writing remains readable.');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('Cookie');
  });

  it('leaves ordinary post visits free of forest context', async () => {
    const response = await inject(application(), PATH);
    expect(document(response).querySelector('.block-forest-return')).toBeNull();
    expect(response.headers['cache-control']).toBeUndefined();
  });

  for (const query of ['from=https://example.com', 'from=//example.com', 'from=forest&from=forest', 'from[place]=forest']) {
    it(`ignores unsupported return context: ${query}`, async () => {
      const response = await inject(application(), `${PATH}?${query}`);
      expect(document(response).querySelector('.block-forest-return')).toBeNull();
    });
  }

  it('never uses a supplied return URL as the forest destination', async () => {
    const response = await inject(application(), `${PATH}?from=forest&returnTo=https://example.com`);
    expect(document(response).querySelector('.block-forest-return a').getAttribute('href')).toBe('/en/forest');
  });

  for (const suffix of ['returnTree=bad', 'returnTree=https://example.com',
    `returnTree=${TREE}&returnTree=${TREE}`, 'returnTree[value]=bad']) {
    it(`falls back to the fixed entrance for malformed tree context: ${suffix}`, async () => {
      const response = await inject(application(), `${PATH}?from=forest&${suffix}`);
      expect(document(response).querySelector('.block-forest-return a').getAttribute('href')).toBe('/en/forest');
    });
  }

  it('provides a translated return action in every supported UI language', async () => {
    for (const lang of SUPPORTED_UI_LANGS) {
      const t = await getTranslatorRuntime(lang, ['blockView']);
      const label = t('blockView.forestReturn');
      expect(label).toBeTruthy();
      expect(label).not.toBe('blockView.forestReturn');
      if (lang !== 'en') expect(label).not.toBe('Return to forest');
    }
  });
  it('renders marked rows including unavailable writing, localized visit/read paths and pagination', async () => {
    const result = await inject(application(), '/es/forest/writing?view=marked');
    const page = document(result);
    expect(page.querySelectorAll('.forest-writing__tree').length).toBe(2);
    const links = [...page.querySelectorAll('.forest-writing__tree a')].map(link => link.getAttribute('href'));
    expect(links).toContain(`/es/forest?returnMarker=${TREE}`);
    expect(links).toContain(`/es${PATH}?from=forest&returnMarker=${TREE}`);
    expect(page.querySelector('.forest-writing__next').getAttribute('href'))
      .toBe('/es/forest/writing?view=marked&cursor=next-marked-page');
    const unavailable = page.querySelectorAll('.forest-writing__tree')[1];
    expect(unavailable.querySelectorAll('a').length).toBe(1);
    expect(unavailable.querySelector('[data-forest-marker-removal]').dataset.recordRevision).toBe('2');
    expect(result.headers['cache-control']).toBe('private, no-store');
  });

  it('carries marker context through post language redirects and falls back for conflicting locators', async () => {
    const app = application();
    const path = forestMarkerWritingPostPath(PATH, TREE);
    const redirect = await inject(app, `/es${path}&lang=es`);
    expect(redirect.headers.location).toBe(`${PATH}?from=forest&returnMarker=${TREE}`);
    const page = document(await inject(app, redirect.headers.location));
    expect(page.querySelector('.block-forest-return a').getAttribute('href')).toBe(`/en/forest?returnMarker=${TREE}`);
    for (const suffix of [`returnMarker=${TREE}&returnTree=${TREE}`, 'returnMarker=bad',
      `returnMarker=${TREE}&returnMarker=${TREE}`, 'returnMarker[value]=bad']) {
      const conflict = document(await inject(app, `${PATH}?from=forest&${suffix}`));
      expect(conflict.querySelector('.block-forest-return a').getAttribute('href')).toBe('/en/forest');
    }
  });

  it('removes a listed marker with a revision-protected request and restores keyboard focus', async () => {
    const result = await inject(application(), '/en/forest/writing?view=marked');
    const dom = new JSDOM(result.body, { runScripts: 'outside-only' });
    const { window } = dom;
    window.confirm = () => true;
    window.fetch = jasmine.createSpy('fetch').and.resolveTo({ ok: true });
    window.eval(fs.readFileSync('public/js/forest-marked-writing.js', 'utf8'));
    const button = window.document.querySelector('[data-forest-marker-removal]');
    button.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const [path, request] = window.fetch.calls.first().args;
    expect(path).toBe(`/api/v1/forest/authored-objects/${TREE}/removal`);
    expect(JSON.parse(request.body)).toEqual({ protocolVersion: 2, expectedRevision: 4 });
    expect(request.credentials).toBe('same-origin');
    expect(window.document.querySelectorAll('.forest-writing__tree').length).toBe(1);
    expect(window.document.activeElement.getAttribute('href')).toContain('returnMarker=33333333');
    dom.window.close();
  });

});

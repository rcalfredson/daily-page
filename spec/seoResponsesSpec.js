import express from 'express';
import cookieParser from 'cookie-parser';
import { JSDOM } from 'jsdom';
import { inject } from './support/inject.js';
import { uiPrefixAndLangContext } from '../server/middleware/uiPrefix.js';
import { normalizeHtmlUrl, validateSeoUrl, validArchiveDate } from '../server/middleware/seoUrlNormalization.js';
import { makePrefixRedirectMiddleware } from '../server/middleware/prefixRedirect.js';
import { isLocalizedPath } from '../server/services/localizedPaths.js';
import { addSeoLocals } from '../server/middleware/seo.js';
import { initI18n } from '../server/services/i18n.js';
import loginRouter from '../server/routes/login.js';
import usersRouter from '../server/routes/users.js';
import { createSeoRouter } from '../server/routes/seo.js';

const id = '0123456789abcdef01234567';
const original = { _id: id, roomId: 'science', groupId: 'family', visibility: 'public', status: 'in-progress', lang: 'en', content: 'Original writing' };
const translated = { ...original, _id: 'abcdef0123456789abcdef01', lang: 'nl', content: 'Vertaalde tekst' };
const testRoom = { _id: 'science' };

function application({ blocks = [original, translated], roomCount = 10, sitemapResources = {}, configure = () => {} } = {}) {
  const app = express();
  app.set('views', [process.cwd() + '/views', process.cwd() + '/spec/fixtures']);
  app.set('view engine', 'pug');
  app.use(cookieParser());
  app.use(uiPrefixAndLangContext);
  app.use(normalizeHtmlUrl);
  app.use(validateSeoUrl);
  app.use(makePrefixRedirectMiddleware({ isLocalizedPath }));
  app.use(addSeoLocals);
  app.use(initI18n(['layout', 'nav', 'notifications']));
  configure(app);
  app.use(loginRouter);
  app.use(createSeoRouter({ loadResources: async () => sitemapResources, getCached: async (key, load) => load() }));
  app.get('/posts/:group', (req, res) => res.redirect(302, `/rooms/science/blocks/${id}`));
  app.get('/rooms/:room/blocks/new', (req, res) => res.render('seo-page'));
  app.get('/rooms/:room/blocks/:id', (req, res) => {
    const block = blocks.find(block => block._id === req.params.id && block.roomId === req.params.room);
    if (!block) return res.status(404).render('error', { message: 'Missing resource' });
    return res.render('seo-page', { block, translations: blocks.filter(block => block.visibility === 'public' || block.status === 'locked') });
  });
  app.get('/rooms/:room', (req, res) => {
    if (req.params.room !== 'science') return res.sendStatus(404);
    res.locals.seoResource = { room: testRoom, roomStats: { postCount: roomCount, availableLocales: ['en', 'nl'] } };
    res.render('seo-page');
  });
  app.get('/trails/:slug', (req, res) => res.render('seo-page', { trail: { availableLocales: ['en', 'nl'], sourceLanguage: 'en' } }));
  app.get('/quests', (req, res) => res.render('seo-page', { currentPage: 2 }));
  app.use((req, res) => res.render('seo-page'));
  return app;
}

function metadata(response) {
  const document = new JSDOM(response.body).window.document;
  return {
    robots: document.querySelector('meta[name="robots"]')?.content,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    alternates: [...document.querySelectorAll('link[hreflang]')].map(link => ({ lang: link.hreflang, href: link.href })),
    document
  };
}

describe('rendered indexing responses', () => {
  it('adds noindex to the real login page without removing its form or navigation', async () => {
    const response = await inject(application(), '/nl/login');
    const meta = metadata(response);
    expect(response.status).toBe(200);
    expect(response.headers['x-robots-tag']).toBe('noindex, follow');
    expect(meta.robots).toBe('noindex, follow');
    expect(meta.canonical).toBeUndefined();
    expect(meta.alternates).toEqual([]);
    expect(meta.document.querySelector('form')).not.toBeNull();
    expect(meta.document.querySelector('a[href="/nl/tags"]')).not.toBeNull();
  });

  it('excludes the anonymous explanation and raw music metadata while retaining their responses', async () => {
    const app = application({ configure(app) {
      app.use(usersRouter);
      app.get('/music/meta/song', (req, res) => res.json(['A song']));
    } });
    const anonymous = await inject(app, '/en/users/anonymous');
    expect(anonymous.status).toBe(200);
    expect(metadata(anonymous).robots).toBe('noindex, follow');
    expect(metadata(anonymous).document.querySelector('a[href="/en/signup"]')).not.toBeNull();
    const music = await inject(app, '/music/meta/song');
    expect(music.status).toBe(200);
    expect(music.headers['x-robots-tag']).toBe('noindex, follow');
    expect(JSON.parse(music.body)).toEqual(['A song']);
  });

  for (const path of ['/en/tags', '/en/tags/heat', '/en/archive', '/en/archive/best-of', '/en/archive/2026/10/14', '/en/rooms/science/index', '/en/rooms/science/archive/best-of', '/en/rooms/science/blocks/new', `/rooms/science/blocks/${id}/edit`]) {
    it(`renders consistent exclusion metadata for ${path}`, async () => {
      const response = await inject(application(), path);
      const meta = metadata(response);
      expect(response.status).toBe(200);
      expect(meta.robots).toBe('noindex, follow');
      expect(meta.alternates).toEqual([]);
      expect(meta.canonical).toBeUndefined();
      expect(response.body).toContain('Public page contents');
    });
  }

  it('keeps the original and translated writing indexable with one alternate set', async () => {
    const app = application();
    for (const block of [original, translated]) {
      const path = `/rooms/science/blocks/${block._id}`;
      const response = await inject(app, path);
      const meta = metadata(response);
      expect(response.status).toBe(200);
      expect(meta.robots).toBe('index, follow');
      expect(meta.canonical).toBe(`http://dailypage.org${path}`);
      expect(meta.alternates.map(alt => alt.lang)).toEqual(['en', 'nl', 'x-default']);
      expect(meta.document.querySelector('article').getAttribute('lang')).toBe(block.lang);
      expect(response.body).toContain(block.content);
    }
  });

  it('keeps locked unlisted posts searchable and excludes unlisted in-progress records', async () => {
    for (const [status, robots] of [['locked', 'index, follow'], ['in-progress', 'noindex, follow']]) {
      const block = { ...original, visibility: 'unlisted', status };
      const response = await inject(application({ blocks: [block] }), `/rooms/science/blocks/${id}`);
      expect(metadata(response).robots).toBe(robots);
    }
  });

  it('canonicalizes article presentation and locale variants to the concrete record', async () => {
    const path = `/rooms/science/blocks/${id}`;
    for (const url of [path + '?ui=nl', '/nl' + path, path + '?ui=nl&commentId=123&trail=guide']) {
      const response = await inject(application({ blocks: [original] }), url);
      const meta = metadata(response);
      expect(meta.canonical).toBe(`http://dailypage.org${path}`);
      expect(meta.alternates.some(alt => alt.lang === 'nl')).toBeFalse();
      expect(response.body).toContain(original.content);
    }
  });

  it('renders both sides of the room threshold without removing room navigation', async () => {
    for (const count of [9, 10]) {
      const response = await inject(application({ roomCount: count }), '/nl/rooms/science');
      const meta = metadata(response);
      expect(meta.robots).toBe(count === 10 ? 'index, follow' : 'noindex, follow');
      expect(meta.alternates.length).toBe(count === 10 ? 3 : 0);
      expect(meta.document.querySelector('a[href="/nl/archive"]')).not.toBeNull();
    }
  });

  it('keeps untranslated room fallback browsable but noindex', async () => {
    const response = await inject(application(), '/ja/rooms/science');
    const meta = metadata(response);
    expect(response.status).toBe(200);
    expect(meta.robots).toBe('noindex, follow');
    expect(meta.canonical).toBeUndefined();
    expect(meta.alternates).toEqual([]);
    expect(response.body).toContain('Public page contents');
  });

  for (const overload of ['callback-only', 'options-and-callback', 'null-options']) {
    it(`preserves render callback ownership with ${overload}`, async () => {
      let calls = 0;
      const app = application({ configure(app) {
        app.get('/about', (req, res) => {
          const done = (error, html) => {
            calls += 1;
            expect(error).toBeNull();
            expect(res.headersSent).toBeFalse();
            res.set('X-Callback', 'handled');
            res.send(html);
          };
          if (overload === 'callback-only') res.render('seo-page', done);
          else res.render('seo-page', overload === 'null-options' ? null : { title: 'A title' }, done);
        });
      } });
      const response = await inject(app, '/en/about');
      expect(calls).toBe(1);
      expect(response.status).toBe(200);
      expect(response.headers['x-callback']).toBe('handled');
      expect(metadata(response).robots).toBe('index, follow');
      expect(metadata(response).canonical).toBe('http://dailypage.org/en/about');
    });
  }

  for (const callback of [false, true]) {
    it(`handles template lookup failures ${callback ? 'with' : 'without'} a callback`, async () => {
      let errorCalls = 0;
      const app = application({ configure(app) {
        app.get('/about', (req, res) => {
          const handle = error => { errorCalls += 1; expect(error).toBeTruthy(); res.status(503).send('Handled callback failure'); };
          if (callback) res.render('nonexistent-seo-template', handle);
          else res.render('nonexistent-seo-template');
        });
        app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
          errorCalls += 1;
          expect(error).toBeTruthy();
          res.status(500).send('Handled middleware failure');
        });
      } });
      const response = await inject(app, '/en/about');
      expect(errorCalls).toBe(1);
      expect(response.status).toBe(callback ? 503 : 500);
      expect(response.headers['x-robots-tag']).toBe('noindex, follow');
    });
  }

  it('handles asynchronous view-engine failures and synchronous exceptions', async () => {
    for (const asyncFailure of [true, false]) {
      const app = application({ configure(app) {
        app.engine('pug', (file, options, callback) => {
          if (asyncFailure) return setImmediate(() => callback(new Error('Engine failed')));
          throw new Error('Engine threw');
        });
        app.get('/about', (req, res) => res.render('seo-page'));
        app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
          res.status(500).send(error.message);
        });
      } });
      const response = await inject(app, '/en/about');
      expect(response.status).toBe(500);
      expect(response.headers['x-robots-tag']).toBe('noindex, follow');
      expect(response.body).toContain(asyncFailure ? 'Engine failed' : 'Engine threw');
    }
  });

  it('preserves localized homepage and ready trail canonical identities', async () => {
    for (const path of ['/nl/', '/nl/trails/guide']) {
      const meta = metadata(await inject(application(), path));
      expect(meta.robots).toBe('index, follow');
      expect(meta.canonical).toBe(`http://dailypage.org${path}`);
      expect(meta.alternates.some(alt => alt.lang === 'nl' && alt.href === meta.canonical)).toBeTrue();
    }
  });

  it('keeps pagination in the canonical of a distinct indexable list', async () => {
    const meta = metadata(await inject(application(), '/nl/quests?page=2&utm_source=mail'));
    expect(meta.canonical).toBe('http://dailypage.org/nl/quests?page=2');
  });

  it('normalizes trailing slashes once, retaining selectors and avoiding canonical redirects', async () => {
    const app = application();
    for (const [url, target] of [['/en/tags/heat/?page=2', '/en/tags/heat?page=2'], ['/nl', '/nl/'], ['/nl/?ui=en', null]]) {
      const response = await inject(app, url);
      if (target) {
        expect(response.status).toBe(301);
        expect(response.headers.location).toBe(target);
        expect((await inject(app, target)).status).toBe(200);
      } else expect(response.status).toBe(200);
    }
  });

  it('does not normalize unrelated routes, media, JSON, assets, or non-GET requests', async () => {
    const app = application({ configure(app) {
      app.use((req, res) => res.json({ original: req.originalUrl }));
    } });
    for (const [path, options] of [
      ['/music/meta/song/', {}], ['/api/v1/blocks/', {}], ['/peerjs/', {}],
      ['/assets/example.css/', {}], ['/audio/example.wav/', {}], ['/baseball/note/', {}],
      ['/iPod/1g/', {}], ['/future-endpoint/?keep=1', {}],
      ['/en/tags/heat/', { headers: { accept: 'application/json' } }],
      ['/archive/foo/bar', { method: 'POST' }]
    ]) {
      const response = await inject(app, path, options);
      expect(response.status).toBe(200);
      expect(response.headers.location).toBeUndefined();
      expect(JSON.parse(response.body).original).toBe(path);
    }
  });

  it('rejects malformed IDs and invalid dates before invoking resource handlers', async () => {
    const app = application();
    for (const path of ['/rooms/science/blocks/not-an-id', '/en/archive/2025/02/29', '/archive/2026/13', '/rooms/science/archive/2026/04/31', '/rooms/overview/2026-02-30', '/archive/2026/1oops', '/archive/foo/bar']) {
      expect((await inject(app, path)).status).toBe(404);
    }
    expect(validArchiveDate('2024', '02', '29')).toBeTrue();
    expect(validArchiveDate('2026', '10')).toBeTrue();
  });

  it('keeps translation resolver redirects free of noindex signals', async () => {
    const response = await inject(application(), '/posts/family');
    expect(response.status).toBe(302);
    expect(response.headers['x-robots-tag']).toBeUndefined();
    expect(response.headers.location).toBe(`/rooms/science/blocks/${id}`);
  });

  it('returns 404 for nonexistent articles and rooms', async () => {
    expect((await inject(application(), '/en/rooms/missing')).status).toBe(404);
    const response = await inject(application({ blocks: [] }), `/rooms/science/blocks/${id}`);
    expect(response.status).toBe(404);
    expect(metadata(response).robots).toBe('noindex, follow');
    expect(metadata(response).canonical).toBeUndefined();
  });

  it('serves crawlable robots rules and an XML sitemap without HTML metadata', async () => {
    const app = application({ sitemapResources: { blocks: [original], rooms: [testRoom] } });
    const robots = await inject(app, '/robots.txt');
    expect(robots.headers['content-type']).toContain('text/plain');
    expect(robots.body).toContain('Allow: /');
    expect(robots.body).not.toContain('Disallow:');
    expect(robots.body).toContain('Sitemap: http://dailypage.org/sitemap.xml');
    const sitemap = await inject(app, '/sitemap.xml');
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers['content-type']).toContain('application/xml');
    expect(sitemap.body).toContain(`<loc>http://dailypage.org/rooms/science/blocks/${id}</loc>`);
    expect(sitemap.body).not.toContain('<html');
  });
});

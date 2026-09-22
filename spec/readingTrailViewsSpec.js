import fs from 'node:fs';
import pug from 'pug';
import {
  buildReadingTrailDetailHandler,
  buildReadingTrailIndexHandler
} from '../server/routes/readingTrails.js';
import { getTranslatorRuntime } from '../server/services/i18n.js';
import { isLocalizedPath } from '../server/services/localizedPaths.js';

function trail() {
  const firstPost = {
    id: 'post-1', groupId: 'group-1', lang: 'en', roomId: 'physics',
    roomName: 'Physics', title: 'First reading', description: '',
    bannerImage: { kind: 'image', url: 'https://example.com/first.jpg' }
  };
  return {
    id: 'trail-1',
    slug: 'a-short-trail',
    sourceLanguage: 'en',
    locale: 'en',
    title: 'A short trail',
    description: 'Two connected readings.',
    readingCount: 2,
    roomCount: 2,
    coverPost: firstPost,
    availableLocales: ['en'],
    items: [
      { position: 1, groupId: 'group-1', note: 'Begin here.', post: firstPost },
      {
        position: 2,
        groupId: 'group-2',
        note: 'Continue here.',
        post: {
          id: 'post-2', groupId: 'group-2', lang: 'en', roomId: 'history',
          roomName: 'History', title: 'Second reading', description: '', bannerImage: null
        }
      }
    ]
  };
}

function response() {
  return {
    locals: {
      uiLang: 'en',
      baseUrl: 'https://dailypage.org',
      t: (key, params = {}) => `${key}${params.trailName ? `:${params.trailName}` : ''}`
    },
    statusCode: 200,
    rendered: null,
    status(code) { this.statusCode = code; return this; },
    render(view, model) { this.rendered = { view, model }; return this; }
  };
}

describe('reading trail pages', () => {
  it('compiles the directory and detail templates', () => {
    for (const view of ['index', 'detail']) {
      expect(() => pug.compileFile(`${process.cwd()}/views/reading-trails/${view}.pug`))
        .not.toThrow();
    }
  });

  it('recognizes reading trail routes as localized paths', () => {
    expect(isLocalizedPath('/trails')).toBeTrue();
    expect(isLocalizedPath('/trails/a-short-trail')).toBeTrue();
  });

  it('renders the locale-scoped trail directory', async () => {
    const listTrails = jasmine.createSpy('listTrails').and.resolveTo([trail()]);
    const handler = buildReadingTrailIndexHandler({ listTrails });
    const res = response();
    await handler({ user: null }, res);

    expect(listTrails).toHaveBeenCalledOnceWith({ locale: 'en' });
    expect(res.rendered.view).toBe('reading-trails/index');
    expect(res.rendered.model.trails).toHaveSize(1);
  });

  it('publishes hreflang only for runtime-ready trail editions', async () => {
    const getTrail = jasmine.createSpy('getTrail').and.resolveTo(trail());
    const handler = buildReadingTrailDetailHandler({ getTrail });
    const res = response();
    await handler({ params: { slug: 'a-short-trail' }, user: null }, res);

    expect(res.rendered.view).toBe('reading-trails/detail');
    expect(res.locals.hreflang).toEqual([
      { lang: 'en', href: 'https://dailypage.org/en/trails/a-short-trail' },
      { lang: 'x-default', href: 'https://dailypage.org/en/trails/a-short-trail' }
    ]);
  });

  it('returns 404 when the requested language edition is unavailable', async () => {
    const handler = buildReadingTrailDetailHandler({ getTrail: async () => null });
    const res = response();
    await handler({ params: { slug: 'a-short-trail' }, user: null }, res);

    expect(res.statusCode).toBe(404);
    expect(res.rendered.view).toBe('error');
    expect(res.rendered.model.message).toBe('readingTrails.errors.notFound');
  });

  it('renders ordered post links with harmless trail context', () => {
    const html = pug.renderFile('views/reading-trails/detail.pug', {
      trail: trail(),
      uiLang: 'en',
      uiPath: path => `/en${path}`,
      uiPathFor: (lang, path) => `/${lang}${path}`,
      t: key => key,
      textDirForLang: () => 'ltr'
    });

    expect(html).toContain('<ol class="reading-trail-stop-list">');
    expect(html).toContain('/en/rooms/physics/blocks/post-1?trail=a-short-trail');
    expect(html).toContain('readingTrails.detail.whyItBelongs');
    expect(html).toContain('loading="lazy"');
  });

  it('falls back to English interface copy while trail content remains locale-gated', async () => {
    const t = await getTranslatorRuntime('es', ['readingTrails']);
    expect(t('readingTrails.overview.heading')).toBe('Reading Trails');
    expect(t('readingTrails.detail.begin')).toBe('Begin the trail');
  });

  it('keeps the supported mobile, dark-theme, and RTL architecture explicit', () => {
    const css = fs.readFileSync('public/css/reading-trails.css', 'utf8');
    const mobile = css.slice(css.indexOf('@media (max-width: 560px)'));
    expect(mobile).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(mobile).toContain('width: 100%');
    expect(css).toContain('var(--surface-raised-bg)');
    expect(css).toContain('.reading-trail-stop__card {\n  display: grid;\n  width: auto;\n  max-width: 100%;\n  box-sizing: border-box;');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain("html[dir='rtl'] .reading-trail-arrow");
    expect(css).toContain("html[dir='rtl'] .reading-trail-stop-list::before");
  });
});

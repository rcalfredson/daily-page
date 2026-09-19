import fs from 'node:fs';
import pug from 'pug';

import { getTranslatorRuntime } from '../server/services/i18n.js';
import { SUPPORTED_UI_LANGS } from '../server/services/localeContext.js';

const partialPath = 'views/partials/_home_discovery_shelf.pug';
const homeTemplate = fs.readFileSync('views/home.pug', 'utf8');
const homeStyles = fs.readFileSync('public/css/home.css', 'utf8');

describe('homepage discovery shelf view', () => {
  function render(posts) {
    return pug.renderFile(partialPath, {
      homeDiscoveryPosts: posts,
      preferredContentLang: 'en',
      uiPath: path => `/en${path}`,
      textDirForLang: lang => lang === 'ar' ? 'rtl' : 'ltr',
      t: key => key
    });
  }

  it('renders semantic, localized post cards and lazy images', () => {
    const html = render([{
      id: 'post-1',
      roomId: 'physics',
      roomName: 'Physics',
      lang: 'ar',
      title: 'A post title',
      description: 'A useful summary.',
      bannerImage: { url: 'https://example.com/banner.jpg' }
    }]);

    expect(html).toContain('<section class="home-wander"');
    expect(html).toContain('<ul class="home-wander__grid">');
    expect(html).toContain('href="/en/discover/surprise"');
    expect(html).toContain('home.discovery.surpriseMe');
    expect(html).toContain('href="/en/rooms/physics/blocks/post-1"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).toContain('layout.languages.ar');
    expect(html).toContain('class="home-wander__arrow"');
  });

  it('renders nothing when the shelf is empty', () => {
    expect(render([])).toBe('');
  });

  it('places the shelf between the homepage hero and supporting content', () => {
    const shelf = homeTemplate.indexOf('include partials/_home_discovery_shelf');
    expect(shelf).toBeGreaterThan(homeTemplate.indexOf('header.homepage-header'));
    expect(shelf).toBeLessThan(homeTemplate.indexOf('if supportFunding'));
    expect(shelf).toBeLessThan(homeTemplate.indexOf('main.home-discovery'));
  });

  it('collapses to one shrinkable column for the supported 330px viewport', () => {
    const tabletStart = homeStyles.indexOf('@media (max-width: 980px)');
    const mobileStart = homeStyles.indexOf('@media (max-width: 560px)', tabletStart);
    const reducedMotionStart = homeStyles.indexOf('@media (prefers-reduced-motion: reduce)', mobileStart);
    const tabletRules = homeStyles.slice(tabletStart, mobileStart);
    const mobileRules = homeStyles.slice(mobileStart, reducedMotionStart);

    expect(homeStyles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(tabletRules).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(mobileRules).toContain('.home-wander__grid');
    expect(mobileRules).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(mobileRules).toContain('.home-wander__actions');
    expect(mobileRules).toContain('width: 100%');
    expect(homeStyles).toContain('.home-wander-card {\n  min-width: 0');
    expect(homeStyles).toContain('overflow-wrap: anywhere');
  });

  it('falls back to the English discovery copy for untranslated locales', async () => {
    const t = await getTranslatorRuntime('zz', ['home']);
    expect(t('home.discovery.title')).toBe('Wander somewhere');
    expect(t('home.discovery.browseRooms')).toBe('Browse all rooms');
  });

  it('provides complete discovery copy for every supported locale', () => {
    const keys = ['eyebrow', 'title', 'description', 'surpriseMe', 'browseRooms', 'readPost'];

    for (const lang of SUPPORTED_UI_LANGS) {
      const bundle = JSON.parse(fs.readFileSync(`i18n/${lang}/home.json`, 'utf8'));
      for (const key of keys) {
        expect(bundle.home?.discovery?.[key])
          .withContext(`${lang} is missing home.discovery.${key}`)
          .toEqual(jasmine.any(String));
        expect(bundle.home.discovery[key].trim().length)
          .withContext(`${lang} has empty home.discovery.${key}`)
          .toBeGreaterThan(0);
      }
    }
  });

  it('mirrors discovery arrows in right-to-left interfaces', () => {
    expect(homeStyles).toContain("html[dir='rtl'] .home-wander__arrow");
    expect(homeStyles).toContain('transform: scaleX(-1)');
  });
});

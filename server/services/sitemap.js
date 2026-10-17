import { resolveSeo, SEO_STATIC_PATHS } from './seoPolicy.js';
import { staticSeoLocales } from './seoLocales.js';
import { SUPPORTED_UI_LANGS } from './localeContext.js';
import { canonicalBlockPath } from '../utils/canonical.js';
import { roomSeoFacts } from '../db/roomSeoService.js';

export function buildSitemapEntries({ baseUrl, blocks = [], rooms = [], roomStats = {}, trails = [] }) {
  const entries = new Map();
  const roomIds = new Set(rooms.map(room => String(room._id)));
  const trailLocales = [...new Set(trails
    .filter(({ locale, trail }) => trail.availableLocales?.includes(locale))
    .map(({ locale }) => locale))];
  function add(context, lastmod) {
    const seo = resolveSeo({ baseUrl, ...context });
    if (seo.sitemapEligible) entries.set(seo.canonicalUrl, {
      loc: seo.canonicalUrl, hreflang: seo.hreflang,
      ...(lastmod && Number.isFinite(new Date(lastmod).getTime()) ? { lastmod: new Date(lastmod).toISOString() } : {})
    });
  }
  for (const path of SEO_STATIC_PATHS) {
    // No supported-language fallback: directory candidates require resource
    // evidence; information-page candidates require their actual copy bundles.
    const locales = path === '/' ? SUPPORTED_UI_LANGS
      : path === '/trails' ? trailLocales : staticSeoLocales(path);
    for (const locale of locales) {
      add({ path, locale, availableLocales: staticSeoLocales(path), directoryHasContent: path === '/trails' });
    }
  }
  for (const block of blocks) {
    // Mirror the article route's ObjectId/room binding requirements. Visibility
    // still comes from the shared resolver, including locked unlisted records.
    if (!/^[a-f0-9]{24}$/i.test(String(block._id)) || !block.roomId) continue;
    add({ path: canonicalBlockPath(block), block, roomExists: roomIds.has(String(block.roomId)) }, block.updatedAt);
  }
  for (const room of rooms) {
    for (const locale of SUPPORTED_UI_LANGS) {
      add({ path: `/rooms/${encodeURIComponent(room._id)}`, locale, room, roomStats: roomSeoFacts(room, roomStats) });
    }
  }
  for (const { locale, trail } of trails) {
    add({ path: `/trails/${encodeURIComponent(trail.slug)}`, locale, trail });
  }
  return [...entries.values()];
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}

export function renderSitemap(entries) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + entries.map(entry => `  <url><loc>${xml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${xml(entry.lastmod)}</lastmod>` : ''}</url>`).join('\n')
    + '\n</urlset>\n';
}

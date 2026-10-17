import { SUPPORTED_UI_LANGS } from './localeContext.js';
import { isLocalizedPath } from './localizedPaths.js';
import { isPubliclyVisibleBlock } from './blockVisibility.js';
import { canonicalBlockPath } from '../utils/canonical.js';

export const ROOM_INDEX_MIN_POSTS = 10;
export const SEO_STATIC_PATHS = ['/', '/rooms', '/about', '/support', '/privacy', '/trails', '/quests'];

export function normalizeSeoPath(path) {
  return (path || '/').replace(/\/+$/, '') || '/';
}

export function seoFamily(path) {
  path = normalizeSeoPath(path);
  if (/^\/rooms\/[^/]+\/blocks\/new$/.test(path)
    || /^\/rooms\/[^/]+\/blocks\/[^/]+\/edit$/.test(path)) return 'utility';
  if (/^\/rooms\/[^/]+\/blocks\/[^/]+$/.test(path)) return 'article';
  if (/^\/rooms\/[^/]+\/blocks\//.test(path)) return 'utility'; // HTML fragments
  if (/^\/tags(?:\/|$)/.test(path)) return 'tag';
  if (/^\/archive(?:\/|$)/.test(path)
    || /^\/rooms\/[^/]+\/(?:archive(?:\/.*)?|index)$/.test(path)
    || /^\/\d{4}\/\d{1,2}$/.test(path)) return 'archive';
  if (/^\/rooms\/[^/]+\/\d{4}-\d{2}-\d{2}$/.test(path)) return 'legacy-writing';
  if (/^\/rooms\/[^/]+$/.test(path)) return 'room';
  if (/^\/trails\/[^/]+$/.test(path)) return 'trail';
  if (path === '/') return 'home';
  if (/^\/(?:login|signup|verify-email|forgot-password|reset-password|search|dashboard|forest|discover|api|peerjs|dev)(?:\/|$)/.test(path)
    || path === '/users/anonymous' || /^\/music\/meta(?:\/|$)/.test(path)
    || path === '/random-writer' || path === '/quests/review' || /^\/quests\/[^/]+\/leaderboard$/.test(path)
    || /^\/posts\//.test(path) || path === '/today') return 'utility';
  return 'other';
}

export function localizedSeoPath(path, locale) {
  path = normalizeSeoPath(path);
  return isLocalizedPath(path) ? `/${locale}${path === '/' ? '/' : path}` : path;
}

// Presentation parameters never define article identity. Pagination and content
// selectors on indexable lists do: page 2 must not canonicalize to page 1.
function canonicalQuery(family, path, query) {
  if (['article', 'home', 'room', 'trail', 'legacy-writing'].includes(family)) return '';
  const allowed = /^\/quests(?:\/|$)/.test(path)
    ? ['page', 'view', 'state', 'q']
    : /^\/users\/[^/]+\/blocks$/.test(path)
      ? ['page', 'sort', 'dir'] : [];
  const params = new URLSearchParams();
  for (const key of allowed) {
    const value = query[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (key === 'page') {
      if (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 1) {
        params.set(key, String(Number(value)));
      }
    } else params.set(key, value);
  }
  return params.size ? `?${params}` : '';
}

function localizedAlternates(baseUrl, path, locales, defaultLocale) {
  const langs = [...new Set(locales)].filter(lang => SUPPORTED_UI_LANGS.includes(lang));
  if (!langs.length) return [];
  const alternates = langs.map(lang => ({ lang, href: `${baseUrl}${localizedSeoPath(path, lang)}` }));
  alternates.push({
    lang: 'x-default',
    href: `${baseUrl}${localizedSeoPath(path, langs.includes(defaultLocale) ? defaultLocale : langs[0])}`
  });
  return alternates;
}

export function resolveSeo({
  path = '/', locale = 'en', baseUrl = '', query = {}, status = 200,
  block, translations = [], room, roomStats, trail, availableLocales = [],
  legacyHasWriting, roomExists = true, directoryHasContent = false
} = {}) {
  path = normalizeSeoPath(path);
  baseUrl = baseUrl.replace(/\/$/, '');
  const family = seoFamily(path);
  let indexable = !['utility', 'tag', 'archive'].includes(family);
  let reason = indexable ? 'public-page' : family;
  if (family === 'article') {
    indexable = isPubliclyVisibleBlock(block);
    reason = indexable ? 'public-article' : 'nonpublic-article';
  }
  if (family === 'room') {
    const enoughPosts = room && roomStats?.postCount >= ROOM_INDEX_MIN_POSTS;
    indexable = Boolean(enoughPosts && roomStats?.availableLocales?.includes(locale));
    reason = indexable ? 'established-localized-room'
      : enoughPosts ? 'room-without-localized-content' : 'room-below-threshold';
  }
  if (family === 'trail') {
    indexable = Boolean(trail?.availableLocales?.includes(locale));
    reason = indexable ? 'published-trail-edition' : 'unavailable-trail-edition';
  }
  if (family === 'legacy-writing' && legacyHasWriting === false) indexable = false;
  if (status < 200 || status >= 300) {
    indexable = false;
    reason = 'non-success-response';
  }
  const canonicalPath = family === 'article' && block
    ? canonicalBlockPath(block) : localizedSeoPath(path, locale);
  const canonicalUrl = indexable
    ? `${baseUrl}${canonicalPath}${canonicalQuery(family, path, query)}` : null;
  let hreflang = [];
  if (indexable) {
    if (family === 'article') {
      const seen = new Set();
      hreflang = translations.filter(tr => {
        if (!SUPPORTED_UI_LANGS.includes(tr.lang) || seen.has(tr.lang)) return false;
        seen.add(tr.lang);
        return true;
      }).map(tr => ({ lang: tr.lang, href: `${baseUrl}${canonicalBlockPath(tr)}` }));
      if (block.groupId) hreflang.push({ lang: 'x-default', href: `${baseUrl}/posts/${encodeURIComponent(block.groupId)}` });
    } else if (family === 'trail') {
      hreflang = localizedAlternates(baseUrl, path, trail.availableLocales, trail.sourceLanguage);
    } else if (family === 'room') {
      const meaningfulLocales = roomStats?.availableLocales || [];
      if (meaningfulLocales.includes(locale)) hreflang = localizedAlternates(baseUrl, path, meaningfulLocales, 'en');
    } else if (availableLocales.includes(locale)) {
      hreflang = localizedAlternates(baseUrl, path, availableLocales, 'en');
    }
  }
  const sitemapEligible = indexable && (
    ['article', 'room', 'trail', 'home'].includes(family)
    || SEO_STATIC_PATHS.includes(path)
  ) && !canonicalQuery(family, path, query)
    && (family !== 'article' || roomExists)
    && (path !== '/trails' || directoryHasContent)
    && path !== '/quests'; // Localized quest-directory eligibility is not yet defined.
  return { family, indexable, reason, robots: indexable ? 'index, follow' : 'noindex, follow', canonicalUrl, hreflang, sitemapEligible };
}

import { normalizeSeoPath } from '../services/seoPolicy.js';
import { isLocalizedPath } from '../services/localizedPaths.js';
import { seoFamily } from '../services/seoPolicy.js';

export function normalizeHtmlUrl(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  const path = res.locals.unprefixedPath || req.path;
  const normalized = normalizeSeoPath(path);
  const accept = req.get('accept') || '';
  if (!accept.includes('text/html') && !accept.includes('*/*')) return next();
  // Limit normalization to reviewed page routes, not assets, JSON/media,
  // side projects, or unrelated future endpoints.
  const family = seoFamily(normalized);
  if (!isLocalizedPath(normalized)
    && !['article', 'legacy-writing', 'archive'].includes(family)
    && !/^\/rooms\/[^/]+\/blocks\/[^/]+\/edit$/.test(normalized)) return next();
  let target = normalized;
  if (res.locals.hadUiPrefix) {
    target = `/${res.locals.uiLang}${normalized === '/' ? '/' : normalized}`;
  }
  const originalPath = req.originalUrl.split('?')[0];
  if (target === originalPath) return next();
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  return res.redirect(301, target + query);
}

export function validArchiveDate(year, month, day = '1') {
  if (!/^\d{4}$/.test(String(year)) || !/^\d{1,2}$/.test(String(month)) || !/^\d{1,2}$/.test(String(day))) return false;
  const y = Number(year), m = Number(month), d = Number(day);
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Validate before language redirects and database queries. Invalid resources
// return 404 rather than casting errors, rollover dates, or empty 200 pages.
export function validateSeoUrl(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  const path = res.locals.unprefixedPath || req.path;
  const block = path.match(/^\/rooms\/[^/]+\/blocks\/([^/]+)(?:\/(?:edit|recommendations))?$/);
  if (block && block[1] !== 'new' && !/^[a-f0-9]{24}$/i.test(block[1])) return res.sendStatus(404);
  const archive = path.match(/^(?:\/rooms\/[^/]+)?\/archive\/(\d[^/]*)(?:\/([^/]+))(?:\/([^/]+))?$/)
    || path.match(/^\/(\d{4})\/([^/]+)$/);
  const legacy = path.match(/^\/rooms\/[^/]+\/(\d{4})-(\d{2})-(\d{2})$/);
  const parts = archive || legacy;
  // Also reject nonnumeric archive date components (best-of is a separate route).
  const archiveDatePath = /^(?:\/rooms\/[^/]+)?\/archive\/[^/]+\//.test(path);
  if ((archiveDatePath && !archive) || (parts && !validArchiveDate(parts[1], parts[2], parts[3]))) return res.sendStatus(404);
  next();
}

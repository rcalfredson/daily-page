// server/middleware/hreflang.js
import { isLocalizedPath } from '../services/localizedPaths.js';

const indexableLangs = ['en', 'es'];

// Treat block-view as "content-hreflang owns this page"
function isBlockViewPath(path) {
  return /^\/rooms\/[^/]+\/blocks\/[^/]+$/.test(path);
}

export function addHreflangLocals(req, res, next) {
  const base = res.locals.baseUrl;
  const unprefixed = res.locals.unprefixedPath || req.path;

  // Default: no UI hreflang
  res.locals.hreflang = null;

  // Skip unless this path is in the localized rollout set
  if (!isLocalizedPath(unprefixed)) return next();

  // Skip block view (it already outputs content-language alternates)
  if (isBlockViewPath(unprefixed)) return next();

  res.locals.hreflang = indexableLangs.map((lang) => ({
    lang,
    href: `${base}/${lang}${unprefixed === '/' ? '' : unprefixed}`,
  }));

  res.locals.hreflang.push({
    lang: 'x-default',
    href: `${base}/en${unprefixed === '/' ? '' : unprefixed}`,
  });

  next();
}

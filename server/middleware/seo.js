// server/middleware/seo.js
import { isLocalizedPath } from '../services/localizedPaths.js';

export function addSeoLocals(req, res, next) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const base = (process.env.BASE_URL || `${proto}://${host}`).replace(/\/$/, '');
  res.locals.baseUrl = base;

  const unprefixed = res.locals.unprefixedPath || req.path;

  const seoPath = isLocalizedPath(unprefixed)
    ? (res.locals.prefixedPath || req.path)
    : unprefixed;

  res.locals.canonicalUrl = `${base}${seoPath}`;
  next();
}

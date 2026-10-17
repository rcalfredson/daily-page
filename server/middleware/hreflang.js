import { resolveSeo } from '../services/seoPolicy.js';
import { seoContext } from './seo.js';

// Compatibility entry point. Rendering and sitemap generation use the same
// resolver; no middleware emits all supported UI languages indiscriminately.
export function addHreflangLocals(req, res, next) {
  res.locals.hreflang = resolveSeo(seoContext(req, res)).hreflang;
  next();
}

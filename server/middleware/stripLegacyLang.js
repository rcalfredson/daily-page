// server/middleware/stripLegacyLang.js
import { buildRedirectQuery } from '../services/urlPolicy.js';
import { withQuery } from '../utils/urls.js';

/**
 * For non-block routes:
 * If ?lang= is present, 302 to canonical URL without lang.
 * Preserve ?ui= only if it was explicitly present.
 */
export function stripLegacyLang({ canonicalPath }) {
  return function stripLegacyLangMiddleware(req, res, next) {
    if (!req.query?.lang) return next();

    const targetPath =
      typeof canonicalPath === 'function' ? canonicalPath(req) : canonicalPath;

    return res.redirect(302, withQuery(targetPath, buildRedirectQuery(req)));
  };
}

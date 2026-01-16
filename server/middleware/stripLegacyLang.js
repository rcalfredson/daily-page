// server/middleware/stripLegacyLang.js
import { buildRedirectQuery } from '../services/urlPolicy.js';
import { withQuery } from '../utils/urls.js';
import { isLocalizedPath } from '../services/localizedPaths.js';

export function stripLegacyLang({ canonicalPath }) {
  return function stripLegacyLangMiddleware(req, res, next) {
    if (!req.query?.lang) return next();

    const targetPath =
      typeof canonicalPath === 'function' ? canonicalPath(req) : canonicalPath;

    const ui = res.locals.uiLang || 'en';

    // Only send people into /{ui}/... when that route is actually in rollout
    const finalPath = isLocalizedPath(targetPath)
      ? `/${ui}${targetPath === '/' ? '' : targetPath}`
      : targetPath;

    return res.redirect(302, withQuery(finalPath, buildRedirectQuery(req)));
  };
}

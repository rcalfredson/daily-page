// server/middleware/prefixRedirect.js
function looksLikeHtmlRequest(req) {
  // Avoid redirecting API, assets, and non-HTML fetches
  const accept = req.get('accept') || '';
  const isHtml = accept.includes('text/html') || accept.includes('*/*');
  const hasExt = /\.[a-zA-Z0-9]{2,6}$/.test(req.path); // crude but effective
  return isHtml && !hasExt;
}

function stripLegacyUiLangParams(query) {
  const q = { ...(query || {}) };
  delete q.ui;   // UI now lives in the path
  delete q.lang; // keep "lang" out of indexable list pages unless you explicitly support it
  return q;
}

function withQuery(path, queryObj) {
  const qs = new URLSearchParams(queryObj).toString();
  return qs ? `${path}?${qs}` : path;
}

// You control rollout by what this returns true for
export function makePrefixRedirectMiddleware({ isLocalizedPath }) {
  return function prefixRedirect(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!looksLikeHtmlRequest(req)) return next();
    if (res.locals.hadUiPrefix) return next(); // already prefixed

    // Skip if not in rollout set
    const unprefixed = res.locals.unprefixedPath || req.path;
    if (!isLocalizedPath(unprefixed)) return next();

    const target = res.locals.prefixedPath;
    const q = stripLegacyUiLangParams(req.query);
    return res.redirect(302, withQuery(target, q));
  };
}

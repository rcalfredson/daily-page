import { normalizeSeoPath, resolveSeo } from '../services/seoPolicy.js';
import { staticSeoLocales } from '../services/seoLocales.js';

export function seoContext(req, res) {
  const path = normalizeSeoPath(res.locals.unprefixedPath || req.path);
  return {
    path,
    locale: res.locals.uiLang || res.locals.prefixedPath?.split('/')[1] || 'en',
    baseUrl: res.locals.baseUrl,
    query: req.query || {},
    availableLocales: staticSeoLocales(path)
  };
}

export function addSeoLocals(req, res, next) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  res.locals.baseUrl = (process.env.BASE_URL || `${proto}://${host}`).replace(/\/$/, '');
  const context = seoContext(req, res);
  const initial = resolveSeo(context);
  res.locals.canonicalUrl = initial.canonicalUrl;
  res.locals.hreflang = initial.hreflang;
  res.locals.robots = initial.robots;
  if (['utility', 'tag', 'archive'].includes(initial.family)) res.set?.('X-Robots-Tag', initial.robots);

  const redirect = res.redirect;
  res.redirect = function redirectWithoutIndexingDirective(...args) {
    // Redirects express URL selection; noindex belongs on the destination's
    // resource policy, not on language/content resolver responses.
    res.removeHeader?.('X-Robots-Tag');
    return redirect.apply(this, args);
  };

  const render = res.render;
  res.render = function renderWithSeo(view, options = {}, callback) {
    if (typeof options === 'function') { callback = options; options = {}; }
    options = options || {};
    const model = { ...res.locals, ...options };
    const query = { ...context.query };
    if (model.currentPage != null) query.page = String(model.currentPage);
    const seo = resolveSeo({
      ...context,
      query,
      ...res.locals.seoResource,
      status: res.statusCode || 200,
      block: model.block,
      translations: model.translations,
      trail: model.trail
    });
    Object.assign(res.locals, seo);
    res.set?.('X-Robots-Tag', seo.robots);
    return render.call(this, view, { ...options, ...seo }, (error, html) => {
      if (error) {
        // A failed template must not leave the provisional success directives
        // on Express's error response (or a caller's callback error response).
        const failed = resolveSeo({ ...context, status: 500 });
        Object.assign(res.locals, failed);
        res.set?.('X-Robots-Tag', failed.robots);
      }
      // Match Express: callbacks own the response; without one, forward errors
      // to the router and automatically send successful HTML.
      if (callback) return callback(error, html);
      if (error) return req.next(error);
      return this.send(html);
    });
  };
  next();
}

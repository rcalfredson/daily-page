// server/middleware/seo.js
export function addSeoLocals(req, res, next) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');

  // Absolute base for building URLs (can be forced in env)
  const base = (process.env.BASE_URL || `${proto}://${host}`).replace(/\/$/, '');
  res.locals.baseUrl = base;

  // Canonical URL for the current request (strip querystring)
  res.locals.canonicalUrl = `${base}${req.path}`;

  next();
}

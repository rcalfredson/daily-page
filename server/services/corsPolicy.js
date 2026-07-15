export const CORS_ALLOWED_ORIGINS = Object.freeze([
  'https://dailypage.org',
  'http://localhost:3000'
]);

function normalizedOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function requestOrigin(req) {
  const host = req.get('host');
  return host ? normalizedOrigin(`${req.protocol}://${host}`) : null;
}

export function corsOriginAllowed(origin, req) {
  if (!origin) return true;
  const normalized = normalizedOrigin(origin);
  if (!normalized) return false;
  return CORS_ALLOWED_ORIGINS.includes(normalized) || normalized === requestOrigin(req);
}

export function corsOptionsForRequest(req) {
  return {
    origin(origin, callback) {
      if (corsOriginAllowed(origin, req)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    }
  };
}

export function corsOptionsDelegate(req, callback) {
  callback(null, corsOptionsForRequest(req));
}

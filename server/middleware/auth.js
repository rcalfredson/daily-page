import { authenticateRequest } from '../services/authSessions.js';

export async function isAuthenticated(req, res, next) {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) {
      return res.redirect('/login');
    }

    req.user = auth.user;
    req.authSession = auth.session;
    req.dbUser = auth.dbUser;
    return next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.redirect('/login');
  }
}

// Middleware to prevent caching of auth endpoints
export function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Vary', 'Cookie');
  next();
}

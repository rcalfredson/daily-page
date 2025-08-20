import { verifyJWT } from '../services/jwt.js'; // Adjust path as needed

export function isAuthenticated(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.redirect('/login'); // Redirect to login if no token exists
  }

  try {
    const userData = verifyJWT(token); // Decode and verify the JWT
    req.user = userData; // Attach decoded user data to `req` for downstream use
    return next(); // Let the next middleware/route handler run
  } catch (error) {
    console.error('Authentication error:', error);
    return res.redirect('/login'); // Redirect if token is invalid
  }
}

// Middleware to prevent caching of auth endpoints
export function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Vary', 'Cookie');
  next();
}


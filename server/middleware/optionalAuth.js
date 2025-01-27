import { verifyJWT } from '../services/jwt.js';

function optionalAuth(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return next();
  }

  try {
    const userData = verifyJWT(token);
    req.user = userData; 
  } catch (error) {
    console.error('Optional auth error:', error);
  }

  next();
}

export default optionalAuth;

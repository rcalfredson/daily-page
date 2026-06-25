import { authenticateRequest } from '../services/authSessions.js';

async function optionalAuth(req, res, next) {
  try {
    const auth = await authenticateRequest(req, res);
    if (auth) {
      req.user = auth.user;
      req.authSession = auth.session;
      req.dbUser = auth.dbUser;
    }
  } catch (error) {
    console.error('Optional auth error:', error);
  }

  next();
}

export default optionalAuth;

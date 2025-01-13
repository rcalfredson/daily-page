import jwt from 'jsonwebtoken';
import { config } from '../../config/config.js';

// Generate JWT with claims
export function generateJWT(payload, expiryMins = 1440) {
  return jwt.sign(payload, config.appAuth, {
    expiresIn: `${expiryMins}m`,
  });
}

// Verify JWT in cookies
export function verifyJWT(token) {
  return jwt.verify(token, config.appAuth);
}

import jwt from 'jsonwebtoken';

import { config } from '../../config/config.js';

export function expiringKey(expiryMins = 1440) {
  return jwt.sign({ exp: Math.floor(Date.now() / 1000) + (expiryMins * 60) }, config.appAuth);
}

export function verifyReq(req) {
  jwt.verify(req.headers.authorization, config.appAuth);
}

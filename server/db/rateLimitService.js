import crypto from 'crypto';
import CommentRateEvent from './models/CommentRateEvent.js';

import { config } from '../../config/config.js';

const ONE_MIN_MS = 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;

// Use a stable salt so hashes can’t be reversed easily.
// Put RATE_LIMIT_SALT in .env (recommended), fallback to mongo pw so it’s not empty.
const SALT = config.rateLimitSalt || config.mongoDbPw || 'fallback-salt';

export function hashIP(ip) {
  const raw = String(ip || '').trim();
  return crypto.createHash('sha256').update(`${SALT}:${raw}`).digest('hex');
}

export function commentHasUrl(text) {
  const s = String(text || '');
  // intentionally simple; catches obvious spam links
  return /https?:\/\/\S+/i.test(s) || /\bwww\.\S+/i.test(s);
}

export async function enforceAndRecordCommentRateLimit({ userId, ip, hasUrl }) {
  const now = Date.now();
  const ipHash = hashIP(ip);

  const sinceUser = new Date(now - ONE_MIN_MS);
  const sinceIp = new Date(now - TEN_MIN_MS);

  // Check counts in parallel
  const [userCountLastMin, ipCountLastTenMin, ipUrlCountLastTenMin] = await Promise.all([
    userId
      ? CommentRateEvent.countDocuments({
          kind: 'comment',
          userId: String(userId),
          createdAt: { $gte: sinceUser }
        })
      : Promise.resolve(0),

    CommentRateEvent.countDocuments({
      kind: 'comment',
      ipHash,
      createdAt: { $gte: sinceIp }
    }),

    hasUrl
      ? CommentRateEvent.countDocuments({
          kind: 'comment',
          ipHash,
          hasUrl: true,
          createdAt: { $gte: sinceIp }
        })
      : Promise.resolve(0)
  ]);

  if (userId && userCountLastMin >= 1) {
    const err = new Error('Rate limit: please wait before commenting again.');
    err.status = 429;
    throw err;
  }

  if (ipCountLastTenMin >= 10) {
    const err = new Error('Rate limit: too many comments from this network.');
    err.status = 429;
    throw err;
  }

  if (hasUrl && ipUrlCountLastTenMin >= 1) {
    const err = new Error('Rate limit: links are temporarily restricted. Try again later.');
    err.status = 429;
    throw err;
  }

  // Record the event (only after passing checks)
  await CommentRateEvent.create({
    kind: 'comment',
    userId: userId ? String(userId) : null,
    ipHash,
    hasUrl: !!hasUrl,
    createdAt: new Date()
  });
}

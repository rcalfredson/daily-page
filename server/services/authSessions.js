import crypto from 'crypto';
import AuthSession from '../db/models/AuthSession.js';
import { findUserById } from '../db/userService.js';

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';

export const AUTH_SESSION_DURATIONS = Object.freeze({
  standardIdleMs: 24 * 60 * 60 * 1000,
  standardAbsoluteMs: 24 * 60 * 60 * 1000,
  rememberedIdleMs: 30 * 24 * 60 * 60 * 1000,
  rememberedAbsoluteMs: 90 * 24 * 60 * 60 * 1000,
  touchAfterMs: 5 * 60 * 1000,
});

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function makeCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge,
  };
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
  });
}

export function toRequestUser(user) {
  if (!user) return null;

  return {
    id: String(user._id || user.id),
    username: user.username,
    email: user.email,
    profilePic: user.profilePic,
    bio: user.bio,
    streakLength: user.streakLength,
    preferredLang: user.preferredLang,
    preferredUiLang: user.preferredUiLang || 'en',
    verified: user.verified,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

export function computeAuthSessionExpiry({ remembered = false, now = new Date() } = {}) {
  const idleMs = remembered
    ? AUTH_SESSION_DURATIONS.rememberedIdleMs
    : AUTH_SESSION_DURATIONS.standardIdleMs;
  const absoluteMs = remembered
    ? AUTH_SESSION_DURATIONS.rememberedAbsoluteMs
    : AUTH_SESSION_DURATIONS.standardAbsoluteMs;
  const absoluteExpiresAt = new Date(now.getTime() + absoluteMs);
  const expiresAt = new Date(Math.min(now.getTime() + idleMs, absoluteExpiresAt.getTime()));

  return { expiresAt, absoluteExpiresAt, maxAge: expiresAt.getTime() - now.getTime() };
}

export async function createAuthSession({ user, rememberMe = false, req, res, now = new Date() }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const { expiresAt, absoluteExpiresAt, maxAge } = computeAuthSessionExpiry({
    remembered: rememberMe,
    now,
  });

  await AuthSession.create({
    userId: user._id || user.id,
    tokenHash: hashValue(token),
    remembered: rememberMe,
    userAgentHash: req?.get?.('user-agent') ? hashValue(req.get('user-agent')) : null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    absoluteExpiresAt,
  });

  res.cookie(AUTH_COOKIE_NAME, token, makeCookieOptions(maxAge));

  return token;
}

export async function authenticateRequest(req, res, { now = new Date() } = {}) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) return null;

  const session = await AuthSession.findOne({
    tokenHash: hashValue(token),
    revokedAt: null,
    expiresAt: { $gt: now },
    absoluteExpiresAt: { $gt: now },
  });

  if (!session) {
    clearAuthCookie(res);
    return null;
  }

  const user = await findUserById(session.userId);
  if (!user) {
    session.revokedAt = now;
    await session.save();
    clearAuthCookie(res);
    return null;
  }

  const shouldTouch = now - new Date(session.lastSeenAt) >= AUTH_SESSION_DURATIONS.touchAfterMs;
  if (shouldTouch) {
    const idleMs = session.remembered
      ? AUTH_SESSION_DURATIONS.rememberedIdleMs
      : AUTH_SESSION_DURATIONS.standardIdleMs;
    const nextExpiresAt = new Date(Math.min(
      now.getTime() + idleMs,
      new Date(session.absoluteExpiresAt).getTime()
    ));

    session.lastSeenAt = now;
    session.expiresAt = nextExpiresAt;
    await session.save();
    res.cookie(AUTH_COOKIE_NAME, token, makeCookieOptions(nextExpiresAt.getTime() - now.getTime()));
  }

  return { session, user: toRequestUser(user), dbUser: user };
}

export async function revokeAuthSessionForRequest(req, res, { now = new Date() } = {}) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (token) {
    await AuthSession.updateOne(
      { tokenHash: hashValue(token), revokedAt: null },
      { $set: { revokedAt: now } }
    );
  }
  clearAuthCookie(res);
}

export async function revokeAuthSessionsForUser(userId, { exceptSessionId = null, now = new Date() } = {}) {
  const filter = { userId, revokedAt: null };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };

  await AuthSession.updateMany(filter, { $set: { revokedAt: now } });
}

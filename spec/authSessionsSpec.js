import {
  AUTH_SESSION_DURATIONS,
  computeAuthSessionExpiry,
  toRequestUser
} from '../server/services/authSessions.js';

describe('auth session helpers', () => {
  const now = new Date('2026-06-24T12:00:00.000Z');

  it('uses a one-day default auth session window', () => {
    const expiry = computeAuthSessionExpiry({ now });

    expect(expiry.expiresAt).toEqual(new Date(now.getTime() + AUTH_SESSION_DURATIONS.standardIdleMs));
    expect(expiry.absoluteExpiresAt).toEqual(new Date(now.getTime() + AUTH_SESSION_DURATIONS.standardAbsoluteMs));
    expect(expiry.maxAge).toBe(AUTH_SESSION_DURATIONS.standardIdleMs);
  });

  it('uses a longer persistent window when remember me is enabled', () => {
    const expiry = computeAuthSessionExpiry({ remembered: true, now });

    expect(expiry.expiresAt).toEqual(new Date(now.getTime() + AUTH_SESSION_DURATIONS.rememberedIdleMs));
    expect(expiry.absoluteExpiresAt).toEqual(new Date(now.getTime() + AUTH_SESSION_DURATIONS.rememberedAbsoluteMs));
    expect(expiry.maxAge).toBe(AUTH_SESSION_DURATIONS.rememberedIdleMs);
  });

  it('normalizes request users to stable public auth fields', () => {
    const user = toRequestUser({
      _id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      profilePic: '/avatar.png',
      bio: 'hello',
      streakLength: 7,
      preferredLang: 'en',
      preferredUiLang: 'fr',
      verified: true,
      twoFactorEnabled: false,
      password: 'secret'
    });

    expect(user).toEqual({
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      profilePic: '/avatar.png',
      bio: 'hello',
      streakLength: 7,
      preferredLang: 'en',
      preferredUiLang: 'fr',
      verified: true,
      twoFactorEnabled: false,
    });
  });
});

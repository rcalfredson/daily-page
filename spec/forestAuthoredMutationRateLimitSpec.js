import {
  buildForestAuthoredMutationRateLimiter,
  ForestAuthoredMutationRateLimitError
} from '../server/services/forestAuthoredMutationRateLimit.js';

const OWNER = '507f1f77bcf86cd799439011';
const OTHER_OWNER = '507f1f77bcf86cd799439012';

async function rateError(work) {
  try {
    await work();
  } catch (error) {
    return error;
  }
  throw new Error('Expected a rate-limit error.');
}

describe('forest authored-mutation operational rate limit', () => {
  it('allows bounded owner and session activity without retaining raw identifiers', () => {
    const enforce = buildForestAuthoredMutationRateLimiter({
      ownerLimit: 3,
      sessionLimit: 2,
      clock: () => new Date('2026-08-12T12:00:00.000Z')
    });

    expect(enforce({ ownerUserId: OWNER, authSessionId: 'session-one' })).toEqual({
      allowed: true
    });
    expect(enforce({ ownerUserId: OWNER, authSessionId: 'session-one' })).toEqual({
      allowed: true
    });
  });

  it('limits one session before the wider owner budget and reports bounded retry time', async () => {
    const enforce = buildForestAuthoredMutationRateLimiter({
      windowMs: 60_000,
      ownerLimit: 4,
      sessionLimit: 2,
      clock: () => new Date('2026-08-12T12:00:30.000Z')
    });
    enforce({ ownerUserId: OWNER, authSessionId: 'session-one' });
    enforce({ ownerUserId: OWNER, authSessionId: 'session-one' });

    const error = await rateError(() => enforce({
      ownerUserId: OWNER,
      authSessionId: 'session-one'
    }));

    expect(error).toEqual(jasmine.any(ForestAuthoredMutationRateLimitError));
    expect(error.code).toBe('AUTHORED_MUTATION_RATE_LIMITED');
    expect(error.retryAfterSeconds).toBe(60);
  });

  it('aggregates multiple sessions into the owner limit', async () => {
    const enforce = buildForestAuthoredMutationRateLimiter({
      ownerLimit: 2,
      sessionLimit: 2,
      clock: () => new Date('2026-08-12T12:00:00.000Z')
    });
    enforce({ ownerUserId: OWNER, authSessionId: 'session-one' });
    enforce({ ownerUserId: OWNER, authSessionId: 'session-two' });

    const error = await rateError(() => enforce({
      ownerUserId: OWNER,
      authSessionId: 'session-three'
    }));

    expect(error.code).toBe('AUTHORED_MUTATION_RATE_LIMITED');
  });

  it('starts fresh after the fixed window expires', () => {
    let now = new Date('2026-08-12T12:00:00.000Z');
    const enforce = buildForestAuthoredMutationRateLimiter({
      windowMs: 1_000,
      ownerLimit: 1,
      sessionLimit: 1,
      clock: () => now
    });
    enforce({ ownerUserId: OWNER, authSessionId: 'session-one' });
    now = new Date('2026-08-12T12:00:01.000Z');

    expect(enforce({ ownerUserId: OWNER, authSessionId: 'session-one' }).allowed).toBeTrue();
  });

  it('fails closed at bounded bucket capacity without evicting active protection', async () => {
    const enforce = buildForestAuthoredMutationRateLimiter({
      ownerLimit: 10,
      sessionLimit: 10,
      maximumBuckets: 2,
      clock: () => new Date('2026-08-12T12:00:00.000Z')
    });
    enforce({ ownerUserId: OWNER, authSessionId: 'session-one' });

    const error = await rateError(() => enforce({
      ownerUserId: OTHER_OWNER,
      authSessionId: 'session-two'
    }));

    expect(error.code).toBe('AUTHORED_MUTATION_RATE_CAPACITY_UNAVAILABLE');
  });

  it('rejects malformed authority and invalid operational configuration', async () => {
    expect(() => buildForestAuthoredMutationRateLimiter({ ownerLimit: 0 }))
      .toThrowError(ForestAuthoredMutationRateLimitError);
    const enforce = buildForestAuthoredMutationRateLimiter();
    const error = await rateError(() => enforce({
      ownerUserId: 'invalid',
      authSessionId: ''
    }));
    expect(error.code).toBe('INVALID_AUTHORED_MUTATION_RATE_INPUT');
  });
});

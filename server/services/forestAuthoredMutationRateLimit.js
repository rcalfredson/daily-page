import crypto from 'node:crypto';

export const FOREST_AUTHORED_MUTATION_RATE_WINDOW_MS = 60_000;
export const FOREST_AUTHORED_MUTATION_OWNER_LIMIT = 30;
export const FOREST_AUTHORED_MUTATION_SESSION_LIMIT = 20;
export const FOREST_AUTHORED_MUTATION_RATE_MAX_BUCKETS = 10_000;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export class ForestAuthoredMutationRateLimitError extends Error {
  constructor(code, retryAfterSeconds = null) {
    super(code);
    this.name = 'ForestAuthoredMutationRateLimitError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function fail(code, retryAfterSeconds = null) {
  throw new ForestAuthoredMutationRateLimitError(code, retryAfterSeconds);
}

function key(scope, value) {
  return `${scope}:${crypto.createHash('sha256').update(String(value)).digest('base64url')}`;
}

function validNow(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('INVALID_AUTHORED_MUTATION_RATE_DEPENDENCY');
  }
  return value.getTime();
}

export function buildForestAuthoredMutationRateLimiter({
  windowMs = FOREST_AUTHORED_MUTATION_RATE_WINDOW_MS,
  ownerLimit = FOREST_AUTHORED_MUTATION_OWNER_LIMIT,
  sessionLimit = FOREST_AUTHORED_MUTATION_SESSION_LIMIT,
  maximumBuckets = FOREST_AUTHORED_MUTATION_RATE_MAX_BUCKETS,
  clock = () => new Date()
} = {}) {
  for (const [name, value] of Object.entries({
    windowMs,
    ownerLimit,
    sessionLimit,
    maximumBuckets
  })) {
    if (!Number.isSafeInteger(value) || value < 1) {
      fail('INVALID_AUTHORED_MUTATION_RATE_DEPENDENCY');
    }
    if (name === 'maximumBuckets' && value < 2) {
      fail('INVALID_AUTHORED_MUTATION_RATE_DEPENDENCY');
    }
  }
  if (typeof clock !== 'function') {
    fail('INVALID_AUTHORED_MUTATION_RATE_DEPENDENCY');
  }
  const buckets = new Map();
  let lastPrunedAt = 0;

  function pruneExpired(nowMs) {
    for (const [bucketKey, bucket] of buckets) {
      if (nowMs - bucket.windowStartedAt >= windowMs) buckets.delete(bucketKey);
    }
  }

  function currentBucket(bucketKey, nowMs) {
    const existing = buckets.get(bucketKey);
    if (!existing || nowMs - existing.windowStartedAt >= windowMs) {
      return { windowStartedAt: nowMs, count: 0 };
    }
    return existing;
  }

  function retryAfter(bucket, nowMs) {
    return Math.max(1, Math.ceil(
      (bucket.windowStartedAt + windowMs - nowMs) / 1_000
    ));
  }

  return function enforceForestAuthoredMutationRateLimit({
    ownerUserId,
    authSessionId
  }) {
    const owner = String(ownerUserId || '').toLowerCase();
    const session = String(authSessionId || '');
    if (!OBJECT_ID_PATTERN.test(owner) || session.length < 1 || session.length > 128) {
      fail('INVALID_AUTHORED_MUTATION_RATE_INPUT');
    }
    const nowMs = validNow(clock());
    if (nowMs - lastPrunedAt >= windowMs || buckets.size >= maximumBuckets - 1) {
      pruneExpired(nowMs);
      lastPrunedAt = nowMs;
    }
    const ownerKey = key('owner', owner);
    const sessionKey = key('session', session);
    const ownerBucket = currentBucket(ownerKey, nowMs);
    const sessionBucket = currentBucket(sessionKey, nowMs);
    if (ownerBucket.count >= ownerLimit) {
      fail('AUTHORED_MUTATION_RATE_LIMITED', retryAfter(ownerBucket, nowMs));
    }
    if (sessionBucket.count >= sessionLimit) {
      fail('AUTHORED_MUTATION_RATE_LIMITED', retryAfter(sessionBucket, nowMs));
    }
    const missingBucketCount = Number(!buckets.has(ownerKey)) + Number(!buckets.has(sessionKey));
    if (buckets.size + missingBucketCount > maximumBuckets) {
      fail('AUTHORED_MUTATION_RATE_CAPACITY_UNAVAILABLE');
    }
    buckets.set(ownerKey, {
      windowStartedAt: ownerBucket.windowStartedAt,
      count: ownerBucket.count + 1
    });
    buckets.set(sessionKey, {
      windowStartedAt: sessionBucket.windowStartedAt,
      count: sessionBucket.count + 1
    });
    return Object.freeze({ allowed: true });
  };
}

export const enforceForestAuthoredMutationRateLimit =
  buildForestAuthoredMutationRateLimiter();

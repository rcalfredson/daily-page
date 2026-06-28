import cache from 'memory-cache';

const DEFAULT_TTL_MS = 2 * 1000;
const ENTRY_VERSION = 1;

// Prevent stampedes: if multiple requests ask for same key while it's missing,
// only run refresh() once and share the same Promise.
const inFlight = new Map();

function isManagedEntry(entry) {
  return entry && entry.__dailyPageCacheEntry === ENTRY_VERSION;
}

function readOptions(timeOrOpts) {
  if (typeof timeOrOpts === 'number') {
    return { ttlMs: timeOrOpts, jitterMs: 0, staleTtlMs: 0 };
  }

  return {
    ttlMs: timeOrOpts?.ttlMs ?? DEFAULT_TTL_MS,
    jitterMs: timeOrOpts?.jitterMs ?? 0,
    staleTtlMs: timeOrOpts?.staleTtlMs ?? 0,
  };
}

function calculateTtl(ttlMs, jitterMs) {
  return ttlMs + (jitterMs ? Math.floor(Math.random() * jitterMs) : 0);
}

/**
 * cache.get(key, refresh, args?, timeOrOpts?)
 *
 * Backward compatible:
 * - If timeOrOpts is a number -> treated as ttlMs (like before)
 * - If timeOrOpts is an object -> { ttlMs, jitterMs, staleTtlMs }
 *
 * staleTtlMs enables stale-while-revalidate. Fresh values return immediately.
 * Expired-but-stale values also return immediately while one background
 * refresh updates the cache for the next request.
 */
export async function get(key, refresh, args = [], timeOrOpts = DEFAULT_TTL_MS) {
  const { ttlMs, jitterMs, staleTtlMs } = readOptions(timeOrOpts);
  const finalTtlMs = calculateTtl(ttlMs, jitterMs);

  const existing = cache.get(key);
  if (existing !== null) {
    if (!isManagedEntry(existing)) return existing;

    if (Date.now() < existing.expiresAt) return existing.value;

    if (!inFlight.has(key)) {
      refreshInBackground(key, refresh, args, finalTtlMs, staleTtlMs);
    }

    return existing.value;
  }

  if (inFlight.has(key)) return inFlight.get(key);

  const p = (async () => {
    const value = await refresh(...args);
    putValue(key, value, finalTtlMs, staleTtlMs);
    return value;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, p);
  return p;
}

/**
 * Return a cached value immediately, including a stale value. On a cold miss,
 * start one deduplicated refresh and return undefined instead of making the
 * caller wait for it. This is useful for optional content on latency-sensitive
 * page renders.
 */
export function getNonBlocking(key, refresh, args = [], timeOrOpts = DEFAULT_TTL_MS) {
  const { ttlMs, jitterMs, staleTtlMs } = readOptions(timeOrOpts);
  const finalTtlMs = calculateTtl(ttlMs, jitterMs);
  const existing = cache.get(key);

  if (existing !== null) {
    if (!isManagedEntry(existing)) return existing;

    if (Date.now() >= existing.expiresAt && !inFlight.has(key)) {
      refreshInBackground(key, refresh, args, finalTtlMs, staleTtlMs);
    }

    return existing.value;
  }

  if (!inFlight.has(key)) {
    refreshInBackground(key, refresh, args, finalTtlMs, staleTtlMs);
  }

  return undefined;
}

function putValue(key, value, ttlMs, staleTtlMs) {
  if (!staleTtlMs) {
    cache.put(key, value, ttlMs);
    return;
  }

  cache.put(
    key,
    {
      __dailyPageCacheEntry: ENTRY_VERSION,
      value,
      expiresAt: Date.now() + ttlMs,
    },
    ttlMs + staleTtlMs
  );
}

function refreshInBackground(key, refresh, args, ttlMs, staleTtlMs) {
  const p = (async () => {
    const value = await refresh(...args);
    putValue(key, value, ttlMs, staleTtlMs);
    return value;
  })()
    .catch((error) => {
      console.error(`Background cache refresh failed for ${key}:`, error);
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, p);
}

// Optional helpers (handy later)
export function del(key) {
  cache.del(key);
}

export function clear() {
  cache.clear();
}

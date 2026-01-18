import cache from 'memory-cache';

const DEFAULT_TTL_MS = 2 * 1000;

// Prevent stampedes: if multiple requests ask for same key while it's missing,
// only run refresh() once and share the same Promise.
const inFlight = new Map();

/**
 * cache.get(key, refresh, args?, timeOrOpts?)
 *
 * Backward compatible:
 * - If timeOrOpts is a number -> treated as ttlMs (like before)
 * - If timeOrOpts is an object -> { ttlMs, jitterMs }
 */
export async function get(key, refresh, args = [], timeOrOpts = DEFAULT_TTL_MS) {
  const ttlMs =
    typeof timeOrOpts === 'number'
      ? timeOrOpts
      : (timeOrOpts?.ttlMs ?? DEFAULT_TTL_MS);

  const jitterMs =
    typeof timeOrOpts === 'object'
      ? (timeOrOpts?.jitterMs ?? 0)
      : 0;

  const finalTtlMs =
    ttlMs + (jitterMs ? Math.floor(Math.random() * jitterMs) : 0);

  const existing = cache.get(key);
  if (existing !== null) return existing;

  if (inFlight.has(key)) return inFlight.get(key);

  const p = (async () => {
    const value = await refresh(...args);
    cache.put(key, value, finalTtlMs);
    return value;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, p);
  return p;
}

// Optional helpers (handy later)
export function del(key) {
  cache.del(key);
}

export function clear() {
  cache.clear();
}


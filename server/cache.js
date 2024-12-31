import cache from 'memory-cache';

const MILLIS_IN_TWO_SEC = 2 * 1000;

export async function get(key, refresh, args = [], time = MILLIS_IN_TWO_SEC) {
  if (cache.get(key) === null) {
    cache.put(key, await refresh(...args), time);
  }
  return cache.get(key);
}

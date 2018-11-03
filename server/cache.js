const cache = require('memory-cache');

const MILLIS_IN_TWO_SEC = 2 * 1000;

async function get(key, refresh, args = []) {
  if (cache.get(key) === null) {
    cache.put(key, await refresh(...args), MILLIS_IN_TWO_SEC);
  }
  return cache.get(key);
}

module.exports = {
  get,
};

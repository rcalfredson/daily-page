const cache = require('memory-cache');

const MILLIS_IN_TWO_SEC = 2 * 1000;

async function get(key, refresh, args = [], time = MILLIS_IN_TWO_SEC) {
  if (cache.get(key) === null) {
    // console.log(`getting fresh for ${key}`);
    cache.put(key, await refresh(...args), time);
  }
  return cache.get(key);
}

module.exports = {
  get,
};

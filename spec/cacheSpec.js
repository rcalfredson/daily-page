import * as cache from '../server/services/cache.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('cache service', () => {
  afterEach(() => {
    cache.clear();
  });

  it('serves stale values while refreshing expired entries in the background', async () => {
    let calls = 0;
    const refresh = async () => {
      calls += 1;
      await delay(20);
      return calls;
    };

    expect(await cache.get('swr-key', refresh, [], { ttlMs: 5, staleTtlMs: 200 })).toBe(1);

    await delay(10);

    expect(await cache.get('swr-key', refresh, [], { ttlMs: 5, staleTtlMs: 200 })).toBe(1);
    expect(calls).toBe(2);

    await delay(30);

    expect(await cache.get('swr-key', refresh, [], { ttlMs: 50, staleTtlMs: 200 })).toBe(2);
  });

  it('shares one refresh promise on cold misses', async () => {
    let calls = 0;
    const refresh = async () => {
      calls += 1;
      await delay(5);
      return 'value';
    };

    const [first, second] = await Promise.all([
      cache.get('cold-key', refresh, [], { ttlMs: 50, staleTtlMs: 200 }),
      cache.get('cold-key', refresh, [], { ttlMs: 50, staleTtlMs: 200 })
    ]);

    expect(first).toBe('value');
    expect(second).toBe('value');
    expect(calls).toBe(1);
  });

  it('returns immediately and deduplicates refreshes on non-blocking cold misses', async () => {
    let calls = 0;
    const refresh = async () => {
      calls += 1;
      await delay(20);
      return 'ready';
    };

    expect(cache.getNonBlocking('optional-key', refresh, [], { ttlMs: 50 })).toBeUndefined();
    expect(cache.getNonBlocking('optional-key', refresh, [], { ttlMs: 50 })).toBeUndefined();
    expect(calls).toBe(1);

    await delay(30);

    expect(cache.getNonBlocking('optional-key', refresh, [], { ttlMs: 50 })).toBe('ready');
    expect(calls).toBe(1);
  });
});

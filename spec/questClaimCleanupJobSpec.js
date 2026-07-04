import { cleanUpExpiredQuestClaims } from '../server/services/cron.js';

describe('quest claim cleanup job', () => {
  it('drains full batches until fewer than the batch limit remain', async () => {
    const expire = jasmine.createSpy('expire').and.returnValues(
      Promise.resolve({ releasedUnattachedClaims: 60, withdrawnDrafts: 40 }),
      Promise.resolve({ releasedUnattachedClaims: 3, withdrawnDrafts: 2 })
    );

    const result = await cleanUpExpiredQuestClaims({ expire, batchSize: 100, maxBatches: 10 });

    expect(expire.calls.allArgs()).toEqual([[{ limit: 100 }], [{ limit: 100 }]]);
    expect(result).toEqual({
      releasedUnattachedClaims: 63,
      withdrawnDrafts: 42,
      batches: 2
    });
  });

  it('honors its batch cap when a large backlog remains', async () => {
    const expire = jasmine.createSpy('expire').and.resolveTo({
      releasedUnattachedClaims: 100,
      withdrawnDrafts: 0
    });

    const result = await cleanUpExpiredQuestClaims({ expire, batchSize: 100, maxBatches: 3 });

    expect(expire).toHaveBeenCalledTimes(3);
    expect(result.batches).toBe(3);
    expect(result.releasedUnattachedClaims).toBe(300);
  });
});

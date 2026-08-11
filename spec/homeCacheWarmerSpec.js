import {
  createHomeWarmCycleRunner,
  runWarmTaskBatches,
  selectHomeWarmLanguages
} from '../server/services/homeCacheWarmer.js';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('home cache warmer', () => {
  it('keeps primary languages and rotates bounded secondary batches', () => {
    const first = selectHomeWarmLanguages({
      cursor: 0,
      secondaryCount: 3,
      primaryLangs: ['en', 'es'],
      secondaryLangs: ['fr', 'de', 'it', 'pt'],
    });
    const second = selectHomeWarmLanguages({
      cursor: first.nextCursor,
      secondaryCount: 3,
      primaryLangs: ['en', 'es'],
      secondaryLangs: ['fr', 'de', 'it', 'pt'],
    });

    expect(first).toEqual({
      languages: ['en', 'es', 'fr', 'de', 'it'],
      nextCursor: 3,
    });
    expect(second).toEqual({
      languages: ['en', 'es', 'pt', 'fr', 'de'],
      nextCursor: 2,
    });
  });

  it('runs at most two warming tasks before waiting for refresh completion', async () => {
    let active = 0;
    let maxActive = 0;
    let waits = 0;
    const tasks = Array.from({ length: 5 }, (_, index) => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(2);
      active -= 1;
      return index;
    });

    const results = await runWarmTaskBatches(tasks, {
      concurrency: 2,
      waitForRefreshes: async () => { waits += 1; },
    });

    expect(maxActive).toBe(2);
    expect(waits).toBe(3);
    expect(results.map(result => result.value)).toEqual([0, 1, 2, 3, 4]);
  });

  it('skips overlapping cycles and resumes after the active cycle finishes', async () => {
    let releaseFirstWarm;
    const firstWarm = new Promise(resolve => { releaseFirstWarm = resolve; });
    let calls = 0;
    const runner = createHomeWarmCycleRunner({
      primaryLangs: ['en'],
      secondaryLangs: [],
      delayMs: 0,
      warmLanguage: async () => {
        calls += 1;
        if (calls === 1) await firstWarm;
      },
    });

    const firstCycle = runner.runCycle();
    await Promise.resolve();

    expect(await runner.runCycle()).toEqual({
      skipped: true,
      reason: 'already-running'
    });

    releaseFirstWarm();
    expect((await firstCycle).skipped).toBeFalse();
    expect((await runner.runCycle()).skipped).toBeFalse();
    expect(calls).toBe(2);
  });
});

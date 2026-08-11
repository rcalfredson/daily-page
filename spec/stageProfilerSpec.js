import {
  createStageProfiler,
  tagProfilingOptions
} from '../server/services/stageProfiler.js';

describe('stage profiler', () => {
  it('records successful stages as one structured log event', async () => {
    const timestamps = [100, 110, 135, 150];
    const logs = [];
    const profiler = createStageProfiler({
      scope: 'tag_detail',
      metadata: { tagName: 'performance' },
      enabled: true,
      clock: () => timestamps.shift(),
      random: () => 0,
      logger: message => logs.push(JSON.parse(message)),
    });

    const value = await profiler.measure(
      'tagged_blocks_query',
      async () => ['block'],
      rows => ({ returned: rows.length })
    );
    profiler.finish({ status: 'ok' });

    expect(value).toEqual(['block']);
    expect(logs.length).toBe(1);
    expect(logs[0]).toEqual(jasmine.objectContaining({
      event: 'request_stage_profile',
      scope: 'tag_detail',
      tagName: 'performance',
      totalMs: 50,
      status: 'ok',
    }));
    expect(logs[0].stages).toEqual([{
      name: 'tagged_blocks_query',
      status: 'ok',
      durationMs: 25,
      returned: 1,
    }]);
  });

  it('always logs sampled errors even below the slow threshold', async () => {
    const timestamps = [0, 1, 2, 3];
    const logs = [];
    const profiler = createStageProfiler({
      scope: 'tag_detail',
      enabled: true,
      slowMs: 100,
      clock: () => timestamps.shift(),
      random: () => 0,
      logger: message => logs.push(JSON.parse(message)),
    });

    await expectAsync(profiler.measure('trend_query', async () => {
      throw new TypeError('query failed');
    })).toBeRejectedWithError(TypeError, 'query failed');
    profiler.finish({ status: 'error', errorName: 'TypeError' });

    expect(logs.length).toBe(1);
    expect(logs[0].stages[0]).toEqual(jasmine.objectContaining({
      name: 'trend_query',
      status: 'error',
      errorName: 'TypeError',
    }));
  });

  it('parses bounded tag profiling environment options', () => {
    expect(tagProfilingOptions({
      PERF_TAGS: 'true',
      PERF_TAGS_SAMPLE_RATE: '2',
      PERF_TAGS_SLOW_MS: '-10',
    })).toEqual({ enabled: true, sampleRate: 1, slowMs: 0 });
  });
});

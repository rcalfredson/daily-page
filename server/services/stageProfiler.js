import { randomUUID } from 'crypto';

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function boundedNumber(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function defaultClock() {
  return Number(process.hrtime.bigint()) / 1e6;
}

export function tagProfilingOptions(env = process.env) {
  return {
    enabled: envFlag(env.PERF_TAGS),
    sampleRate: boundedNumber(env.PERF_TAGS_SAMPLE_RATE, 1, { min: 0, max: 1 }),
    slowMs: boundedNumber(env.PERF_TAGS_SLOW_MS, 0),
  };
}

export function createStageProfiler({
  scope,
  metadata = {},
  enabled = false,
  sampleRate = 1,
  slowMs = 0,
  clock = defaultClock,
  random = Math.random,
  logger = console.log,
} = {}) {
  const sampled = Boolean(enabled) && random() < sampleRate;
  const startedAt = sampled ? clock() : 0;
  const stages = [];
  let finished = false;

  async function measure(name, fn, describeResult = null) {
    if (!sampled) return fn();

    const stageStartedAt = clock();
    try {
      const value = await fn();
      const result = typeof describeResult === 'function'
        ? describeResult(value)
        : {};
      stages.push({
        name,
        status: 'ok',
        durationMs: Number((clock() - stageStartedAt).toFixed(1)),
        ...result,
      });
      return value;
    } catch (error) {
      stages.push({
        name,
        status: 'error',
        durationMs: Number((clock() - stageStartedAt).toFixed(1)),
        errorName: error?.name || 'Error',
      });
      throw error;
    }
  }

  function finish(extra = {}) {
    if (!sampled || finished) return;
    finished = true;

    const totalMs = Number((clock() - startedAt).toFixed(1));
    if (totalMs < slowMs && extra.status !== 'error') return;

    logger(JSON.stringify({
      event: 'request_stage_profile',
      scope,
      profileId: randomUUID(),
      totalMs,
      stages,
      ...metadata,
      ...extra,
    }));
  }

  return { measure, finish, sampled };
}

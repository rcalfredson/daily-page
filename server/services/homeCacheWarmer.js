export const PRIMARY_HOME_WARM_LANGS = Object.freeze(['en', 'es']);
export const SECONDARY_HOME_WARM_LANGS = Object.freeze([
  'fr', 'ru', 'id', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr',
  'nl', 'sv', 'no', 'da', 'fi', 'pl', 'cs', 'el', 'he', 'th', 'vi'
]);

export function selectHomeWarmLanguages({
  cursor = 0,
  secondaryCount = 3,
  primaryLangs = PRIMARY_HOME_WARM_LANGS,
  secondaryLangs = SECONDARY_HOME_WARM_LANGS,
} = {}) {
  if (!secondaryLangs.length || secondaryCount <= 0) {
    return { languages: [...primaryLangs], nextCursor: 0 };
  }

  const normalizedCursor = ((cursor % secondaryLangs.length) + secondaryLangs.length)
    % secondaryLangs.length;
  const selected = [];
  const count = Math.min(secondaryCount, secondaryLangs.length);

  for (let offset = 0; offset < count; offset += 1) {
    selected.push(secondaryLangs[(normalizedCursor + offset) % secondaryLangs.length]);
  }

  return {
    languages: [...primaryLangs, ...selected],
    nextCursor: (normalizedCursor + count) % secondaryLangs.length,
  };
}

export async function runWarmTaskBatches(tasks, {
  concurrency = 2,
  waitForRefreshes = async () => {},
} = {}) {
  const runnable = tasks.filter(task => typeof task === 'function');
  const batchSize = Math.max(1, Math.floor(concurrency));
  const results = [];

  for (let index = 0; index < runnable.length; index += batchSize) {
    const batch = runnable.slice(index, index + batchSize);
    results.push(...await Promise.allSettled(batch.map(task => task())));
    await waitForRefreshes();
  }

  return results;
}

export function createHomeWarmCycleRunner({
  warmLanguage,
  delay = ms => new Promise(resolve => setTimeout(resolve, ms)),
  delayMs = 1_000,
  secondaryCount = 3,
  primaryLangs = PRIMARY_HOME_WARM_LANGS,
  secondaryLangs = SECONDARY_HOME_WARM_LANGS,
  onStart = () => {},
} = {}) {
  let running = false;
  let cursor = 0;

  async function runCycle() {
    if (running) return { skipped: true, reason: 'already-running' };
    running = true;

    const selection = selectHomeWarmLanguages({
      cursor,
      secondaryCount,
      primaryLangs,
      secondaryLangs,
    });
    cursor = selection.nextCursor;
    const failures = [];

    try {
      onStart({ languages: selection.languages });
      for (const [index, language] of selection.languages.entries()) {
        try {
          await warmLanguage(language);
        } catch (error) {
          failures.push({ language, error });
        }

        if (index < selection.languages.length - 1 && delayMs > 0) {
          await delay(delayMs);
        }
      }

      return { skipped: false, languages: selection.languages, failures };
    } finally {
      running = false;
    }
  }

  return { runCycle, isRunning: () => running };
}

import { CronJob } from 'cron';
import { config } from '../../config/config.js';
import { cleanUpExpiredSessions } from '../db/sessionService.js';
import { expireQuestClaims } from '../db/questSubmissionService.js';
import { getFeaturedContent } from './featuredContent.js';
import { startBlockJobs } from './blockService.js';
import { cleanUpAccountDeletionMedia } from './accountDeletionMedia.js';
import { cleanUpAccountDeletionForests } from './accountDeletionForestCleanup.js';
import {
  scheduleConvergedAccountDeletionEvidenceExpiries
} from './accountDeletionEvidence.js';
import {
  processForestOwnerGroupReconciliationJobs
} from './forestOwnerGroupReconciliationQueue.js';
import {
  processForestOwnerConvergenceSweeps
} from './forestOwnerConvergenceSweep.js';

// Home cache warmers
import {
  getTrendingTagsWithFallback,
  getTopBlocksWithFallback,
  getGlobalBlockStats,
  getTotalTags,
  getFeaturedRoomWithFallback,
  getFeaturedBlockWithFallback,
} from '../db/blockService.js';
import { getTotalRooms } from '../db/roomService.js';
import {
  getRecentCommentActivity,
  getRecentReactionActivity
} from '../db/homeActivityService.js';
import {
  getHomeActivitySince,
  getHomeTopBlocksOptions,
  getHomeTrendingTagsOptions
} from './homepage.js';
import * as cache from './cache.js';
import {
  createHomeWarmCycleRunner,
  runWarmTaskBatches
} from './homeCacheWarmer.js';

const HOME_WARM_QUERY_CONCURRENCY = 2;
const HOME_WARM_LANGUAGE_DELAY_MS = 1_000;

async function warmHomeCache({ preferredLang }) {
  const activitySince = getHomeActivitySince();

  // Start at most two cache operations together. After each batch, wait for any
  // stale-while-revalidate work they triggered before consuming more DB slots.
  const results = await runWarmTaskBatches([
    config.homeShowFeaturedPost
      ? () => getFeaturedBlockWithFallback({ preferredLang })
      : null,
    () => getTrendingTagsWithFallback(getHomeTrendingTagsOptions(preferredLang)),
    config.homeShowFeaturedRoom ? () => getFeaturedRoomWithFallback() : null,
    () => getGlobalBlockStats(),
    () => getTotalTags(),
    () => getTotalRooms(),
    () => getTopBlocksWithFallback(
      getHomeTopBlocksOptions(preferredLang, config.homeSourceFallbackLimit)
    ),
    () => getRecentCommentActivity({ limit: 5, lang: preferredLang, since: activitySince }),
    () => getRecentReactionActivity({ limit: 5, lang: preferredLang, since: activitySince }),
  ], {
    concurrency: HOME_WARM_QUERY_CONCURRENCY,
    waitForRefreshes: cache.waitForInFlightRefreshes,
  });

  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) {
    throw new AggregateError(
      failures.map(result => result.reason),
      `Failed ${failures.length} homepage cache warming tasks for ${preferredLang}`
    );
  }

  return results;
}

const homeWarmCycle = createHomeWarmCycleRunner({
  warmLanguage: preferredLang => warmHomeCache({ preferredLang }),
  delayMs: HOME_WARM_LANGUAGE_DELAY_MS,
  onStart: ({ languages }) => {
    console.info('[home-cache-warm] started', { languages });
  },
});

export async function runHomeCacheWarmCycle() {
  const startedAt = Date.now();
  const result = await homeWarmCycle.runCycle();

  if (result.skipped) {
    console.warn('[home-cache-warm] skipped overlapping cycle');
    return result;
  }

  console.info('[home-cache-warm] completed', {
    durationMs: Date.now() - startedAt,
    languages: result.languages,
    failures: result.failures.map(({ language, error }) => ({
      language,
      error: error?.name || 'Error'
    })),
  });
  return result;
}

export async function cleanUpExpiredQuestClaims({
  expire = expireQuestClaims,
  batchSize = 100,
  maxBatches = 10
} = {}) {
  const totals = {
    releasedUnattachedClaims: 0,
    withdrawnDrafts: 0,
    batches: 0
  };

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await expire({ limit: batchSize });
    const released = result?.releasedUnattachedClaims || 0;
    const withdrawn = result?.withdrawnDrafts || 0;
    const processed = released + withdrawn;

    totals.releasedUnattachedClaims += released;
    totals.withdrawnDrafts += withdrawn;
    totals.batches += 1;

    if (processed < batchSize) break;
  }

  return totals;
}

const jobs = [
  new CronJob('3 * * * *', async () => {
    await cleanUpExpiredSessions();
  }, null),

  new CronJob('0 * * * *', async () => {
    await getFeaturedContent();
  }, null),

  // Expiry is also checked lazily during claim operations. This bounded
  // background drain ensures abandoned claims clear without user activity.
  new CronJob('13 * * * *', async () => {
    try {
      await cleanUpExpiredQuestClaims();
    } catch (error) {
      console.error('Failed to clean up expired quest claims:', error);
    }
  }, null),

  new CronJob('23 * * * *', async () => {
    try {
      await cleanUpAccountDeletionMedia();
    } catch (error) {
      console.error('Failed account-deletion media cleanup job:', error?.name || 'Error');
    }
  }, null),

  new CronJob('29 * * * *', async () => {
    try {
      await cleanUpAccountDeletionForests();
    } catch (error) {
      console.error('Failed account-deletion forest cleanup job:', error?.name || 'Error');
    }
  }, null),

  new CronJob('37 * * * *', async () => {
    try {
      await scheduleConvergedAccountDeletionEvidenceExpiries();
    } catch (error) {
      console.error('Failed account-deletion evidence expiry job:', error?.name || 'Error');
    }
  }, null),

  new CronJob('* * * * *', async () => {
    try {
      await processForestOwnerGroupReconciliationJobs();
    } catch (error) {
      console.error('Failed forest owner-group reconciliation job:', {
        error: error?.name || 'Error'
      });
    }
  }, null),

  new CronJob('*/5 * * * *', async () => {
    try {
      await processForestOwnerConvergenceSweeps();
    } catch (error) {
      console.error('Failed forest owner convergence sweep job:', {
        error: error?.name || 'Error'
      });
    }
  }, null),

  // Warm primary languages plus a rotating secondary batch every 2 minutes.
  // The guarded runner prevents overlap and applies real refresh backpressure.
  new CronJob('*/2 * * * *', async () => {
    await runHomeCacheWarmCycle();
  }, null),
];

export function startJobs() {
  jobs.forEach((job) => job.start());
  startBlockJobs();

  // Startup uses the same bounded, non-overlapping rotation as scheduled work.
  setTimeout(() => runHomeCacheWarmCycle().catch(console.error), 1_000);
}

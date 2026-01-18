import { CronJob } from 'cron';
import { cleanUpExpiredSessions } from '../db/sessionService.js';
import { getFeaturedContent } from './featuredContent.js';
import { startBlockJobs } from './blockService.js';

// Home cache warmers
import {
  getTrendingTagsWithFallback,
  getTopBlocksWithFallback,
  getGlobalBlockStats,
  getTotalTags,
  getFeaturedRoomWithFallback,
} from '../db/blockService.js';
import { getTotalRooms } from '../db/roomService.js';

const HOME_LANGS = ['en', 'es'];

async function warmHomeCache({ preferredLang }) {
  // Settled so one failure doesn’t prevent other keys from warming
  await Promise.allSettled([
    getTrendingTagsWithFallback({ limit: 10, sortBy: 'totalBlocks' }),
    getFeaturedRoomWithFallback(),
    getGlobalBlockStats(),
    getTotalTags(),
    getTotalRooms(),
    getTopBlocksWithFallback({ lockedOnly: false, limit: 20, preferredLang }),
  ]);
}

const jobs = [
  new CronJob('3 * * * *', async () => {
    await cleanUpExpiredSessions();
  }, null),

  new CronJob('0 * * * *', async () => {
    await getFeaturedContent();
  }, null),

  // Warm homepage caches every 2 minutes.
  // Stagger language warms slightly to avoid a tiny spike.
  new CronJob('*/2 * * * *', async () => {
    for (const lang of HOME_LANGS) {
      await warmHomeCache({ preferredLang: lang });
      // small stagger (250ms) between langs
      await new Promise(r => setTimeout(r, 250));
    }
  }, null),
];

export function startJobs() {
  jobs.forEach((job) => job.start());
  startBlockJobs();

  // Warm soon after startup (hit both langs close to boot).
  // Stagger a touch so they don't pile up with other startup work.
  setTimeout(() => warmHomeCache({ preferredLang: 'en' }).catch(console.error), 1_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'es' }).catch(console.error), 1_500);
}

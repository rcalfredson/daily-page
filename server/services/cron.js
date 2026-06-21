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
  getFeaturedBlockWithFallback,
} from '../db/blockService.js';
import { getTotalRooms } from '../db/roomService.js';
import {
  getRecentCommentActivity,
  getRecentReactionActivity
} from '../db/homeActivityService.js';

const HOME_LANGS = ['en', 'es', 'fr', 'ru', 'id', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'cs', 'el', 'he'];

async function warmHomeCache({ preferredLang }) {
  // Settled so one failure doesn’t prevent other keys from warming
  await Promise.allSettled([
    getFeaturedBlockWithFallback({ preferredLang }),
    getTrendingTagsWithFallback({ limit: 10, sortBy: 'totalBlocks' }),
    getFeaturedRoomWithFallback(),
    getGlobalBlockStats(),
    getTotalTags(),
    getTotalRooms(),
    getTopBlocksWithFallback({ lockedOnly: false, limit: 20, preferredLang }),
    getRecentCommentActivity({ limit: 5, lang: preferredLang }),
    getRecentReactionActivity({ limit: 5, lang: preferredLang }),
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
  setTimeout(() => warmHomeCache({ preferredLang: 'fr' }).catch(console.error), 2_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'ru' }).catch(console.error), 2_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'id' }).catch(console.error), 3_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'de' }).catch(console.error), 3_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'it' }).catch(console.error), 4_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'pt' }).catch(console.error), 4_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'zh' }).catch(console.error), 5_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'ja' }).catch(console.error), 5_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'ko' }).catch(console.error), 6_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'ar' }).catch(console.error), 6_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'hi' }).catch(console.error), 7_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'tr' }).catch(console.error), 7_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'nl' }).catch(console.error), 8_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'sv' }).catch(console.error), 8_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'no' }).catch(console.error), 9_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'da' }).catch(console.error), 9_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'fi' }).catch(console.error), 10_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'pl' }).catch(console.error), 10_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'cs' }).catch(console.error), 11_000);
  setTimeout(() => warmHomeCache({ preferredLang: 'el' }).catch(console.error), 11_500);
  setTimeout(() => warmHomeCache({ preferredLang: 'he' }).catch(console.error), 12_000);
}

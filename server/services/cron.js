import { CronJob } from 'cron';
import { cleanUpExpiredSessions } from '../db/sessionService.js';
import { getFeaturedContent } from './featuredContent.js';
import { startBlockJobs } from './blockService.js';

const jobs = [
  new CronJob('3 * * * *', async () => {
    await cleanUpExpiredSessions();
  }, null),
  new CronJob('0 * * * *', async () => {
    await getFeaturedContent();
  }, null),
];

export function startJobs() {
  jobs.forEach((job) => {
    job.start();
  });
  startBlockJobs();
}

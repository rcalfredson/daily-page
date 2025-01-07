import { CronJob } from 'cron';
import { cleanUpOldPeerIds } from '../db/mongo.js';
import { getFeaturedContent } from './featuredContent.js';

const jobs = [
  new CronJob('3 * * * *', async () => {
    await cleanUpOldPeerIds();
  }, null),
  new CronJob('0 * * * *', async () => {
    await getFeaturedContent();
  }, null),
];

export function startJobs() {
  jobs.forEach((job) => {
    job.start();
  });
}

import { CronJob } from 'cron';
import { cleanUpOldPeerIds } from './mongo.js';

const jobs = [new CronJob('3 * * * *', async () => {
  await cleanUpOldPeerIds();
}, null)];

export function startJobs() {
  jobs.forEach((job) => {
    job.start();
  });
}

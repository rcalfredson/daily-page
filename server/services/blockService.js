import { CronJob } from 'cron';
import Block from '../db/models/Block.js';

// ✨ Lock blocks based on inactivity.
// Set the inactivity threshold here;
// 1 week = 7 days * 24 hours * 60 minutes * 60 seconds * 1000 ms.
const INACTIVITY_THRESHOLD = 7 * 24 * 60 * 60 * 1000;

const lockInactiveBlocksJob = new CronJob(
  '*/5 * * * *', // Every 5 minutes.
  async () => {
    try {
      const cutoff = new Date(Date.now() - INACTIVITY_THRESHOLD);

      const result = await Block.updateMany(
        {
          status: 'in-progress',
          updatedAt: { $lt: cutoff }
        },
        {
          $set: { status: 'locked', lockedAt: new Date() }
        }
      );
      console.log(`Inactivity Lock Job (threshold: 7d): Locked ${result?.modifiedCount ?? 0} blocks`);
    } catch (err) {
      console.error('Error in Inactivity Lock Job:', err);
    }
  },
  null,
  true,
  'UTC'
);

export function startBlockJobs() {
  lockInactiveBlocksJob.start();
}

import { CronJob } from 'cron';
import Block from '../db/models/Block.js';

// ✨ Job 1: Lock blocks at 00:00 UTC daily.
// This job finds all blocks with status "in-progress" that were created before today
// and updates them to "locked" with a timestamp.
const lockBlocksDailyJob = new CronJob(
  '0 0 * * *', // At 00:00 UTC every day.
  async () => {
    try {
      // Get today's date at UTC midnight.
      const todayUTC = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');

      const result = await Block.updateMany(
        {
          status: 'in-progress',
          createdAt: { $lt: todayUTC }
        },
        {
          $set: { status: 'locked', lockedAt: new Date() }
        }
      );
      console.log(`Daily Lock Job: Locked ${result?.modifiedCount ?? 0} blocks`);
    } catch (err) {
      console.error('Error in Daily Lock Job:', err);
    }
  },
  null,
  true,
  'UTC'
);

// ✨ Job 2: Lock blocks based on inactivity.
// Set the inactivity threshold here; 1 hour = 60 * 60 * 1000 ms.
const INACTIVITY_THRESHOLD = 60 * 60 * 1000;

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
      console.log(`Inactivity Lock Job: Locked ${result?.modifiedCount ?? 0} blocks`);
    } catch (err) {
      console.error('Error in Inactivity Lock Job:', err);
    }
  },
  null,
  true,
  'UTC'
);

export function startBlockJobs() {
  lockBlocksDailyJob.start();
  lockInactiveBlocksJob.start();
}

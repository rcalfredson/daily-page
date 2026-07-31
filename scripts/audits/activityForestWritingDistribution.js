import mongoose from 'mongoose';

import { initMongooseConnection } from '../../server/db/mongoose.js';
import Block from '../../server/db/models/Block.js';
import User from '../../server/db/models/User.js';
import {
  assertPrivacySafeActivityForestAudit,
  summarizeActivityForestWritingAudit
} from '../lib/activityForestWritingAudit.js';

const AUTHORIZATION_FLAG = '--authorized-production-read';
const MINIMUM_BUCKET_SIZE = 5;

function printUsage() {
  console.log(
    `Usage: node scripts/audits/activityForestWritingDistribution.js --prod ${AUTHORIZATION_FLAG}`
  );
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help')) {
    printUsage();
    return;
  }
  if (!args.has('--prod') || !args.has(AUTHORIZATION_FLAG)) {
    throw new Error(
      `Refusing production audit without --prod and ${AUTHORIZATION_FLAG}.`
    );
  }

  await initMongooseConnection({ useProductionDb: true });
  if (mongoose.connection.name !== 'daily-page') {
    throw new Error('Refusing audit on an unexpected database.');
  }

  const currentUserIds = new Set();
  for await (const user of User.collection.find({}, {
    projection: { _id: 1 },
    batchSize: 500
  })) {
    currentUserIds.add(String(user._id));
  }

  const records = [];
  for await (const block of Block.collection.find({}, {
    projection: {
      _id: 1,
      userId: 1,
      authorshipState: 1,
      groupId: 1,
      lang: 1,
      status: 1,
      visibility: 1,
      createdAt: 1,
      roomId: 1
    },
    batchSize: 500
  })) {
    records.push(block);
  }

  const report = assertPrivacySafeActivityForestAudit(
    summarizeActivityForestWritingAudit({
      records,
      currentUserIds,
      minimumBucketSize: MINIMUM_BUCKET_SIZE
    })
  );
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error('Activity Forest production writing audit failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));

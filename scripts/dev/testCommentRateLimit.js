// scripts/dev/testCommentRateLimit.js
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import { enforceAndRecordCommentRateLimit } from '../../server/db/rateLimitService.js';

async function main() {
  const userId = process.argv[2] || 'seed-user';
  const ip = process.argv[3] || '127.0.0.1';

  try {
    await initMongooseConnection();

    console.log('Test 1: first comment (should PASS)');
    await enforceAndRecordCommentRateLimit({ userId, ip, hasUrl: false });
    console.log('✅ PASS');

    console.log('Test 2: immediate second comment (should FAIL with 429)');
    try {
      await enforceAndRecordCommentRateLimit({ userId, ip, hasUrl: false });
      console.log('❌ UNEXPECTED PASS (rate limit not firing)');
    } catch (e) {
      console.log(`✅ Expected failure: ${e.status} ${e.message}`);
    }

    console.log('Test 3: URL comment (should PASS if not already blocked by IP rule)');
    await enforceAndRecordCommentRateLimit({ userId: `${userId}-url`, ip, hasUrl: true });
    console.log('✅ PASS');

    console.log('Test 4: second URL comment (should FAIL with 429)');
    try {
      await enforceAndRecordCommentRateLimit({ userId: `${userId}-url2`, ip, hasUrl: true });
      console.log('❌ UNEXPECTED PASS (URL rate limit not firing)');
    } catch (e) {
      console.log(`✅ Expected failure: ${e.status} ${e.message}`);
    }
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
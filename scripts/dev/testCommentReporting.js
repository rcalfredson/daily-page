// scripts/dev/testCommentReporting.js
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import BlockComment from '../../server/db/models/BlockComment.js';
import { reportComment } from '../../server/db/commentService.js';

async function main() {
  const blockId = process.argv[2] || 'test-block-id';
  const authorId = process.argv[3] || 'author-user';

  // reporters (3 unique to hit threshold)
  const reporters = [
    process.argv[4] || 'reporter-1',
    process.argv[5] || 'reporter-2',
    process.argv[6] || 'reporter-3',
  ];

  try {
    await initMongooseConnection();

    // Create a fresh visible comment
    const comment = await BlockComment.create({
      blockId: String(blockId),
      userId: String(authorId),
      body: 'Reporting test comment (please ignore).',
      status: 'visible',
      editedAt: null,
      deletedAt: null,
      hiddenAt: null,
    });

    const commentId = comment._id.toString();
    console.log('Created comment:', { commentId, blockId, authorId });

    // Self-report should fail
    console.log('\nTest 1: self-report (should FAIL 400)');
    try {
      await reportComment({ commentId, reporterId: authorId });
      console.log('❌ UNEXPECTED PASS (self-report allowed?)');
    } catch (e) {
      console.log(`✅ Expected failure: ${e.status} ${e.message}`);
    }

    // Report #1
    console.log('\nTest 2: report #1 (should be hidden=false, count=1)');
    console.log(await reportComment({ commentId, reporterId: reporters[0] }));

    // Report #2
    console.log('\nTest 3: report #2 (should be hidden=false, count=2)');
    console.log(await reportComment({ commentId, reporterId: reporters[1] }));

    // Report #3 triggers hide
    console.log('\nTest 4: report #3 (should be hidden=true, count=3)');
    console.log(await reportComment({ commentId, reporterId: reporters[2] }));

    // Duplicate report should not increment
    console.log('\nTest 5: duplicate report by reporter-1 (should stay count=3)');
    console.log(await reportComment({ commentId, reporterId: reporters[0] }));

    // Fetch final comment state
    const final = await BlockComment.findById(commentId).lean();
    console.log('\nFinal comment state:', {
      status: final?.status,
      hiddenAt: final?.hiddenAt,
      deletedAt: final?.deletedAt,
    });

    // Optional cleanup (uncomment if you want it ephemeral)
    // await BlockComment.deleteOne({ _id: commentId });
    // console.log('\nCleaned up comment:', commentId);

  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});

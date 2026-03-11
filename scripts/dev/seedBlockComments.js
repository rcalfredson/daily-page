import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import Block from '../../server/db/models/Block.js';
import BlockComment from '../../server/db/models/BlockComment.js';
import User from '../../server/db/models/User.js';

function usage() {
  console.log('Usage: node scripts/dev/seedBlockComments.js <blockId> [count=21]');
  console.log('Example: node scripts/dev/seedBlockComments.js 699bb0011e9d3b2c0919af81 21');
}

function buildCommentBody(index, blockTitle) {
  const samples = [
    'This is a seeded dev comment for testing the block-view comments UI.',
    'Checking spacing, timestamps, and SSR rendering on the block page.',
    'This one exists mainly to help exercise the load-more state.',
    'The conversation styling feels closer to notes under a piece of writing.',
    'This seeded comment should make it easier to verify pagination behavior.'
  ];

  return `Seed comment ${index + 1}: ${samples[index % samples.length]} Block: ${blockTitle}.`;
}

async function main() {
  const blockId = process.argv[2];
  const countArg = process.argv[3];
  const count = Math.max(1, Number.parseInt(countArg || '21', 10) || 21);

  if (!blockId) {
    usage();
    process.exitCode = 1;
    return;
  }

  try {
    await initMongooseConnection();

    const block = await Block.findById(blockId).lean();
    if (!block) {
      throw new Error(`Block not found: ${blockId}`);
    }

    const users = await User.find({})
      .select({ username: 1 })
      .sort({ createdAt: 1, _id: 1 })
      .limit(Math.min(count, 50))
      .lean();

    if (!users.length) {
      throw new Error('No users found in the dev database. Create at least one user before seeding comments.');
    }

    const baseTime = Date.now() - (count * 60 * 1000);
    const docs = Array.from({ length: count }, (_, index) => {
      const author = users[index % users.length];
      const createdAt = new Date(baseTime + (index * 60 * 1000));

      return {
        blockId: String(block._id),
        userId: String(author._id),
        body: buildCommentBody(index, block.title),
        status: 'visible',
        editedAt: null,
        deletedAt: null,
        hiddenAt: null,
        createdAt,
        updatedAt: createdAt
      };
    });

    const inserted = await BlockComment.insertMany(docs);

    console.log('Seeded block comments:', {
      blockId: String(block._id),
      blockTitle: block.title,
      count: inserted.length,
      distinctAuthorsUsed: Math.min(users.length, count),
      firstCommentId: inserted[0]?._id?.toString(),
      lastCommentId: inserted[inserted.length - 1]?._id?.toString()
    });
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});

import BlockComment from './models/BlockComment.js';

export async function getCommentsForBlock({ blockId, limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));

  return BlockComment
    .find({ blockId: String(blockId), status: 'visible', deletedAt: null })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .lean();
}

export async function createComment({ blockId, userId, body }) {
  const trimmed = String(body || '').trim();

  if (!trimmed) {
    const err = new Error('Comment body required.');
    err.status = 400;
    throw err;
  }

  if (trimmed.length > 1500) {
    const err = new Error('Comment too long (max 1500 characters).');
    err.status = 400;
    throw err;
  }

  const doc = await BlockComment.create({
    blockId: String(blockId),
    userId: String(userId),
    body: trimmed,
    status: 'visible',
    deletedAt: null,
    editedAt: null
  });

  // keep response lean & consistent
  return doc.toObject();
}

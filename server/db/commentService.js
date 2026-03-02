// server/db/commentService.js
import BlockComment from './models/BlockComment.js';

export async function getCommentsForBlock({ blockId, limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));

  return BlockComment
    .find({ blockId: String(blockId), status: 'visible', deletedAt: null })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .lean();
}

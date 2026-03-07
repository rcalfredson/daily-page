import BlockComment from './models/BlockComment.js';
import CommentReport from './models/CommentReport.js';

const REPORT_HIDE_THRESHOLD = 3;

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
    editedAt: null,
    hiddenAt: null,
  });

  // keep response lean & consistent
  return doc.toObject();
}

export async function reportComment({ commentId, reporterId }) {
  const cid = String(commentId);
  const rid = String(reporterId);

  // Ensure comment exists
  const comment = await BlockComment.findById(cid);
  if (!comment || comment.deletedAt) {
    const err = new Error('Comment not found.');
    err.status = 404;
    throw err;
  }

  // No self-reporting
  if (String(comment.userId) === rid) {
    const err = new Error('You cannot report your own comment.');
    err.status = 400;
    throw err;
  }

  // Create report (idempotent)
  try {
    await CommentReport.create({
      commentId: cid,
      reporterId: rid,
      createdAt: new Date(),
    });
  } catch (e) {
    // Duplicate report is fine: treat as success
    if (e?.code !== 11000) {
      throw e;
    }
  }

  // Count unique reporters
  const reportCount = await CommentReport.countDocuments({ commentId: cid });

  // Auto-hide if threshold reached
  let hidden = false;
  if (reportCount >= REPORT_HIDE_THRESHOLD && comment.status !== 'hidden') {
    comment.status = 'hidden';
    comment.hiddenAt = new Date();
    await comment.save();
    hidden = true;
  } else if (comment.status === 'hidden') {
    hidden = true;
  }

  return { reported: true, hidden, reportCount };
}

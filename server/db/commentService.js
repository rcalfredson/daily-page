import BlockComment from './models/BlockComment.js';
import CommentReport from './models/CommentReport.js';
import User from './models/User.js';
import mongoose from 'mongoose';

const REPORT_HIDE_THRESHOLD = 3;

function buildAuthorProfilePath(username) {
  return username ? `/users/${encodeURIComponent(username)}` : null;
}

export async function getCommentsForBlock({ blockId, limit = 20, offset = 0 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const safeOffset = Math.max(0, Number(offset) || 0);

  return BlockComment
    .find({ blockId: String(blockId), status: 'visible', deletedAt: null })
    .sort({ createdAt: 1 })
    .skip(safeOffset)
    .limit(safeLimit)
    .lean();
}

export async function getCommentsForBlockView({ blockId, limit = 20, offset = 0 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const filter = { blockId: String(blockId), status: 'visible', deletedAt: null };

  const [rawComments, total] = await Promise.all([
    BlockComment
      .find(filter)
      .sort({ createdAt: 1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean(),
    BlockComment.countDocuments(filter)
  ]);

  const userIds = [...new Set(rawComments.map((comment) => String(comment.userId)).filter(Boolean))];
  const validUserIds = userIds.filter((userId) => mongoose.isValidObjectId(userId));
  const users = validUserIds.length
    ? await User.find({ _id: { $in: validUserIds } }).select({ username: 1 }).lean()
    : [];

  const usernamesById = new Map(
    users.map((user) => [String(user._id), user.username])
  );

  const comments = rawComments.map((comment) => ({
    ...comment,
    authorUsername: usernamesById.get(String(comment.userId)) || (
      mongoose.isValidObjectId(comment.userId) ? null : String(comment.userId)
    ),
    authorProfilePath: usernamesById.has(String(comment.userId))
      ? buildAuthorProfilePath(usernamesById.get(String(comment.userId)))
      : null,
  }));

  return {
    comments,
    total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore: safeOffset + comments.length < total,
  };
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

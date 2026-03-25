import BlockComment from './models/BlockComment.js';
import CommentReport from './models/CommentReport.js';
import User from './models/User.js';
import mongoose from 'mongoose';

const REPORT_HIDE_THRESHOLD = 3;

function buildAuthorProfilePath(username) {
  return username ? `/users/${encodeURIComponent(username)}` : null;
}

function normalizeCommentSortDir(sortDir) {
  return sortDir === 'desc' ? 'desc' : 'asc';
}

function normalizeParentCommentId(parentCommentId) {
  const value = String(parentCommentId || '').trim();
  return value || null;
}

function normalizeViewerUserId(viewerUserId) {
  const value = String(viewerUserId || '').trim();
  return value || null;
}

function serializeCommentForViewer(comment, usernamesById, viewerUserId) {
  const normalizedViewerUserId = normalizeViewerUserId(viewerUserId);
  const normalizedUserId = String(comment.userId || '');

  return {
    ...comment,
    authorUsername: usernamesById.get(normalizedUserId) || (
      mongoose.isValidObjectId(normalizedUserId) ? null : normalizedUserId
    ),
    authorProfilePath: usernamesById.has(normalizedUserId)
      ? buildAuthorProfilePath(usernamesById.get(normalizedUserId))
      : null,
    ownedByViewer: Boolean(normalizedViewerUserId && normalizedViewerUserId === normalizedUserId),
  };
}

async function getOwnedVisibleComment({ commentId, userId }) {
  const comment = await BlockComment.findById(String(commentId));
  if (!comment || comment.deletedAt || comment.status !== 'visible') {
    const err = new Error('Comment not found.');
    err.status = 404;
    throw err;
  }

  if (String(comment.userId) !== String(userId)) {
    const err = new Error('You can only manage your own comments.');
    err.status = 403;
    throw err;
  }

  return comment;
}

async function resolveReplyParent({ blockId, parentCommentId }) {
  if (!parentCommentId) {
    return null;
  }

  const parent = await BlockComment.findById(String(parentCommentId)).lean();

  if (!parent || parent.deletedAt || parent.status !== 'visible') {
    const err = new Error('Parent comment not found.');
    err.status = 404;
    throw err;
  }

  if (String(parent.blockId) !== String(blockId)) {
    const err = new Error('Parent comment does not belong to this block.');
    err.status = 400;
    throw err;
  }

  if (parent.parentCommentId) {
    const err = new Error('Replies can only target top-level comments.');
    err.status = 400;
    throw err;
  }

  return parent;
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

export async function getCommentsForBlockView({
  blockId,
  limit = 20,
  offset = 0,
  sortDir = 'asc',
  viewerUserId = null
}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeSortDir = normalizeCommentSortDir(sortDir);
  const sortOrder = safeSortDir === 'desc' ? -1 : 1;
  const baseFilter = { blockId: String(blockId), status: 'visible', deletedAt: null };
  const topLevelFilter = { ...baseFilter, parentCommentId: null };

  const [rawTopLevelComments, total, topLevelTotal] = await Promise.all([
    BlockComment
      .find(topLevelFilter)
      .sort({ createdAt: sortOrder, _id: sortOrder })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean(),
    BlockComment.countDocuments(baseFilter),
    BlockComment.countDocuments(topLevelFilter)
  ]);

  const parentCommentIds = rawTopLevelComments.map((comment) => String(comment._id));
  const rawReplies = parentCommentIds.length
    ? await BlockComment
        .find({ ...baseFilter, parentCommentId: { $in: parentCommentIds } })
        .sort({ createdAt: sortOrder, _id: sortOrder })
        .lean()
    : [];

  const rawComments = [...rawTopLevelComments, ...rawReplies];
  const userIds = [...new Set(rawComments.map((comment) => String(comment.userId)).filter(Boolean))];
  const validUserIds = userIds.filter((userId) => mongoose.isValidObjectId(userId));
  const users = validUserIds.length
    ? await User.find({ _id: { $in: validUserIds } }).select({ username: 1 }).lean()
    : [];

  const usernamesById = new Map(
    users.map((user) => [String(user._id), user.username])
  );

  const commentsWithAuthors = rawComments.map((comment) => (
    serializeCommentForViewer(comment, usernamesById, viewerUserId)
  ));

  const repliesByParentId = new Map();
  commentsWithAuthors
    .filter((comment) => normalizeParentCommentId(comment.parentCommentId))
    .forEach((comment) => {
      const parentId = normalizeParentCommentId(comment.parentCommentId);
      if (!repliesByParentId.has(parentId)) {
        repliesByParentId.set(parentId, []);
      }
      repliesByParentId.get(parentId).push({
        ...comment,
        replies: []
      });
    });

  const comments = commentsWithAuthors
    .filter((comment) => !normalizeParentCommentId(comment.parentCommentId))
    .map((comment) => ({
      ...comment,
      replies: repliesByParentId.get(String(comment._id)) || []
    }));

  return {
    comments,
    total,
    topLevelTotal,
    limit: safeLimit,
    offset: safeOffset,
    sortDir: safeSortDir,
    hasMore: safeOffset + comments.length < topLevelTotal,
  };
}

export async function createComment({ blockId, userId, body, parentCommentId = null }) {
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

  const parent = await resolveReplyParent({ blockId, parentCommentId });

  const doc = await BlockComment.create({
    blockId: String(blockId),
    userId: String(userId),
    body: trimmed,
    parentCommentId: parent ? String(parent._id) : null,
    status: 'visible',
    deletedAt: null,
    editedAt: null,
    hiddenAt: null,
  });

  // keep response lean & consistent
  return doc.toObject();
}

export async function updateComment({ commentId, userId, body }) {
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

  const comment = await getOwnedVisibleComment({ commentId, userId });

  comment.body = trimmed;
  comment.editedAt = new Date();
  await comment.save();

  return comment.toObject();
}

export async function deleteComment({ commentId, userId }) {
  const comment = await getOwnedVisibleComment({ commentId, userId });
  const deletedAt = new Date();
  let deletedReplyCount = 0;

  comment.deletedAt = deletedAt;
  await comment.save();

  if (!normalizeParentCommentId(comment.parentCommentId)) {
    const replyDeleteResult = await BlockComment.updateMany(
      {
        blockId: String(comment.blockId),
        parentCommentId: String(comment._id),
        deletedAt: null
      },
      { $set: { deletedAt } }
    );
    deletedReplyCount = Number(replyDeleteResult.modifiedCount || 0);
  }

  return {
    deleted: true,
    deletedReplyCount
  };
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
    if (!normalizeParentCommentId(comment.parentCommentId)) {
      await BlockComment.updateMany(
        {
          blockId: String(comment.blockId),
          parentCommentId: String(comment._id),
          status: { $ne: 'hidden' }
        },
        {
          $set: {
            status: 'hidden',
            hiddenAt: new Date()
          }
        }
      );
    }
    hidden = true;
  } else if (comment.status === 'hidden') {
    hidden = true;
  }

  return { reported: true, hidden, reportCount };
}

// server/db/notificationService.js
import Notification from './models/Notification.js';
import BlockComment from './models/BlockComment.js';
import { findUserById, findUserByUsername } from './userService.js';
import { buildCommentNotificationEmail } from '../services/emailTemplates/commentNotification.js';
import { sendEmail } from '../services/mailgunService.js';

export async function createNotification({
  userId,
  type,
  actorUserId,
  blockId,
  commentId = null
}) {
  const doc = await Notification.create({
    userId: String(userId),
    type,
    actorUserId: String(actorUserId),
    blockId: String(blockId),
    commentId: commentId ? String(commentId) : null,
    readAt: null,
    emailedAt: null,
    createdAt: new Date()
  });

  return doc.toObject();
}

export async function getNotificationsForUser({ userId, limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));

  return Notification
    .find({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

export async function getUnreadNotificationCount(userId) {
  return Notification.countDocuments({
    userId: String(userId),
    readAt: null
  });
}

export async function markNotificationRead({ notificationId, userId }) {
  const updated = await Notification.findOneAndUpdate(
    { _id: String(notificationId), userId: String(userId) },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' }
  ).lean();

  if (!updated) {
    const err = new Error('Notification not found.');
    err.status = 404;
    throw err;
  }

  return updated;
}

async function resolveBlockNotificationRecipient(block) {
  const directUserId = String(block?.userId || '').trim();
  if (directUserId) {
    return directUserId;
  }

  const creatorUsername = String(block?.creator || '').trim();
  if (!creatorUsername || creatorUsername === 'anonymous') {
    return '';
  }

  const creator = await findUserByUsername(creatorUsername);
  return creator?._id ? String(creator._id) : '';
}

async function sendCommentNotificationEmail({
  notificationId,
  notificationType,
  recipientUserId,
  block,
  comment,
  actorUser
}) {
  const recipient = await findUserById(recipientUserId);
  if (!recipient?.email) {
    return;
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const uiLang = block.lang || 'en';
  const blockUrl = `${baseUrl}/${uiLang}/rooms/${encodeURIComponent(block.roomId)}/blocks/${encodeURIComponent(block._id || block.id)}#comment-${encodeURIComponent(String(comment._id || comment.id))}`;
  const emailLang = ['en', 'es'].includes(block.lang) ? block.lang : 'en';

  const { subject, html } = await buildCommentNotificationEmail({
    uiLang: emailLang,
    notificationType,
    recipientUsername: recipient.username,
    actorUsername: actorUser.username || 'Someone',
    blockTitle: block.title || 'your block',
    commentBody: comment.body || '',
    blockUrl
  });

  await sendEmail({
    to: recipient.email,
    subject,
    html
  });

  await Notification.updateOne(
    { _id: notificationId },
    { $set: { emailedAt: new Date() } }
  );
}

async function resolveCommentNotificationRecipients({ block, comment, actorUser }) {
  const recipients = new Map();
  const actorUserId = String(actorUser.id || actorUser._id || '');
  const blockRecipientUserId = await resolveBlockNotificationRecipient(block);

  if (blockRecipientUserId && blockRecipientUserId !== actorUserId) {
    recipients.set(blockRecipientUserId, 'block_comment');
  }

  if (comment?.parentCommentId) {
    const parentComment = await BlockComment.findById(String(comment.parentCommentId))
      .select({ userId: 1 })
      .lean();
    const parentAuthorUserId = String(parentComment?.userId || '');

    if (parentAuthorUserId && parentAuthorUserId !== actorUserId) {
      recipients.set(parentAuthorUserId, 'comment_reply');
    }
  }

  return recipients;
}

export async function notifyBlockAuthorOfComment({
  block,
  comment,
  actorUser
}) {
  if (!block || !comment || !actorUser) return null;

  const recipients = await resolveCommentNotificationRecipients({ block, comment, actorUser });
  if (!recipients.size) {
    return null;
  }

  const actorUserId = String(actorUser.id || actorUser._id || '');
  const notifications = [];

  for (const [recipientUserId, notificationType] of recipients.entries()) {
    const notification = await createNotification({
      userId: recipientUserId,
      type: notificationType,
      actorUserId,
      blockId: block._id || block.id,
      commentId: comment._id || comment.id
    });

    notifications.push(notification);

    try {
      await sendCommentNotificationEmail({
        notificationId: notification._id,
        notificationType,
        recipientUserId,
        block,
        comment,
        actorUser
      });
    } catch (error) {
      console.error('Failed to send comment notification email:', error);
      // non-fatal on purpose
    }
  }

  return notifications[0] || null;
}

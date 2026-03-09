// server/db/notificationService.js
import Notification from './models/Notification.js';
import { findUserById } from './userService.js';
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

export async function notifyBlockAuthorOfComment({
  block,
  comment,
  actorUser
}) {
  if (!block || !comment || !actorUser) return null;

  const recipientUserId = String(block.userId || '');
  const actorUserId = String(actorUser.id || actorUser._id || '');

  // No self-notification
  if (!recipientUserId || recipientUserId === actorUserId) {
    return null;
  }

  // Create in-site notification first
  const notification = await createNotification({
    userId: recipientUserId,
    type: 'block_comment',
    actorUserId,
    blockId: block._id || block.id,
    commentId: comment._id || comment.id
  });

  // Best-effort email
  try {
    const recipient = await findUserById(recipientUserId);
    if (recipient?.email) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const uiLang = block.lang || 'en';
      const blockUrl = `${baseUrl}/${uiLang}/rooms/${encodeURIComponent(block.roomId)}/blocks/${encodeURIComponent(block._id || block.id)}`;

      const emailLang = ['en', 'es'].includes(block.lang) ? block.lang : 'en';

      const { subject, html } = await buildCommentNotificationEmail({
        uiLang: emailLang,
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
        { _id: notification._id },
        { $set: { emailedAt: new Date() } }
      );
    }
  } catch (error) {
    console.error('Failed to send comment notification email:', error);
    // non-fatal on purpose
  }

  return notification;
}

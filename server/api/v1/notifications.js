import { Router } from 'express';
import mongoose from 'mongoose';
import optionalAuth from '../../middleware/optionalAuth.js';
import Block from '../../db/models/Block.js';
import User from '../../db/models/User.js';
import {
  getNotificationsForUser,
  getUnreadNotificationCount,
  markNotificationRead
} from '../../db/notificationService.js';
import { canonicalBlockPath } from '../../utils/canonical.js';

const router = Router();

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '')).filter(Boolean))];
}

async function serializeNotifications(notifications, { t }) {
  const actorIds = uniqueStrings(
    notifications
      .map((notification) => notification.actorUserId)
      .filter((id) => mongoose.isValidObjectId(id))
  );
  const blockIds = uniqueStrings(
    notifications
      .map((notification) => notification.blockId)
      .filter((id) => mongoose.isValidObjectId(id))
  );

  const [actors, blocks] = await Promise.all([
    actorIds.length
      ? User.find({ _id: { $in: actorIds } }).select({ username: 1 }).lean()
      : Promise.resolve([]),
    blockIds.length
      ? Block.find({ _id: { $in: blockIds } }).select({ title: 1, roomId: 1 }).lean()
      : Promise.resolve([])
  ]);

  const actorsById = new Map(actors.map((actor) => [String(actor._id), actor.username]));
  const blocksById = new Map(blocks.map((block) => [String(block._id), block]));
  const fallbackActor = t('notifications.inSite.fallbackActor');
  const fallbackBlockTitle = t('notifications.inSite.fallbackBlockTitle');

  return notifications.map((notification) => {
    const actorUsername = actorsById.get(String(notification.actorUserId)) || fallbackActor;
    const block = blocksById.get(String(notification.blockId));
    const blockTitle = block?.title || fallbackBlockTitle;

    let message = t('notifications.inSite.item.unknown');
    let path = null;

    switch (notification.type) {
      case 'block_comment':
        message = t('notifications.inSite.item.blockComment', {
          actorUsername,
          blockTitle
        });
        if (block?.roomId) {
          const anchor = notification.commentId
            ? `#comment-${encodeURIComponent(String(notification.commentId))}`
            : '';
          path = `${canonicalBlockPath(block)}${anchor}`;
        }
        break;
      default:
        break;
    }

    return {
      _id: String(notification._id),
      type: notification.type,
      message,
      path,
      readAt: notification.readAt || null,
      createdAt: notification.createdAt || null
    };
  });
}

const useNotificationsAPI = (app) => {
  app.use('/api/v1/notifications', router);

  router.get('/', optionalAuth, async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'User not authenticated' });

    try {
      const rawNotifications = await getNotificationsForUser({
        userId: req.user.id,
        limit: req.query.limit
      });
      const notifications = await serializeNotifications(rawNotifications, {
        t: res.locals.t || ((key) => key)
      });
      return res.status(200).json({ notifications });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  router.get('/unread-count', optionalAuth, async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'User not authenticated' });

    try {
      const unreadCount = await getUnreadNotificationCount(req.user.id);
      return res.status(200).json({ unreadCount });
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
      return res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  router.post('/:notificationId/read', optionalAuth, async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'User not authenticated' });

    try {
      const notification = await markNotificationRead({
        notificationId: req.params.notificationId,
        userId: req.user.id
      });
      return res.status(200).json({ notification });
    } catch (error) {
      console.error(`Error marking notification ${req.params.notificationId} as read:`, error);
      const status = error?.status || 500;
      return res.status(status).json({ error: error?.message || 'Failed to mark notification read' });
    }
  });
};

export default useNotificationsAPI;

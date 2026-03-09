import { Router } from 'express';
import optionalAuth from '../../middleware/optionalAuth.js';
import {
  getNotificationsForUser,
  getUnreadNotificationCount,
  markNotificationRead
} from '../../db/notificationService.js';

const router = Router();

const useNotificationsAPI = (app) => {
  app.use('/api/v1/notifications', router);

  router.get('/', optionalAuth, async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'User not authenticated' });

    try {
      const notifications = await getNotificationsForUser({
        userId: req.user.id,
        limit: req.query.limit
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

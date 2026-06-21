import { Router } from 'express';
import { fetchAndGroupRooms } from '../../db/roomService.js';
import { getActiveUsers, getRecentlyActiveRooms } from '../../db/sessionService.js';

const router = Router();

const useRoomAPI = (app) => {
  app.use('/api/v1/rooms', router);

  router.get('/', async (req, res) => {
    try {
      const topics = await fetchAndGroupRooms();
      const rooms = topics.flatMap(topicGroup => topicGroup.rooms); // Flatten for API
      res.status(200).json(rooms);
    } catch (error) {
      console.error('Error fetching room metadata:', error);
      res.status(500).json({ error: 'Failed to fetch room metadata' });
    }
  });

  router.get('/recently-active', async (req, res) => {
    try {
      const recentlyActiveRooms = await getRecentlyActiveRooms(5); // Limit to 5
      res.status(200).json(recentlyActiveRooms);
    } catch (error) {
      console.error('Error fetching recently active rooms:', error);
      res.status(500).json({ error: 'Failed to fetch recently active rooms.' });
    }
  });

  router.get('/active-users/:roomId', async (req, res) => {
    const { roomId } = req.params;
    try {
      const activeUsers = await getActiveUsers(roomId);
      res.status(200).json({ activeUsers });
    } catch (error) {
      console.error(`Error fetching active users for room ${roomId}:`, error);
      res.status(500).json({ error: `Failed to fetch active users for room ${roomId}` });
    }
  });
};

export default useRoomAPI;

import { Router } from 'express';
import { fetchAndGroupRooms } from './room-helpers.js';

const router = Router();

const useRoomAPI = (app) => {
  app.use('/api/v1/rooms', router);

  router.get('/', async (req, res) => {
    try {
      const topics = await fetchAndGroupRooms();
      const rooms = topics.flatMap(topicGroup => topicGroup.rooms); // Flatten for API
      res.status(200).json(rooms);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch room metadata' });
    }
  });
};

export default useRoomAPI;

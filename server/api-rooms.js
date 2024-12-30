import { Router } from 'express';
import { getCollection, initRoomMetadataCollection } from './mongo.js';

const router = Router();

const useRoomAPI = (app) => {
  app.use('/api/v1/rooms', router);

  router.get('/', async (req, res) => {
    try {
      await initRoomMetadataCollection(); // Ensure initialization
      const roomsCollection = await getCollection('rooms');
      const rooms = await roomsCollection.find({}).toArray();
      res.status(200).json(rooms);
    } catch (error) {
      console.error('Error fetching rooms:', error.message);
      res.status(500).json({ error: 'Failed to fetch room metadata' });
    }
  });
};

export default useRoomAPI;

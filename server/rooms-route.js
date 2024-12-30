import express from 'express';
import { fetchAndGroupRooms } from './room-helpers.js';

const router = express.Router();

router.get('/rooms', async (req, res) => {
  try {
    const topics = await fetchAndGroupRooms() || [];
    res.render('rooms', {
      title: 'Room Directory',
      topics,
    });
  } catch (error) {
    res.status(500).send('Error fetching room directory.');
  }
});

export default router;

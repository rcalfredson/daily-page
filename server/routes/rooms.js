import express from 'express';
import { fetchAndGroupRooms } from '../db/roomService.js';
import { getRecentlyActiveRooms } from '../db/sessionService.js';

const router = express.Router();

router.get('/rooms', async (req, res) => {
  try {
    const topics = await fetchAndGroupRooms() || [];
    const recentlyActiveRooms = await getRecentlyActiveRooms(5);
    res.render('rooms', {
      title: 'Room Directory',
      topics,
      recentlyActiveRooms,
    });
  } catch (error) {
    res.status(500).send('Error fetching room directory.');
  }
});

export default router;

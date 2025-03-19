import express from 'express';

import isAuthenticated from '../middleware/auth.js';
import { findUserById } from "../db/userService.js";
import { getRecentActivityByUser } from '../db/blockService.js';
import { getRoomMetadata } from "../db/roomService.js";

const router = express.Router();

router.get('/signup', (req, res) => {
  res.render('signup', {
    title: 'Create an Account',
    description: 'Sign up for Daily Page to access all features.',
  });
});

router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const recentActivity = await getRecentActivityByUser(req.user.username, { days: 7, limit: 10 });

    const dbUser = await findUserById(req.user.id);
    let starredRooms = dbUser.starredRooms || [];

    const starredRoomsPreview = await Promise.all(
      starredRooms.slice(0, 3).map(async (roomId) => {
        const metadata = await getRoomMetadata(roomId);
        return {
          id: roomId,
          name: metadata?.name || "Unnamed Room"
        };
      })
    );

    res.render('dashboard', {
      title: 'Dashboard',
      user: req.user,
      recentActivity,
      streakLength: req.user.streakLength,
      starredRooms: starredRoomsPreview,
      totalStarredRooms: starredRooms.length
    });
  } catch (error) {
    console.error('Error loading dashboard:', error.message);
    res.status(500).render('error', { message: 'Error loading dashboard' });
  }
});

router.get('/dashboard/starred-rooms', isAuthenticated, async (req, res) => {
  try {
    const dbUser = await findUserById(req.user.id);
    let starredRooms = dbUser.starredRooms || [];

    const starredRoomsFull = await Promise.all(
      starredRooms.map(async (roomId) => {
        const metadata = await getRoomMetadata(roomId);
        return {
          id: roomId,
          name: metadata?.name || "Unnamed Room",
          description: metadata?.description || "No description."
        };
      })
    );

    res.render('starred-rooms', {
      title: 'All Starred Rooms',
      starredRooms: starredRoomsFull,
      user: req.user
    });
  } catch (error) {
    console.error('Error loading starred rooms:', error.message);
    res.status(500).render('error', { message: 'Error loading starred rooms' });
  }
});

export default router;

import express from 'express';

import isAuthenticated from '../middleware/auth.js';
import { findUserById } from "../db/userService.js";
import { getRecentActivityByUser } from '../db/blockService.js';
import Block from '../db/models/Block.js';
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
    const username = req.user.username;
    const userId = req.user.id;

    const recentActivity = await getRecentActivityByUser(username, { days: 7, limit: 10 });
    const dbUser = await findUserById(userId);
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

    // 🔥 Añadido: Obtener estadísticas básicas del usuario
    const totalBlocks = await Block.countDocuments({ creator: username });
    const totalCollaborations = await Block.countDocuments({ collaborators: username });
    const totalVotesGiven = await Block.countDocuments({ 'votes.userId': userId });

    const activeDaysAgg = await Block.aggregate([
      { $match: { $or: [{ creator: username }, { collaborators: username }] } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } } },
      { $count: "activeDays" }
    ]);

    const daysActive = activeDaysAgg[0]?.activeDays || 0;

    res.render('dashboard', {
      title: 'Dashboard',
      user: req.user,
      recentActivity,
      streakLength: req.user.streakLength,
      starredRooms: starredRoomsPreview,
      totalStarredRooms: starredRooms.length,
      userStats: {
        totalBlocks,
        totalCollaborations,
        totalVotesGiven,
        daysActive
      }
    });
  } catch (error) {
    console.error('Error loading dashboard:', error.message);
    res.status(500).render('error', { message: 'Error loading dashboard' });
  }
});

router.get('/dashboard/stats', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username;

    const totalBlocks = await Block.countDocuments({ creator: username });
    const totalCollaborations = await Block.countDocuments({ collaborators: username });
    const totalVotesGiven = await Block.countDocuments({ 'votes.userId': userId });

    // Días activos (días distintos con actividad)
    const activeDaysAgg = await Block.aggregate([
      { $match: { $or: [{ creator: username }, { collaborators: username }] } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } } },
      { $count: "activeDays" }
    ]);

    const daysActive = activeDaysAgg[0]?.activeDays || 0;

    res.render('detailed-stats', {
      title: 'Detailed Stats',
      user: req.user,
      stats: {
        totalBlocks,
        totalCollaborations,
        totalVotesGiven,
        daysActive,
      }
    });

  } catch (error) {
    console.error('Error loading detailed stats:', error.message);
    res.status(500).render('error', { message: 'Error loading detailed stats' });
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

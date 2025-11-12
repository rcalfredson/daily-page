import express from 'express';

import { isAuthenticated } from '../middleware/auth.js';
import optionalAuth from '../middleware/optionalAuth.js'
import { addI18n } from '../services/i18n.js';
import { findUserById, findUserByUsername } from "../db/userService.js";
import { findByUserWithLangPref, getRecentActivityByUser } from '../db/blockService.js';
import Block from '../db/models/Block.js';
import { getRoomMetadata } from "../db/roomService.js";

const router = express.Router();

router.get('/signup', (req, res) => {
  res.render('signup', {
    title: 'Create an Account',
    description: 'Sign up for Daily Page to access all features.',
  });
});

router.get('/verify-email', (req, res) => {
  res.render('users/verify-email', {
    title: 'Verify Email',
    description: 'Verify your email address for Daily Page.',
  });
});

router.get('/forgot-password', (req, res) => {
  res.render('users/forgot-password', {
    title: 'Reset Password',
    description: 'Request a reset link for your Daily Page account.'
  });
});

router.get('/reset-password', (req, res) => {
  res.render('users/reset-password', {
    title: 'Reset Your Password',
    description: 'Set a new password for your account.'
  });
});

router.get('/privacy', addI18n(['privacy']), (req, res) => {
  const { t, lang } = res.locals;
  const lastUpdatedISO = '2025-08-30'; // ISO constante
  const lastUpdated = new Intl.DateTimeFormat(lang || 'en', { dateStyle: 'long' })
    .format(new Date(lastUpdatedISO));

  res.render('privacy', {
    title: t('privacy.meta.title'),
    description: t('privacy.meta.description'),
    lastUpdated
  });
});

router.get('/users/anonymous', (req, res) => {
  res.render('users/anonymous', {
    title: 'The Anonymous Wanderer',
    description: 'No profile. No past. Just vibes.',
  });
});

// View user profile (public)
router.get('/users/:username', async (req, res) => {
  try {
    const profileUsername = req.params.username;

    // Fetch user data
    const profileUser = await findUserByUsername(profileUsername);
    if (!profileUser) {
      return res.status(404).render('error', { title: 'User not found', message: 'User not found' });
    }

    // Fetch recent activity
    const recentActivity = await getRecentActivityByUser(profileUsername, { days: 7, limit: 10 });

    // Fetch starred rooms (just a preview for the MVP)
    const starredRoomsPreview = await Promise.all(
      (profileUser.starredRooms || []).slice(0, 3).map(async (roomId) => {
        const metadata = await getRoomMetadata(roomId);
        return {
          id: roomId,
          name: metadata?.name || "Unnamed Room"
        };
      })
    );

    // User stats
    const totalBlocks = await Block.countDocuments({ creator: profileUsername });
    const totalCollaborations = await Block.countDocuments({ collaborators: profileUsername });
    const daysActiveAgg = await Block.aggregate([
      { $match: { $or: [{ creator: profileUsername }, { collaborators: profileUsername }] } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } } },
      { $count: "activeDays" }
    ]);

    const daysActive = daysActiveAgg[0]?.activeDays || 0;

    res.render('profile', {
      title: `${profileUsername}'s Profile`,
      profileUser,
      recentActivity,
      starredRooms: starredRoomsPreview,
      userStats: {
        totalBlocks,
        totalCollaborations,
        daysActive
      },
      isOwnProfile: req.user && (req.user.username === profileUsername)
    });
  } catch (error) {
    console.error('Error loading profile:', error.message);
    res.status(500).render('error', { message: 'Error loading user profile' });
  }
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

// GET /dashboard/blocks?page=&sort=&dir=&lang=
router.get('/dashboard/blocks', isAuthenticated, async (req, res) => {
  try {
    const username = req.user.username;
    const preferredLang =
      req.query.lang ||
      req.user?.preferredLang ||
      (req.acceptsLanguages()[0] || "en").split("-")[0];

    const page = +req.query.page || 1;
    const limit = 20;
    const sortKey = ['title', 'createdAt', 'voteCount'].includes(req.query.sort)
      ? req.query.sort : 'createdAt';
    const dirStr = req.query.dir === 'asc' ? 'asc' : 'desc';
    const sortDir = dirStr === 'asc' ? 1 : -1;

    const currentLang = preferredLang;
    const langQuery = currentLang ? `&lang=${currentLang}` : '';

    const blocks = await findByUserWithLangPref({
      username,
      preferredLang,
      sortBy: sortKey,
      sortDir,
      skip: (page - 1) * limit,
      limit
    });

    const [{ total = 0 } = {}] = await Block.aggregate([
      { $match: { $or: [{ creator: username }, { collaborators: username }] } },
      { $group: { _id: "$groupId" } },
      { $count: "total" }
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.render('users/blocks', {
      title: 'Your Blocks',
      username,
      blocks,
      currentPage: page,
      totalPages,
      sortKey,
      dir: dirStr,
      lang: currentLang,
      langQuery,
      isOwnProfile: true
    });
  } catch (err) {
    console.error('Error fetching user blocks:', err);
    res.status(500).render('error', { message: 'Error fetching user blocks' });
  }
});

// GET /users/:username/blocks?page=&sort=&dir=&lang=
router.get('/users/:username/blocks', optionalAuth, async (req, res) => {
  try {
    const username = req.params.username;
    const preferredLang =
      req.query.lang ||
      req.user?.preferredLang ||
      (req.acceptsLanguages()[0] || "en").split("-")[0];

    const page = +req.query.page || 1;
    const limit = 20;
    const sortKey = ['title', 'createdAt', 'voteCount'].includes(req.query.sort)
      ? req.query.sort : 'createdAt';
    const dirStr = req.query.dir === 'asc' ? 'asc' : 'desc';
    const sortDir = dirStr === 'asc' ? 1 : -1;

    const currentLang = preferredLang;
    const langQuery = currentLang ? `&lang=${currentLang}` : '';

    const userExists = await findUserByUsername(username);
    if (!userExists) {
      return res.status(404).render('error', { title: 'User not found', message: 'User not found' });
    }

    const blocks = await findByUserWithLangPref({
      username,
      preferredLang,
      sortBy: sortKey,
      sortDir,
      skip: (page - 1) * limit,
      limit
    });

    const [{ total = 0 } = {}] = await Block.aggregate([
      { $match: { $or: [{ creator: username }, { collaborators: username }] } },
      { $group: { _id: "$groupId" } },
      { $count: "total" }
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.render('users/blocks', {
      title: `${username}'s Blocks`,
      username,
      blocks,
      currentPage: page,
      totalPages,
      sortKey,
      dir: dirStr,
      lang: currentLang,
      langQuery,
      isOwnProfile: req.user && req.user.username === username
    });
  } catch (err) {
    console.error('Error fetching user blocks:', err);
    res.status(500).render('error', { message: 'Error fetching user blocks' });
  }
});

export default router;

import express from 'express';

import { isAuthenticated } from '../middleware/auth.js';
import optionalAuth from '../middleware/optionalAuth.js'
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { addI18n } from '../services/i18n.js';
import { getUiLang, getPreferredContentLang } from '../services/localeContext.js';
import { findUserById, findUserByUsername } from "../db/userService.js";
import { findByUserWithLangPref, getRecentActivityByUser } from '../db/blockService.js';
import Block from '../db/models/Block.js';
import { getRoomMetadata } from "../db/roomService.js";

const router = express.Router();

router.get(
  '/signup',
  addI18n(['signup']),
  stripLegacyLang({ canonicalPath: '/signup' }),
  (req, res) => {
    const { t } = res.locals;
    const uiLang = getUiLang(res);
    res.render('signup', {
      title: t('signup.meta.title'),
      description: t('signup.meta.description'),
      uiLang,
    });
  });

router.get(
  '/verify-email',
  addI18n(['verifyEmail']),
  stripLegacyLang({ canonicalPath: '/verify-email' }),
  (req, res) => {
    const { t } = res.locals;
    const uiLang = getUiLang(res);

    res.render('users/verify-email', {
      title: t('verifyEmail.meta.title'),
      description: t('verifyEmail.meta.description'),
      uiLang,
    });
  }
);

router.get(
  '/forgot-password',
  addI18n(['forgotPassword']),
  stripLegacyLang({ canonicalPath: '/forgot-password' }),
  (req, res) => {
    const { t } = res.locals;
    const uiLang = getUiLang(res);

    res.render('users/forgot-password', {
      title: t('forgotPassword.meta.title'),
      description: t('forgotPassword.meta.description'),
      uiLang,
    });
  }
);

router.get(
  '/reset-password',
  addI18n(['resetPassword']),
  stripLegacyLang({ canonicalPath: '/reset-password' }),
  (req, res) => {
    const { t } = res.locals;
    const uiLang = getUiLang(res);

    res.render('users/reset-password', {
      title: t('resetPassword.meta.title'),
      description: t('resetPassword.meta.description'),
      uiLang,
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
router.get(
  '/users/:username',
  optionalAuth,
  addI18n(['profile']),
  stripLegacyLang({ canonicalPath: (req) => `/users/${req.params.username}` }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);

      const profileUsername = req.params.username;

      const profileUser = await findUserByUsername(profileUsername);
      if (!profileUser) {
        return res.status(404).render('error', { title: 'User not found', message: 'User not found' });
      }

      const recentActivity = await getRecentActivityByUser(profileUsername, { days: 7, limit: 10 });

      const starredRoomsPreview = await Promise.all(
        (profileUser.starredRooms || []).slice(0, 3).map(async (roomId) => {
          const metadata = await getRoomMetadata(roomId, uiLang);
          return {
            id: roomId,
            name: metadata?.displayName || metadata?.name || t('profile.starredRooms.unnamedRoom')
          };
        })
      );

      const totalBlocks = await Block.countDocuments({ creator: profileUsername });
      const totalCollaborations = await Block.countDocuments({ collaborators: profileUsername });

      const daysActiveAgg = await Block.aggregate([
        { $match: { $or: [{ creator: profileUsername }, { collaborators: profileUsername }] } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } } },
        { $count: "activeDays" }
      ]);
      const daysActive = daysActiveAgg[0]?.activeDays || 0;

      const isOwnProfile = !!(req.user && req.user.username === profileUsername);

      res.render('profile', {
        title: t('profile.meta.titleUser', { username: profileUsername }),
        description: t('profile.meta.descriptionUser', { username: profileUsername }),
        uiLang,
        profileUser,
        recentActivity,
        starredRooms: starredRoomsPreview,
        userStats: { totalBlocks, totalCollaborations, daysActive },
        isOwnProfile
      });
    } catch (error) {
      console.error('Error loading profile:', error.message);
      res.status(500).render('error', { message: 'Error loading user profile' });
    }
  }
);

router.get(
  '/dashboard',
  isAuthenticated,
  addI18n(['dashboard']),
  stripLegacyLang({ canonicalPath: '/dashboard' }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);

      const username = req.user.username;
      const userId = req.user.id;

      const recentActivity = await getRecentActivityByUser(username, { days: 7, limit: 10 });
      const dbUser = await findUserById(userId);
      const starredRooms = dbUser.starredRooms || [];

      const starredRoomsPreview = await Promise.all(
        starredRooms.slice(0, 3).map(async (roomId) => {
          const metadata = await getRoomMetadata(roomId);
          return {
            id: roomId,
            name: metadata?.name || t('dashboard.starredRooms.unnamedRoom'),
          };
        })
      );

      // 🔥 Obtener estadísticas básicas del usuario
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
        title: t('dashboard.meta.title'),
        description: t('dashboard.meta.description'),
        uiLang,
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
      // leave error page i18n for later, or do it now if you already have error ns
      res.status(500).render('error', { message: 'Error loading dashboard' });
    }
  }
);

router.get(
  '/dashboard/stats',
  isAuthenticated,
  addI18n(['detailedStats']),
  stripLegacyLang({ canonicalPath: '/dashboard/stats' }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);

      const userId = req.user.id;
      const username = req.user.username;

      const totalBlocks = await Block.countDocuments({ creator: username });
      const totalCollaborations = await Block.countDocuments({ collaborators: username });
      const totalVotesGiven = await Block.countDocuments({ 'votes.userId': userId });

      const activeDaysAgg = await Block.aggregate([
        { $match: { $or: [{ creator: username }, { collaborators: username }] } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } } },
        { $count: "activeDays" }
      ]);

      const daysActive = activeDaysAgg[0]?.activeDays || 0;

      res.render('detailed-stats', {
        title: t('detailedStats.meta.title'),
        description: t('detailedStats.meta.description'),
        uiLang,
        user: req.user,
        stats: { totalBlocks, totalCollaborations, totalVotesGiven, daysActive },
      });
    } catch (error) {
      console.error('Error loading detailed stats:', error.message);
      res.status(500).render('error', { message: 'Error loading detailed stats' });
    }
  }
);

router.get(
  '/dashboard/starred-rooms',
  isAuthenticated,
  addI18n(['starredRooms']),
  stripLegacyLang({ canonicalPath: '/dashboard/starred-rooms' }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);

      const dbUser = await findUserById(req.user.id);
      const starredRooms = dbUser.starredRooms || [];

      const starredRoomsFull = await Promise.all(
        starredRooms.map(async (roomId) => {
          const metadata = await getRoomMetadata(roomId, uiLang);
          return {
            id: roomId,
            name: metadata?.displayName || t('starredRooms.rooms.unnamedRoom'),
            description: metadata?.displayDescription || t('starredRooms.rooms.noDescription')
          };
        })
      );

      res.render('starred-rooms', {
        title: t('starredRooms.meta.title'),
        description: t('starredRooms.meta.description'),
        uiLang,
        starredRooms: starredRoomsFull,
        user: req.user
      });
    } catch (error) {
      console.error('Error loading starred rooms:', error.message);
      res.status(500).render('error', { message: 'Error loading starred rooms' });
    }
  }
);


// GET /dashboard/blocks?page=&sort=&dir=
router.get(
  '/dashboard/blocks',
  isAuthenticated,
  addI18n(['userBlocks', 'archive']),
  stripLegacyLang({ canonicalPath: '/dashboard/blocks' }),
  async (req, res) => {
    try {
      const { t } = res.locals;

      const uiLang = getUiLang(res);
      const preferredContentLang = getPreferredContentLang(res);

      const username = req.user.username;

      const page = +req.query.page || 1;
      const limit = 20;

      const sortKey = ['title', 'createdAt', 'voteCount'].includes(req.query.sort)
        ? req.query.sort
        : 'createdAt';

      const dirStr = req.query.dir === 'asc' ? 'asc' : 'desc';
      const sortDir = dirStr === 'asc' ? 1 : -1;

      const blocks = await findByUserWithLangPref({
        username,
        preferredLang: preferredContentLang,
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
        title: t('userBlocks.meta.title'),
        description: t('userBlocks.meta.description'),
        username,
        blocks,
        currentPage: page,
        totalPages,
        sortKey,
        dir: dirStr,
        isOwnProfile: true,
        uiLang,
        preferredContentLang,
      });
    } catch (err) {
      console.error('Error fetching user blocks:', err);
      res.status(500).render('error', { message: 'Error fetching user blocks' });
    }
  }
);

// GET /users/:username/blocks?page=&sort=&dir=
router.get(
  '/users/:username/blocks',
  optionalAuth,
  addI18n(['userBlocks', 'archive']),
  stripLegacyLang({ canonicalPath: (req) => `/users/${req.params.username}/blocks` }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);
      const preferredContentLang = getPreferredContentLang(res);

      const username = req.params.username;

      const userExists = await findUserByUsername(username);
      if (!userExists) {
        return res.status(404).render('error', { title: 'User not found', message: 'User not found' });
      }

      const page = +req.query.page || 1;
      const limit = 20;

      const sortKey = ['title', 'createdAt', 'voteCount'].includes(req.query.sort)
        ? req.query.sort
        : 'createdAt';

      const dirStr = req.query.dir === 'asc' ? 'asc' : 'desc';
      const sortDir = dirStr === 'asc' ? 1 : -1;

      const blocks = await findByUserWithLangPref({
        username,
        preferredLang: preferredContentLang,
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
      const isOwnProfile = !!(req.user && req.user.username === username);

      res.render('users/blocks', {
        title: isOwnProfile
          ? t('userBlocks.meta.title')
          : t('userBlocks.meta.titleUser', { username }),
        description: t('userBlocks.meta.description'),
        username,
        blocks,
        currentPage: page,
        totalPages,
        sortKey,
        dir: dirStr,
        isOwnProfile,
        uiLang,
        preferredContentLang,
      });
    } catch (err) {
      console.error('Error fetching user blocks:', err);
      res.status(500).render('error', { message: 'Error fetching user blocks' });
    }
  }
);

export default router;

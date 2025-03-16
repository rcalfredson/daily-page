import express from 'express';

import isAuthenticated from '../middleware/auth.js';
import { getRecentActivityByUser } from '../db/blockService.js';

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
    // Also calculate streakDays if needed
    res.render('dashboard', {
      title: 'Dashboard',
      user: req.user,
      recentActivity,
      streakLength: req.user.streakLength,
      // Include any other data you want to pass
    });
  } catch (error) {
    console.error('Error loading dashboard:', error.message);
    res.status(500).render('error', { message: 'Error loading dashboard' });
  }
});

export default router;

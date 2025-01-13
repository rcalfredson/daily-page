import express from 'express';

import isAuthenticated from '../middleware/auth.js';

const router = express.Router();

router.get('/signup', (req, res) => {
  res.render('signup', {
    title: 'Create an Account',
    description: 'Sign up for Daily Page to access all features.',
  });
});

router.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', { title: 'Dashboard', user: req.user });
});

export default router;

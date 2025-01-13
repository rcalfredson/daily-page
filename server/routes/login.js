import express from 'express';

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('login', {
    title: 'Log In',
    description: 'Log in to your Daily Page account to continue your journey.',
  });
});

export default router;

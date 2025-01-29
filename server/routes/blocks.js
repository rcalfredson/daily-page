import express from 'express';
import optionalAuth from '../middleware/optionalAuth.js';

const router = express.Router();

// Render "Create New Block" page
router.get('/rooms/:room_id/blocks/new', optionalAuth, async (req, res) => {
  const { room_id } = req.params;

  res.render('rooms/create-block', {
    title: 'Create a New Block',
    room_id,
    user: req.user,
  });
});

export default router;

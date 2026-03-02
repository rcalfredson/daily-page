// server/api/v1/comments.js
import { Router } from 'express';
import { getCommentsForBlock } from '../../db/commentService.js';

const router = Router();

const useCommentsAPI = (app) => {
  app.use('/api/v1/comments', router);

  // Read-only (slice 1)
  router.get('/:blockId', async (req, res) => {
    const { blockId } = req.params;
    const { limit } = req.query;

    try {
      const comments = await getCommentsForBlock({ blockId, limit });
      return res.status(200).json({ comments });
    } catch (error) {
      console.error(`Error fetching comments for block ${blockId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });
};

export default useCommentsAPI;

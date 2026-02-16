import { Router } from 'express';
import { verifyJWT } from '../../services/jwt.js';
import {
  toggleReaction,
  getReactionCounts,
  getUserReactionsForBlock,
  getReactionCountsForBlocks,
  ALLOWED_REACTIONS
} from '../../db/reactionService.js';

const router = Router();

const useReactionsAPI = (app) => {
  app.use('/api/v1/reactions', router);

  // Batch counts-only endpoint for list views
  // POST /api/v1/reactions/batch
  // body: { blockIds: ["id1","id2",...] }
  router.post('/batch', async (req, res) => {
    const { blockIds } = req.body || {};
    if (!Array.isArray(blockIds)) {
      return res.status(400).json({ error: 'blockIds must be an array' });
    }

    const ids = blockIds.map(String).filter(Boolean).slice(0, 200);

    try {
      const countsByBlockId = await getReactionCountsForBlocks(ids);
      return res.status(200).json({ countsByBlockId });
    } catch (error) {
      console.error('Error fetching batch reaction counts:', error);
      return res.status(500).json({ error: 'Failed to fetch reaction counts' });
    }
  });

  // Toggle a reaction
  // POST /api/v1/reactions/:blockId
  // body: { type: "heart" }
  router.post('/:blockId', async (req, res) => {
    const { blockId } = req.params;
    const { type } = req.body;
    const token = req.cookies.auth_token;

    if (!token) return res.status(401).json({ error: 'User not authenticated' });
    if (!ALLOWED_REACTIONS.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    try {
      const user = verifyJWT(token);

      await toggleReaction({ blockId, userId: user.id, type });

      // Return updated state for a single block
      const [counts, userReactions] = await Promise.all([
        getReactionCounts(blockId),
        getUserReactionsForBlock({ blockId, userId: user.id })
      ]);

      return res.status(200).json({ counts, userReactions });
    } catch (error) {
      console.error(`Error toggling reaction for block ${blockId}:`, error);
      const status = error?.status || 500;
      return res.status(status).json({ error: 'Failed to process reaction' });
    }
  });

  // Optional: counts-only endpoint (useful for guests, or caching)
  // GET /api/v1/reactions/:blockId
  router.get('/:blockId', async (req, res) => {
    const { blockId } = req.params;

    try {
      const counts = await getReactionCounts(blockId);
      return res.status(200).json({ counts });
    } catch (error) {
      console.error(`Error fetching reactions for block ${blockId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch reactions' });
    }
  });
};

export default useReactionsAPI;

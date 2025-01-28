import { Router } from 'express';
import { saveVote } from '../../db/blockService.js';
import { verifyJWT } from '../../services/jwt.js';

const router = Router();

const useVoteAPI = (app) => {
  app.use('/api/v1/votes', router);

  // Endpoint to handle voting
  router.post('/:blockId', async (req, res) => {
    const { blockId } = req.params;
    const { action } = req.body; // "upvote" or "downvote"
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      const user = verifyJWT(token); // Validate user
      const updatedVoteCount = await saveVote(blockId, user.id, action);
      res.status(200).json({ voteCount: updatedVoteCount });
    } catch (error) {
      console.error(`Error saving vote for block ${blockId}:`, error);
      res.status(500).json({ error: 'Failed to process vote' });
    }
  });
};

export default useVoteAPI;

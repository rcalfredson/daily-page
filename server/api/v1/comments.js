// server/api/v1/comments.js
import { Router } from 'express';
import optionalAuth from '../../middleware/optionalAuth.js';
import { getBlockById } from '../../db/blockService.js';
import { createComment, getCommentsForBlockView, reportComment } from '../../db/commentService.js';
import { notifyBlockAuthorOfComment } from '../../db/notificationService.js';
import { commentHasUrl, enforceAndRecordCommentRateLimit } from '../../db/rateLimitService.js';
import { findUserById } from '../../db/userService.js';


const router = Router();

function normalizeCommentsSortDir(sortDir) {
  return sortDir === 'desc' ? 'desc' : 'asc';
}

const useCommentsAPI = (app) => {
  app.use('/api/v1/comments', router);

  // Read-only (slice 1)
  router.get('/:blockId', async (req, res) => {
    const { blockId } = req.params;
    const { limit, offset } = req.query;
    const sortDir = normalizeCommentsSortDir(req.query.sortDir);

    try {
      const result = await getCommentsForBlockView({ blockId, limit, offset, sortDir });
      return res.status(200).json(result);
    } catch (error) {
      console.error(`Error fetching comments for block ${blockId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  // Create comment (slice 2)
  router.post('/:blockId', optionalAuth, async (req, res) => {
    const { blockId } = req.params;
    if (!req.user?.id) return res.status(401).json({ error: 'User not authenticated' });

    try {
      // Ensure the block exists (prevents orphaned comments / spam to random ids)
      const block = await getBlockById(blockId);
      if (!block) return res.status(404).json({ error: 'Block not found' });

      // Verified email check (authoritative)
      const dbUser = await findUserById(req.user.id);
      if (!dbUser) return res.status(401).json({ error: 'User not authenticated' });
      if (!dbUser.verified) {
        return res.status(403).json({ error: 'Please verify your email before commenting.' });
      }

      const body = req.body?.body;
      const parentCommentId = req.body?.parentCommentId || null;
      const hasUrl = commentHasUrl(body);

      // Rate limiting (DB-backed)
      const ip =
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        req.ip;

      await enforceAndRecordCommentRateLimit({ userId: req.user.id, ip, hasUrl });

      const comment = await createComment({
        blockId,
        userId: req.user.id,
        body,
        parentCommentId
      });

      try {
        await notifyBlockAuthorOfComment({
          block,
          comment,
          actorUser: req.user
        });
      } catch (notifyError) {
        console.error(`Failed to notify block author for comment ${comment._id}:`, notifyError);
      }

      return res.status(201).json({ comment });
    } catch (error) {
      console.error(`Error creating comment for block ${blockId}:`, error);
      const status = error?.status || 500;
      return res.status(status).json({ error: error?.message || 'Failed to create comment' });
    }
  });

  router.post('/:commentId/report', optionalAuth, async (req, res) => {
    const { commentId } = req.params;

    if (!req.user?.id) return res.status(401).json({ error: 'User not authenticated' });

    try {
      const result = await reportComment({ commentId, reporterId: req.user.id });
      return res.status(200).json(result);
    } catch (error) {
      console.error(`Error reporting comment ${commentId}:`, error);
      const status = error?.status || 500;
      return res.status(status).json({ error: error?.message || 'Failed to report comment' });
    }
  });
};

export default useCommentsAPI;

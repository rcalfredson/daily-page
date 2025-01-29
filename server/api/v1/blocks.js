import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getBlockById, getBlocksByRoom, createBlock, deleteBlock } from '../../db/blockService.js';
import optionalAuth from '../../middleware/optionalAuth.js';

const router = Router({ mergeParams: true });

const useBlockAPI = (app) => {
  app.use('/api/v1/rooms/:room_id/blocks', router);

  router.get('/', async (req, res) => {
    const { room_id } = req.params;
    const { status, startDate, endDate } = req.query;

    try {
      const blocks = await getBlocksByRoom(room_id, { status, startDate, endDate });
      res.status(200).json(blocks);
    } catch (error) {
      console.error('Error fetching blocks:', error.message);
      res.status(500).json({ error: 'Failed to fetch blocks.' });
    }
  });

  router.post('/', optionalAuth, async (req, res) => {
    const { room_id } = req.params;
    const { title, description, tags, visibility } = req.body;

    if (!title || title.length < 3) {
      return res.status(400).json({ error: 'Title is required and must be at least 3 characters long.' });
    }

    const existingTokens = req.cookies.edit_tokens ? JSON.parse(req.cookies.edit_tokens) : [];

    const blockData = {
      title,
      description,
      tags,
      visibility: req.user ? visibility : 'public', // Default to 'public' for unauthenticated users
      creator: req.user?.username || 'anonymous',
      roomId: room_id,
      editToken: uuidv4()
    };

    existingTokens.push(blockData.editToken);

    try {
      const newBlock = await createBlock(blockData);
      res.cookie('edit_tokens', JSON.stringify(existingTokens), {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });
      res.status(201).json(newBlock);
    } catch (error) {
      console.error('Error creating block:', error.message);
      res.status(500).json({ error: 'Failed to create block.' });
    }
  });

  router.delete('/:block_id', optionalAuth, async (req, res) => {
    const { block_id } = req.params;

    try {
      const block = await getBlockById(block_id);

      if (!block) {
        return res.status(404).json({ error: 'Block not found.' });
      }

      const tokenFromRequest = req.cookies.edit_token || req.query.edit_token;

      // Check if the user is authorized to delete
      if (block.creator !== req.user?.id && block.editToken !== tokenFromRequest) {
        return res.status(403).json({ error: 'You are not authorized to delete this block.' });
      }

      // Delete the block
      await deleteBlock(block_id);
      res.status(200).json({ message: 'Block deleted successfully.' });
    } catch (error) {
      console.error('Error deleting block:', error.message);
      res.status(500).json({ error: 'Failed to delete block.' });
    }
  });
};

export default useBlockAPI;

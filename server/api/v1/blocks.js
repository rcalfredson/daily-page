import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getBlockById,
  getBlocksByRoom,
  getBlocksByDate,
  getBlockDatesByYearMonth,
  getAllBlockYearMonthCombos,
  createBlock,
  updateBlock,
  deleteBlock
} from '../../db/blockService.js';
import {
  createFlag,
  getFlagsByBlock
} from '../../db/flagService.js';
import { updateUserStreak } from '../../db/userService.js';
import optionalAuth from '../../middleware/optionalAuth.js';
import { refreshAuthToken } from '../../utils/jwtHelper.js';

const roomScopedRouter = Router({ mergeParams: true });
const globalRouter = Router();

const useBlockAPI = (app) => {
  // 🏠 Room-specific block routes
  app.use('/api/v1/rooms/:room_id/blocks', roomScopedRouter);

  // 🌍 Global block routes
  app.use('/api/v1/blocks', globalRouter);

  /** 🏠 Room-Specific Endpoints **/

  // 📌 Get all blocks for a specific room
  roomScopedRouter.get('/', async (req, res) => {
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

  // 📌 Create a new block (within a specific room)
  roomScopedRouter.post('/', optionalAuth, async (req, res) => {
    const { room_id } = req.params;
    const { title, description, tags, content, visibility } = req.body;

    if (!title || title.length < 3) {
      return res
        .status(400)
        .json({ error: 'Title is required and must be at least 3 characters long.' });
    }

    const existingTokens = req.cookies.edit_tokens
      ? JSON.parse(req.cookies.edit_tokens)
      : [];

    const blockData = {
      title,
      description,
      content: content || '',
      tags,
      visibility: req.user ? visibility : 'public',
      creator: req.user?.username || 'anonymous',
      roomId: room_id,
      editToken: uuidv4(),
    };

    existingTokens.push(blockData.editToken);

    try {
      const newBlock = await createBlock(blockData);

      // 1️⃣ Guardar el token de edición
      res.cookie('edit_tokens', JSON.stringify(existingTokens), {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      });

      // 2️⃣ Si hubo contenido inicial, actualizamos el streak
      if (req.user && content && content.trim() !== '') {
        try {
          const updatedUser = await updateUserStreak(req.user.id);
          // Re-generar el JWT con el nuevo streakLength
          refreshAuthToken(res, updatedUser)
        } catch (streakErr) {
          console.error('Error updating streak on block create:', streakErr);
        }
      }

      // 3️⃣ Responder al cliente
      res.status(201).json(newBlock);
    } catch (error) {
      console.error('Error creating block:', error.message);
      res.status(500).json({ error: 'Failed to create block.' });
    }
  });

  /** 🌍 Global Block Endpoints **/

  // 📌 Get a single block by ID within a specific room
  globalRouter.get('/:block_id', async (req, res) => {
    const { block_id } = req.params;

    try {
      const block = await getBlockById(block_id);

      if (!block) {
        return res.status(404).json({ error: 'Block not found.' });
      }

      res.status(200).json(block);
    } catch (error) {
      console.error('Error fetching block:', error.message);
      res.status(500).json({ error: 'Failed to fetch block.' });
    }
  });

  // 📌 Get all blocks created on a specific date
  globalRouter.get('/by-date/:date', async (req, res) => {
    const { date } = req.params;

    try {
      const blocks = await getBlocksByDate(date);
      res.status(200).json(blocks);
    } catch (error) {
      console.error('Error fetching blocks by date:', error.message);
      res.status(500).json({ error: 'Failed to fetch blocks by date.' });
    }
  });

  // 📌 Get blocks created in a given year/month
  globalRouter.get('/dates/:year/:month', async (req, res) => {
    const { year, month } = req.params;

    try {
      const dates = await getBlockDatesByYearMonth(year, month);
      res.status(200).json(dates);
    } catch (error) {
      console.error('Error fetching block dates:', error.message);
      res.status(500).json({ error: 'Failed to fetch block dates.' });
    }
  });

  // 📌 Get all year/month combinations with blocks
  globalRouter.get('/dates', async (_, res) => {
    try {
      const dateCombos = await getAllBlockYearMonthCombos();
      res.status(200).json(dateCombos);
    } catch (error) {
      console.error('Error fetching block year/month combos:', error.message);
      res.status(500).json({ error: 'Failed to fetch block year/month combos.' });
    }
  });

  /** 🌍 Single Block Endpoints (Now inside Global Router) **/

  // 📌 Update the **content** of a block (Anyone can do this!)
  globalRouter.post('/:block_id/content', async (req, res) => {
    const { block_id } = req.params;
    const { content } = req.body;

    try {
      const block = await getBlockById(block_id);
      if (!block) {
        return res.status(404).json({ error: 'Block not found.' });
      }

      await updateBlock(block_id, { content });
      res.status(200).json({ message: 'Block content updated successfully.' });
    } catch (error) {
      console.error('Error updating block content:', error.message);
      res.status(500).json({ error: 'Failed to update block content.' });
    }
  });

  // 📌 Update the **metadata** of a block (Title, Description, Tags) → Requires Authentication or Edit Token
  globalRouter.post('/:block_id/metadata', optionalAuth, async (req, res) => {
    const { block_id } = req.params;
    const { title, description, tags, status } = req.body;

    try {
      const block = await getBlockById(block_id);
      if (!block) {
        return res.status(404).json({ error: 'Block not found.' });
      }

      // Check ownership before allowing edits
      const editTokens = req.cookies.edit_tokens ? JSON.parse(req.cookies.edit_tokens) : [];
      const isCreator = block.creator === req.user?.username;
      const hasEditToken = editTokens.includes(block.editToken);

      if (!isCreator && !hasEditToken) {
        return res.status(403).json({ error: 'You are not authorized to update this block.' });
      }

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (tags !== undefined) updates.tags = tags;
      if (status !== undefined) updates.status = status;

      await updateBlock(block_id, updates);
      res.status(200).json({ message: 'Block metadata updated successfully.' });
    } catch (error) {
      console.error('Error updating block metadata:', error.message);
      res.status(500).json({ error: 'Failed to update block metadata.' });
    }
  });

  // 📌 Delete a block (Requires Authentication or Edit Token)
  globalRouter.delete('/:block_id', optionalAuth, async (req, res) => {
    const { block_id } = req.params;

    try {
      const block = await getBlockById(block_id);
      if (!block) {
        return res.status(404).json({ error: 'Block not found.' });
      }

      const editTokens = req.cookies.edit_tokens ? JSON.parse(req.cookies.edit_tokens) : [];
      const isCreator = block.creator === req.user?.username;
      const hasEditToken = editTokens.includes(block.editToken);

      if (!isCreator && !hasEditToken) {
        return res.status(403).json({ error: 'You are not authorized to delete this block.' });
      }

      await deleteBlock(block_id);
      res.status(200).json({ message: 'Block deleted successfully.' });
    } catch (error) {
      console.error('Error deleting block:', error.message);
      res.status(500).json({ error: 'Failed to delete block.' });
    }
  });

  // 📌 Report/Flag a block
  globalRouter.post(
    '/:block_id/flags',
    optionalAuth,            // allows both anon and logged-in
    async (req, res) => {
      const { block_id } = req.params;
      const { reason, description } = req.body;
      const reporter = req.user?.username || null;

      if (!reason) {
        return res.status(400).json({ error: 'Reason is required.' });
      }

      try {
        const flag = await createFlag({
          blockId: block_id,
          reason,
          description,
          reporter,
        });
        res.status(201).json(flag);
      } catch (err) {
        console.error('Error creating flag:', err);
        res.status(500).json({ error: 'Failed to submit report.' });
      }
    }
  );

  // 📌 List flags for moderation
  globalRouter.get(
    '/:block_id/flags',
    /* you might restrict this to admins */
    async (req, res) => {
      try {
        const flags = await getFlagsByBlock(req.params.block_id);
        res.status(200).json(flags);
      } catch (err) {
        console.error('Error fetching flags:', err);
        res.status(500).json({ error: 'Failed to fetch flags.' });
      }
    }
  );

};

export default useBlockAPI;

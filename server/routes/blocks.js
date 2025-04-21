import express from 'express';

import { config } from '../../config/config.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { getBlockById } from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { getPeerIDs } from '../db/sessionService.js';
import { generateAnonymousId } from '../utils/anonymousId.js';
import { canManageBlock } from '../utils/block.js';

const port = config.port || 3000;

const backendBaseUrl = `${(config.backendUrl || `http://localhost:${port}`)}`;

const router = express.Router();

// Render "Create New Block" page
router.get('/rooms/:room_id/blocks/new', optionalAuth, async (req, res) => {
  const { room_id } = req.params;
  const roomMetadata = await getRoomMetadata(room_id);

  res.render('rooms/create-block', {
    title: 'Create a New Block',
    room_id,
    roomMetadata,
    user: req.user,
  });
});

// Render Block Editor Page
router.get('/rooms/:room_id/blocks/:block_id/edit', optionalAuth, async (req, res) => {
  const { room_id, block_id } = req.params;
  const user = req.user;
  const editTokens = req.cookies.edit_tokens ? JSON.parse(req.cookies.edit_tokens) : [];

  try {
    // Fetch block metadata
    const block = await getBlockById(block_id);
    if (!block || block.roomId !== room_id) {
      return res.status(404).render('error', { message: 'Block not found or does not belong to this room.' });
    }

    const collaboratorId = user ? user.username : req.cookies.anonymousId || generateAnonymousId();
    if (!block.collaborators.includes(collaboratorId)) {
      block.collaborators.push(collaboratorId);
      await block.save();
      // Si el usuario anónimo, asegúrate de guardarlo en una cookie
      if (!user && !req.cookies.anonymousId) {
        res.cookie('anonymousId', collaboratorId, { maxAge: 24 * 60 * 60 * 1000 });
      }
    }

    // Fetch active peers for this block
    const peerIDs = await getPeerIDs(block_id);

    // If the block is full, redirect to a "Full Block" page
    if (peerIDs.length >= 6) {
      return res.render('fullBlock', {
        block_title: block.title,
        room_id,
      });
    }

    // Pick one peer randomly to set as initialTargetPeerId
    const initialTargetPeerId = peerIDs.length > 0
      ? peerIDs[Math.floor(Math.random() * peerIDs.length)]
      : '0';

    const roomMetadata = await getRoomMetadata(room_id);

    // Render the block editor page
    res.render('rooms/block-editor', {
      title: `Edit Block - ${block.title}`,
      block,
      room_id,
      roomName: roomMetadata.name,
      block_id,
      user,
      peerIDs,
      initialTargetPeerId,
      canManageBlock: canManageBlock(user, block, editTokens), // Determines if user can edit metadata/delete
      backendURL: backendBaseUrl, // Adjust based on your env vars
    });
  } catch (error) {
    console.error('Error loading block editor:', error.message);
    res.status(500).render('error', { message: 'An error occurred while loading the block editor.' });
  }
});

export default router;

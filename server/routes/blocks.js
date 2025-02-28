import express from 'express';

import { config } from '../../config/config.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { getBlockById } from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { getPeerIDs } from '../db/sessionService.js';

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

    // Determine if the user has editing privileges
    const isCreator = user && user.username === block.creator;
    const hasEditToken = editTokens.includes(block.editToken);
    const canManageBlock = isCreator || hasEditToken;

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
      canManageBlock, // Determines if user can edit metadata/delete
      backendURL: backendBaseUrl, // Adjust based on your env vars
    });
  } catch (error) {
    console.error('Error loading block editor:', error.message);
    res.status(500).render('error', { message: 'An error occurred while loading the block editor.' });
  }
});

export default router;

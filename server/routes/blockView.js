import express from 'express';
import { getBlockById } from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';
import MarkdownIt from 'markdown-it';
import optionalAuth from '../middleware/optionalAuth.js';

const router = express.Router();
const md = new MarkdownIt();

router.get('/rooms/:room_id/blocks/:block_id', optionalAuth, async (req, res) => {
  try {
    const { room_id, block_id } = req.params;
    const block = await getBlockById(block_id);

    // Check if block exists and matches the room
    if (!block || block.roomId !== room_id) {
      return res.status(404).send('Block not found');
    }

    block.contentHTML = renderMarkdownContent(block.content);

    // Attach user vote info if logged in
    if (req.user) {
      const userVote = block.votes.find(vote => vote.userId === req.user.id)?.type;
      block.userVote = userVote;
    }

    const title = `${block.title}`;
    const header = block.title;

    const roomMetadata = await getRoomMetadata(room_id);

    res.render('rooms/block-view', {
      room_id,
      roomName: roomMetadata.name,
      block,
      title,
      header,
      user: req.user
    });

  } catch (error) {
    console.error("Error loading block view:", error);
    res.status(500).send('Error loading block view.');
  }
});

export default router;

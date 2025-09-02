import express from 'express';
import {
  getBlockById,
  getTranslations,
  getTranslationByGroupAndLang
} from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { addI18n } from '../services/i18n.js';
import { canManageBlock } from '../utils/block.js';

const router = express.Router();

function canonicalBlockPath(doc) {
  return `/rooms/${doc.roomId}/blocks/${doc._id}`;
}

router.get('/rooms/:room_id/blocks/:block_id', optionalAuth, addI18n(['blockTags']), async (req, res) => {
  try {
    const { room_id, block_id } = req.params;
    const block = await getBlockById(block_id);
    const editTokens = req.cookies.edit_tokens ? JSON.parse(req.cookies.edit_tokens) : [];

    // Check if block exists and matches the room
    if (!block || block.roomId !== room_id) {
      return res.status(404).send('Block not found');
    }

    const requestedLang = req.query?.lang;
    if (requestedLang && requestedLang !== block.lang) {
      const target = await getTranslationByGroupAndLang(block.groupId, requestedLang);

      if (target) {
        const targetUrl = canonicalBlockPath(target);

        if (req.path !== targetUrl) {
          return res.redirect(302, targetUrl);
        }
      }
    }

    block.contentHTML = renderMarkdownContent(block.content);
    const descriptionHTML = renderMarkdownContent(block.description);
    const translations = await getTranslations(block.groupId);



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
      descriptionHTML,
      title,
      header,
      translations,
      canManageBlock: canManageBlock(req.user, block, editTokens),
      user: req.user,
      lang: block.lang
    });

  } catch (error) {
    console.error("Error loading block view:", error);
    res.status(500).send('Error loading block view.');
  }
});

export default router;

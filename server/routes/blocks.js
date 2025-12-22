import express from 'express';

import { config } from '../../config/config.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { getBlockById } from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { getPeerIDs } from '../db/sessionService.js';
import { addI18n } from '../services/i18n.js';
import { generateAnonymousId } from '../utils/anonymousId.js';
import { canManageBlock } from '../utils/block.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';

const port = config.port || 3000;

const backendBaseUrl = `${(config.backendUrl || `http://localhost:${port}`)}`;

const router = express.Router();

// Render "Create New Block" page
router.get('/rooms/:room_id/blocks/new', optionalAuth, addI18n(['createBlock', 'blockTags']), async (req, res) => {
  const { room_id } = req.params;
  const lang = res.locals.lang;
  const roomMetadata = await getRoomMetadata(room_id, lang);

  res.render('rooms/create-block', {
    title: res.locals.t('createBlock.meta.title'),
    description: res.locals.t('createBlock.meta.description'),
    room_id,
    roomMetadata,
    user: req.user,
  });
});

// Render Block Editor Page
router.get(
  '/rooms/:room_id/blocks/:block_id/edit',
  optionalAuth,
  addI18n(['blockEditor', 'blockTags', 'blockCommon']),
  async (req, res) => {
    const { room_id, block_id } = req.params;
    const { t, lang } = res.locals;
    const user = req.user;
    const editTokens = req.cookies.edit_tokens
      ? JSON.parse(req.cookies.edit_tokens)
      : [];

    try {
      // Fetch block metadata
      const block = await getBlockById(block_id);
      if (!block || block.roomId !== room_id) {
        return res
          .status(404)
          .render('error', {
            message: t('blockEditor.errors.notFound')
          });
      }

      const descriptionHTML = renderMarkdownContent(block.description);

      const collaboratorId =
        user
          ? user.username
          : (req.cookies.anonymousId || generateAnonymousId());

      if (!block.collaborators.includes(collaboratorId)) {
        block.collaborators.push(collaboratorId);
        await block.save();
        // Si el usuario es anónimo, guardamos el id en cookie
        if (!user && !req.cookies.anonymousId) {
          res.cookie('anonymousId', collaboratorId, {
            maxAge: 24 * 60 * 60 * 1000
          });
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

      // Room metadata localizado
      const roomMetadata = await getRoomMetadata(room_id, lang || 'en');
      const roomName = roomMetadata.displayName || roomMetadata.name;

      // Título i18n
      const pageTitle =
        t('blockEditor.meta.title', { blockTitle: block.title })
        || `${t('blockEditor.meta.titleFallback')} - ${block.title}`;

      // Render the block editor page
      res.render('rooms/block-editor', {
        title: pageTitle,
        block,
        descriptionHTML,
        room_id,
        roomName,
        block_id,
        user,
        turnUsername: config.turnUsername,
        turnCredential: config.turnCredential,
        peerIDs,
        initialTargetPeerId,
        canManageBlock: canManageBlock(user, block, editTokens),
        backendURL: backendBaseUrl,
        lang: lang || 'en',
      });
    } catch (error) {
      console.error('Error loading block editor:', error.message);
      res
        .status(500)
        .render('error', {
          message: t('blockEditor.errors.loadFailed')
        });
    }
  }
);

export default router;

import express from 'express';

import { config } from '../../config/config.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { resolveBlockLangParam } from '../middleware/resolveBlockLangParam.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { getBlockById, getTranslationByGroupAndLang } from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { getPeerIDs } from '../db/sessionService.js';
import { addI18n } from '../services/i18n.js';
import { getUiLang } from '../services/localeContext.js';
import { generateAnonymousId } from '../utils/anonymousId.js';
import { canManageBlock } from '../utils/block.js';
import { canonicalBlockEditPath } from '../utils/canonical.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';

const port = config.port || 3000;

const backendBaseUrl = `${(config.backendUrl || `http://localhost:${port}`)}`;

const router = express.Router();

// Render "Create New Block" page
router.get(
  '/rooms/:room_id/blocks/new',
  optionalAuth,
  addI18n(['createBlock', 'blockTags']),
  stripLegacyLang({ canonicalPath: (req) => `/rooms/${req.params.room_id}/blocks/new` }),
  async (req, res) => {
    try {
      const { room_id } = req.params;
      const { t } = res.locals;

      const uiLang = getUiLang(res);
      const roomMetadata = await getRoomMetadata(room_id, uiLang);

      res.render('rooms/create-block', {
        title: t('createBlock.meta.title'),
        description: t('createBlock.meta.description'),
        room_id,
        roomMetadata,
        user: req.user || null,
        uiLang,
      });
    } catch (error) {
      console.error('Error loading create-block page:', error);
      return res.status(500).render('error', { message: 'Error loading create-block page.' });
    }
  }
);

// Render Block Editor Page
router.get(
  '/rooms/:room_id/blocks/:block_id/edit',
  optionalAuth,
  addI18n(['blockEditor', 'blockTags', 'blockCommon']),
  resolveBlockLangParam({
    loadBlock: async (req) => {
      const block = await getBlockById(req.params.block_id);
      if (!block || block.roomId !== req.params.room_id) return null;
      return block;
    },
    getTranslation: getTranslationByGroupAndLang,
    canonicalPathForBlock: canonicalBlockEditPath,
  }),
  async (req, res) => {
    const { room_id, block_id } = req.params;
    const { t } = res.locals;
    const user = req.user;

    const editTokens = req.cookies.edit_tokens
      ? JSON.parse(req.cookies.edit_tokens)
      : [];

    try {
      const block = await getBlockById(block_id);
      if (!block || block.roomId !== room_id) {
        return res.status(404).render('error', {
          message: t('blockEditor.errors.notFound')
        });
      }

      // UI language (chrome)
      const uiLang = res.locals.uiLang || res.locals.lang || 'en';

      const descriptionHTML = renderMarkdownContent(block.description, { emptyHtml: '' });

      const collaboratorId = user
        ? user.username
        : (req.cookies.anonymousId || generateAnonymousId());

      if (!block.collaborators.includes(collaboratorId)) {
        block.collaborators.push(collaboratorId);
        await block.save();

        if (!user && !req.cookies.anonymousId) {
          res.cookie('anonymousId', collaboratorId, {
            maxAge: 24 * 60 * 60 * 1000
          });
        }
      }

      const peerIDs = await getPeerIDs(block_id);

      if (peerIDs.length >= 6) {
        return res.render('fullBlock', {
          block_title: block.title,
          room_id
        });
      }

      const initialTargetPeerId =
        peerIDs.length > 0
          ? peerIDs[Math.floor(Math.random() * peerIDs.length)]
          : '0';

      // Room metadata localized to UI lang (chrome)
      const roomMetadata = await getRoomMetadata(room_id, uiLang);
      const roomName = roomMetadata.displayName || roomMetadata.name;

      // Page title i18n
      const key = 'blockEditor.meta.title';
      const raw = t(key, { blockTitle: block.title });
      const pageTitle =
        raw && raw !== key
          ? raw
          : `${t('blockEditor.meta.titleFallback')} - ${block.title}`;

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

        // Make the split explicit:
        uiLang,              // UI chrome language
        lang: block.lang     // content language used by template wrappers (if you follow your block-view convention)
      });
    } catch (error) {
      console.error('Error loading block editor:', error.message);
      return res.status(500).render('error', {
        message: t('blockEditor.errors.loadFailed')
      });
    }
  }
);


export default router;

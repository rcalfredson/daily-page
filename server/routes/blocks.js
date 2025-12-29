import express from 'express';

import { config } from '../../config/config.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { getBlockById, getTranslationByGroupAndLang } from '../db/blockService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { getPeerIDs } from '../db/sessionService.js';
import { addI18n } from '../services/i18n.js';
import { getUiQueryLang } from '../services/localization.js';
import { generateAnonymousId } from '../utils/anonymousId.js';
import { canManageBlock } from '../utils/block.js';
import { canonicalBlockEditPath } from '../utils/canonical.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';
import { withQuery } from '../utils/urls.js';

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

      // Translation selector (legacy): ?lang=
      const requestedLang = req.query?.lang;

      // If ?lang= is present, we never keep it on canonical URLs.
      if (requestedLang) {
        let target = null;

        // Only try to resolve translation if requestedLang differs
        if (requestedLang !== block.lang) {
          target = await getTranslationByGroupAndLang(block.groupId, requestedLang);
        }

        const redirectQuery = { ...req.query };
        delete redirectQuery.lang;

        const uiFromQuery = getUiQueryLang(req);
        if (uiFromQuery) redirectQuery.ui = uiFromQuery;
        else delete redirectQuery.ui;

        if (target) {
          const targetPath = canonicalBlockEditPath(target);
          if (req.path !== targetPath) {
            return res.redirect(302, withQuery(targetPath, redirectQuery));
          }
        } else {
          // requestedLang missing/invalid OR equals block.lang:
          // Redirect to same canonical edit URL but without ?lang=
          const selfPath = canonicalBlockEditPath(block);
          if (req.path !== selfPath || 'lang' in req.query) {
            return res.redirect(302, withQuery(selfPath, redirectQuery));
          }
        }
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

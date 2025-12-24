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
import { withQuery } from '../utils/urls.js';

const router = express.Router();

function canonicalBlockPath(doc) {
  return `/rooms/${doc.roomId}/blocks/${doc._id}`;
}

router.get(
  '/rooms/:room_id/blocks/:block_id',
  optionalAuth,
  addI18n(['blockView', 'blockTags', 'blockCommon', 'flagModal']),
  async (req, res) => {
    try {
      const { room_id, block_id } = req.params;
      const { t } = res.locals;

      const block = await getBlockById(block_id);
      const editTokens = req.cookies.edit_tokens ? JSON.parse(req.cookies.edit_tokens) : [];

      if (!block || block.roomId !== room_id) {
        return res.status(404).render('error', {
          message: t('blockView.errors.notFound')
        });
      }

      const { lang: uiLang } = res.locals;

      const contentLang = req.query?.lang;
      if (contentLang && contentLang !== block.lang) {
        const target = await getTranslationByGroupAndLang(block.groupId, contentLang);
        if (target) {
          const targetPath = canonicalBlockPath(target);

          const ui = req.query?.ui || uiLang;

          if (req.path !== targetPath) {
            const redirectQuery = { ...req.query, ui };
            delete redirectQuery.lang;
            return res.redirect(302, withQuery(targetPath, redirectQuery));
          }
        }
      }

      block.contentHTML = renderMarkdownContent(block.content);
      const descriptionHTML = renderMarkdownContent(block.description);
      const translations = await getTranslations(block.groupId);

      if (req.user) {
        const userVote = block.votes.find(vote => vote.userId === req.user.id)?.type;
        block.userVote = userVote;
      }

      // Room metadata localized (match your editor approach)
      const roomMetadata = await getRoomMetadata(room_id, uiLang || 'en');
      const roomName = roomMetadata.displayName || roomMetadata.name;

      // Page title i18n w/ safe fallback
      const key = 'blockView.meta.title';
      const raw = t(key, { blockTitle: block.title });
      const title =
        raw && raw !== key
          ? raw
          : `${t('blockView.meta.titleFallback')} - ${block.title}`;

      res.render('rooms/block-view', {
        room_id,
        roomName,
        block,
        descriptionHTML,
        title,
        header: block.title,
        translations,
        canManageBlock: canManageBlock(req.user, block, editTokens),
        user: req.user,
        uiLang,
        lang: block.lang
      });
    } catch (error) {
      console.error('Error loading block view:', error);
      return res.status(500).render('error', {
        message: t('blockView.errors.loadFailed')
      });
    }
  }
);

export default router;

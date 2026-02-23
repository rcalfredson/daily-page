import express from 'express';
import {
  getBlockById,
  getTranslations,
  getTranslationByGroupAndLang
} from '../db/blockService.js';
import { getReactionCounts, getUserReactionsForBlock } from '../db/reactionService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { resolveBlockLangParam } from '../middleware/resolveBlockLangParam.js';
import { addI18n } from '../services/i18n.js';
import { canManageBlock } from '../utils/block.js';
import { canonicalBlockPath } from '../utils/canonical.js';

const router = express.Router();

router.get(
  '/rooms/:room_id/blocks/:block_id',
  optionalAuth,
  addI18n([
    'blockView',
    'blockTags',
    'blockCommon',
    'flagModal',
    'voteControls',
    'reactions']),
  resolveBlockLangParam({
    loadBlock: async (req) => {
      const block = await getBlockById(req.params.block_id);
      if (!block || block.roomId !== req.params.room_id) return null;
      return block;
    },
    getTranslation: getTranslationByGroupAndLang,
    canonicalPathForBlock: canonicalBlockPath,
  }),
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

      const uiLang = res.locals.uiLang || res.locals.lang || 'en';

      block.contentHTML = renderMarkdownContent(block.content, { emptyHtml: '' });
      const descriptionHTML = renderMarkdownContent(block.description, { emptyHtml: '' });
      const translations = await getTranslations(block.groupId);

      const reactionCounts = await getReactionCounts(block_id);

      let userReactions = [];
      if (req.user) {
        userReactions = await getUserReactionsForBlock({ blockId: block_id, userId: req.user.id });
      }

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
        reactionCounts,
        userReactions,
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

import express from 'express';
import {
  getBlockById,
  getTranslations,
  getTranslationByGroupAndLang
} from '../db/blockService.js';
import { getBlockEditorialContext } from '../db/blockEditorialContextService.js';
import {
  getCommentsForBlockView,
  getFocusedCommentThreadForBlockView
} from '../db/commentService.js';
import { getReactionCounts, getUserReactionsForBlock } from '../db/reactionService.js';
import { getRoomMetadata } from '../db/roomService.js';
import { findUserById, findUserByUsername } from '../db/userService.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { resolveBlockLangParam } from '../middleware/resolveBlockLangParam.js';
import { addI18n } from '../services/i18n.js';
import { canManageBlock } from '../utils/block.js';
import { canonicalBlockPath } from '../utils/canonical.js';

const router = express.Router();
const INITIAL_COMMENT_LIMIT = 20;

function normalizeCommentsSortDir(sortDir) {
  return sortDir === 'desc' ? 'desc' : 'asc';
}

function normalizeCommentId(commentId) {
  const value = String(commentId || '').trim();
  return value || null;
}

router.get(
  '/rooms/:room_id/blocks/:block_id',
  optionalAuth,
  addI18n([
    'blockView',
    'blockTags',
    'blockCommon',
    'modals',
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
    const t = res.locals.t || ((key) => key);

    try {
      const { room_id, block_id } = req.params;
      const commentsSortDir = normalizeCommentsSortDir(req.query.commentsDir);
      const deepLinkCommentId = normalizeCommentId(req.query.commentId);

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

      const [reactionCounts, commentsData, focusedCommentData, dbUser, authorUser, editorialContext] = await Promise.all([
        getReactionCounts(block_id),
        getCommentsForBlockView({
          blockId: block_id,
          limit: INITIAL_COMMENT_LIMIT,
          sortDir: commentsSortDir,
          viewerUserId: req.user?.id || null
        }),
        deepLinkCommentId
          ? getFocusedCommentThreadForBlockView({
              blockId: block_id,
              commentId: deepLinkCommentId,
              sortDir: commentsSortDir,
              viewerUserId: req.user?.id || null
            })
          : Promise.resolve({
              status: 'idle',
              targetCommentId: null,
              topLevelCommentId: null,
              thread: null
            }),
        req.user?.id ? findUserById(req.user.id) : Promise.resolve(null),
        block.creator && block.creator !== 'anonymous'
          ? findUserByUsername(block.creator)
          : Promise.resolve(null),
        getBlockEditorialContext(block)
      ]);

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
      const roomName = roomMetadata?.displayName || roomMetadata?.name || room_id;
      const authorProfile = block.creator
        ? {
          username: block.creator,
          profilePath: block.creator !== 'anonymous'
            ? `/users/${encodeURIComponent(block.creator)}`
            : null,
          avatarUrl: authorUser?.profilePic || '/assets/img/default-pic.png'
        }
        : null;

      // Page title i18n w/ safe fallback
      const key = 'blockView.meta.title';
      const raw = t(key, { blockTitle: block.title });
      const title =
        raw && raw !== key
          ? raw
          : `${t('blockView.meta.titleFallback')} - ${block.title}`;

      const focusedThreadAlreadyIncluded = Boolean(
        focusedCommentData?.topLevelCommentId &&
        commentsData.comments.some((comment) => String(comment._id) === String(focusedCommentData.topLevelCommentId))
      );

      res.render('rooms/block-view', {
        room_id,
        roomName,
        authorProfile,
        block,
        editorialContext,
        descriptionHTML,
        title,
        header: block.title,
        translations,
        canManageBlock: canManageBlock(req.user, block, editTokens),
        user: req.user,
        reactionCounts,
        userReactions,
        comments: commentsData.comments,
        commentsTotal: commentsData.total,
        commentsTopLevelTotal: commentsData.topLevelTotal,
        commentsLimit: commentsData.limit,
        commentsHasMore: commentsData.hasMore,
        commentsSortDir,
        commentsFocusedThread: focusedThreadAlreadyIncluded ? null : (focusedCommentData.thread || null),
        commentsDeepLinkCommentId: focusedCommentData.targetCommentId || null,
        commentsDeepLinkStatus: focusedCommentData.status || 'idle',
        commentComposerCanSubmit: Boolean(req.user?.id && dbUser?.verified),
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

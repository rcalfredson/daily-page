import express from 'express';
import optionalAuth from '../middleware/optionalAuth.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { addI18n } from '../services/i18n.js';
import { getUiLang } from '../services/localeContext.js';
import {
  getQuestBySlug,
  getQuestLeaderboard,
  getQuestProgress,
  listApprovedQuestPosts,
  listPublicQuestsOverview,
  listQuestItems
} from '../db/questService.js';
import { listUserQuestSubmissions } from '../db/questSubmissionReadService.js';
import { questAcceptsNewWork } from '../db/questDomain.js';
import { findUserById } from '../db/userService.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';

const router = express.Router();

function positivePage(value) {
  return Math.max(1, Number.parseInt(value, 10) || 1);
}

function paginationBase(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function renderQuestNotFound(res) {
  return res.status(404).render('error', {
    title: res.locals.t('quests.errors.notFoundTitle'),
    message: res.locals.t('quests.errors.notFound')
  });
}

router.get(
  '/quests',
  optionalAuth,
  addI18n(['quests']),
  stripLegacyLang({ canonicalPath: '/quests' }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);
      const page = positivePage(req.query.page);
      const result = await listPublicQuestsOverview({ uiLang, page, limit: 12 });

      return res.render('quests/index', {
        title: t('quests.overview.meta.title'),
        description: t('quests.overview.meta.description'),
        quests: result.quests,
        currentPage: result.page,
        totalPages: Math.ceil(result.total / result.limit),
        paginationBaseUrl: '/quests',
        uiLang,
        user: req.user || null
      });
    } catch (error) {
      console.error('Error loading quest directory:', error);
      return res.status(500).render('error', {
        message: res.locals.t('quests.errors.loadFailed')
      });
    }
  }
);

router.get(
  '/quests/:slug/leaderboard',
  optionalAuth,
  addI18n(['quests']),
  stripLegacyLang({
    canonicalPath: req => `/quests/${encodeURIComponent(req.params.slug)}/leaderboard`
  }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);
      const quest = await getQuestBySlug({ slug: req.params.slug, uiLang });
      if (!quest) return renderQuestNotFound(res);

      const page = positivePage(req.query.page);
      const leaderboard = await getQuestLeaderboard({ questId: quest._id, page, limit: 25 });
      return res.render('quests/leaderboard', {
        title: t('quests.leaderboard.meta.title', { questName: quest.displayName }),
        description: t('quests.leaderboard.meta.description', { questName: quest.displayName }),
        quest,
        entries: leaderboard.entries,
        targetCount: leaderboard.targetCount,
        pageSize: leaderboard.limit,
        currentPage: leaderboard.page,
        totalPages: Math.ceil(leaderboard.total / leaderboard.limit),
        paginationBaseUrl: `/quests/${quest.slug}/leaderboard`,
        uiLang,
        user: req.user || null
      });
    } catch (error) {
      console.error(`Error loading quest leaderboard ${req.params.slug}:`, error);
      return res.status(error?.status || 500).render('error', {
        message: res.locals.t('quests.errors.loadFailed')
      });
    }
  }
);

router.get(
  '/quests/:slug',
  optionalAuth,
  addI18n(['quests']),
  stripLegacyLang({ canonicalPath: req => `/quests/${encodeURIComponent(req.params.slug)}` }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);
      const quest = await getQuestBySlug({ slug: req.params.slug, uiLang });
      if (!quest) return renderQuestNotFound(res);

      const page = positivePage(req.query.page);
      const requestedView = req.query.view === 'posts' ? 'posts' : 'items';
      const view = quest.type === 'count' ? 'posts' : requestedView;
      const state = String(req.query.state || '').trim() || null;
      const searchQuery = String(req.query.q || '').trim();
      const [progress, administrator, content, mine] = await Promise.all([
        getQuestProgress({ questId: quest._id }),
        findUserById(quest.administratorUserId),
        view === 'items'
          ? listQuestItems({
              questId: quest._id,
              state,
              query: searchQuery,
              page,
              limit: 24,
              uiLang,
              userId: req.user?.id || null
            })
          : listApprovedQuestPosts({ questId: quest._id, page, limit: 12 }),
        req.user
          ? listUserQuestSubmissions({
              questId: quest._id, userId: req.user.id, page: 1, limit: 100, uiLang
            })
          : Promise.resolve({ submissions: [] })
      ]);
      const totalPages = Math.ceil(content.total / content.limit);
      const visibleMine = mine.submissions.filter(submission =>
        ['draft', 'pending', 'changes-requested', 'approved'].includes(submission.status)
      );
      const submissionByItemId = {};
      for (const submission of visibleMine) {
        if (submission.item && !submissionByItemId[submission.item.id]) {
          submissionByItemId[submission.item.id] = submission;
        }
      }
      const baseParams = view === 'items'
        ? { view: 'items', state: content.state, q: content.query }
        : { view: 'posts' };

      return res.render('quests/detail', {
        title: t('quests.detail.meta.title', { questName: quest.displayName }),
        description: quest.displayDescription || t('quests.detail.meta.description'),
        quest,
        progress,
        administrator: administrator ? { username: administrator.username } : null,
        descriptionHTML: renderMarkdownContent(quest.displayDescription, {
          emptyHtml: '', allowStreetViewEmbeds: false
        }),
        instructionsHTML: renderMarkdownContent(quest.displayInstructions, {
          emptyHtml: '', allowStreetViewEmbeds: false
        }),
        view,
        items: content.items || [],
        posts: content.posts || [],
        itemState: content.state || null,
        searchQuery: content.query || '',
        currentPage: content.page,
        totalPages,
        paginationBaseUrl: paginationBase(`/quests/${quest.slug}`, baseParams),
        uiLang,
        user: req.user || null,
        canContribute: Boolean(req.user) && questAcceptsNewWork(quest),
        mySubmissions: visibleMine,
        mySubmissionByItemId: submissionByItemId
      });
    } catch (error) {
      console.error(`Error loading quest ${req.params.slug}:`, error);
      return res.status(error?.status || 500).render('error', {
        message: res.locals.t('quests.errors.loadFailed')
      });
    }
  }
);

export default router;

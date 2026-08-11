import express from 'express';
import Block from '../db/models/Block.js';
import {
  findByTagWithLangPref,
  getAllTagsWithCounts,
  getTagTrendData,
  publiclyVisibleBlockMatch
} from '../db/blockService.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { addI18n } from '../services/i18n.js';
import { toBlockPreviewDTO } from '../utils/block.js';
import { getUiLang, getPreferredContentLang } from '../services/localeContext.js';
import {
  createStageProfiler,
  tagProfilingOptions
} from '../services/stageProfiler.js';

const router = express.Router();
const tagTrendTimeframes = ['7d', '30d', 'all'];

function normalizeTagTrendTimeframe(value) {
  return tagTrendTimeframes.includes(value) ? value : '30d';
}

function tagTrendDays(timeframe) {
  return timeframe === 'all' ? 'all' : Number.parseInt(timeframe, 10);
}

router.get(
  '/tags',
  addI18n(['tags']),
  stripLegacyLang({ canonicalPath: '/tags' }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);

      const requestedTimeframe = req.query.timeframe || null;

      const timeframesOrder = ['24h', '7d', '30d', 'all'];

      let timeframe = requestedTimeframe;
      let tags = [];

      // If no explicit timeframe, auto-pick the first non-empty one
      if (!requestedTimeframe) {
        for (const tf of timeframesOrder) {
          const candidateTags = await getAllTagsWithCounts(tf, uiLang);
          if (candidateTags && candidateTags.length > 0) {
            tags = candidateTags;
            timeframe = tf;
            break;
          }
        }

        // If still empty, default to 'all'
        if (!tags.length) {
          tags = await getAllTagsWithCounts('all', uiLang);
          timeframe = 'all';
        }
      } else {
        tags = await getAllTagsWithCounts(requestedTimeframe, uiLang);
        timeframe = requestedTimeframe;
      }

      const timeframes = [
        { key: '24h', label: t('tags.timeframe.last24h') },
        { key: '7d', label: t('tags.timeframe.last7d') },
        { key: '30d', label: t('tags.timeframe.last30d') },
        { key: 'all', label: t('tags.timeframe.all') }
      ];

      res.render('tags/index', {
        title: t('tags.meta.title'),
        description: t('tags.meta.description'),
        tags,
        timeframe,
        timeframes,
        user: req.user || null,
        uiLang,
      });
    } catch (error) {
      console.error('Error loading tags overview:', error);
      const { t } = res.locals;
      res.status(500).render('error', { message: t('tags.error.loading') });
    }
  });

router.get('/tags/:tagName/trend', async (req, res) => {
  const timeframe = normalizeTagTrendTimeframe(req.query.timeframe);
  const profiler = createStageProfiler({
    scope: 'tag_trend',
    metadata: { tagName: req.params.tagName, timeframe },
    ...tagProfilingOptions(),
  });

  try {
    const trendData = await profiler.measure(
      'trend_query',
      () => getTagTrendData(
        req.params.tagName,
        tagTrendDays(timeframe),
        { dedupeGroups: true }
      ),
      rows => ({ returned: rows.length })
    );

    profiler.finish({ status: 'ok' });
    res.json({ timeframe, trendData });
  } catch (error) {
    profiler.finish({ status: 'error', errorName: error?.name || 'Error' });
    console.error('Error loading tag trend:', error);
    res.status(500).json({ error: 'Unable to load tag activity' });
  }
});

// Página específica para mostrar bloques por etiqueta
router.get(
  '/tags/:tagName',
  optionalAuth,
  addI18n([
    'blockCommon', 'tags', 'translation', 'readMore', 'voteControls', 'reactions'
  ]),
  stripLegacyLang({
    canonicalPath: (req) => `/tags/${encodeURIComponent(req.params.tagName)}`
  }),
  async (req, res) => {
    const { tagName } = req.params;
    const trendTimeframe = normalizeTagTrendTimeframe(req.query.timeframe);
    const profiler = createStageProfiler({
      scope: 'tag_detail',
      metadata: {
        tagName,
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        timeframe: trendTimeframe,
      },
      ...tagProfilingOptions(),
    });

    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);
      const preferredContentLang = getPreferredContentLang(res);

      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const skip = (page - 1) * limit;
      const userId = req.user?.id || null;

      // Obtener bloques asociados con la etiqueta especificada
      let taggedBlocks = await profiler.measure(
        'tagged_blocks_query',
        () => findByTagWithLangPref({
          tag: tagName,
          preferredLang: preferredContentLang,
          sortBy: "voteCount",
          skip,
          limit,
        }),
        rows => ({ returned: rows.length })
      );

      taggedBlocks = await profiler.measure(
        'preview_render',
        () => taggedBlocks.map(b => toBlockPreviewDTO(b, { userId })),
        rows => ({ rendered: rows.length })
      );

      const totalBlocks = await profiler.measure(
        'distinct_group_count_query',
        () => Block
          .distinct("groupId", publiclyVisibleBlockMatch({ tags: tagName }))
          .then(arr => arr.length),
        count => ({ count })
      );

      const totalPages = Math.ceil(totalBlocks / limit);

      const trendData = await profiler.measure(
        'trend_query',
        () => getTagTrendData(
          tagName,
          tagTrendDays(trendTimeframe),
          { dedupeGroups: true }
        ),
        rows => ({ returned: rows.length })
      );

      // Title bits come from i18n, tagName stays dynamic
      const titlePrefix = t('tags.detail.meta.titlePrefix') || '#';
      const titleSuffix = t('tags.detail.meta.titleSuffix') || ' | Daily Page';

      profiler.finish({ status: 'ok', totalBlocks });
      res.render('tags/tag', {
        title: `${titlePrefix}${tagName}${titleSuffix}`,
        tagName,
        taggedBlocks,
        currentPage: page,
        totalPages,
        totalBlocks,
        trendData,
        trendTimeframe,
        user: req.user || null,
        uiLang,
        preferredContentLang,
      });
    } catch (error) {
      profiler.finish({ status: 'error', errorName: error?.name || 'Error' });
      const { t } = res.locals;
      console.error('Error loading tag page:', error);
      res
        .status(500)
        .render('error', { message: t('tags.detail.error.loadingTagPage') });
    }
  }
);

export default router;

import express from 'express';
import Block from '../db/models/Block.js';
import { findByTagWithLangPref, getAllTagsWithCounts, getTagTrendData } from '../db/blockService.js';
import optionalAuth from '../middleware/optionalAuth.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { addI18n } from '../services/i18n.js';
import { toBlockPreviewDTO } from '../utils/block.js';
import { getUiLang, getPreferredContentLang } from '../services/localeContext.js';

const router = express.Router();

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
          const candidateTags = await getAllTagsWithCounts(tf);
          if (candidateTags && candidateTags.length > 0) {
            tags = candidateTags;
            timeframe = tf;
            break;
          }
        }

        // If still empty, default to 'all'
        if (!tags.length) {
          tags = await getAllTagsWithCounts('all');
          timeframe = 'all';
        }
      } else {
        tags = await getAllTagsWithCounts(requestedTimeframe);
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

// Página específica para mostrar bloques por etiqueta
router.get(
  '/tags/:tagName',
  optionalAuth,
  addI18n(['tags', 'translation', 'readMore', 'voteControls', 'reactions']),
  stripLegacyLang({
    canonicalPath: (req) => `/tags/${encodeURIComponent(req.params.tagName)}`
  }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);
      const preferredContentLang = getPreferredContentLang(res);

      const { tagName } = req.params;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const skip = (page - 1) * limit;

      const userId = req.user?.id || null;

      // Obtener bloques asociados con la etiqueta especificada
      let taggedBlocks = await findByTagWithLangPref({
        tag: tagName,
        preferredLang: preferredContentLang,
        sortBy: "voteCount",
        skip,
        limit,
      });

      taggedBlocks = taggedBlocks.map(b =>
        toBlockPreviewDTO(b, { userId })
      );

      const totalBlocks = await Block
        .distinct("groupId", { tags: tagName })
        .then(arr => arr.length);

      const totalPages = Math.ceil(totalBlocks / limit);

      const trendData = await getTagTrendData(tagName, 30, { dedupeGroups: true });

      // Title bits come from i18n, tagName stays dynamic
      const titlePrefix = t('tags.detail.meta.titlePrefix') || '#';
      const titleSuffix = t('tags.detail.meta.titleSuffix') || ' | Daily Page';

      res.render('tags/tag', {
        title: `${titlePrefix}${tagName}${titleSuffix}`,
        tagName,
        taggedBlocks,
        currentPage: page,
        totalPages,
        totalBlocks,
        trendData,
        user: req.user || null,
        uiLang,
        preferredContentLang,
      });
    } catch (error) {
      const { t } = res.locals;
      console.error('Error loading tag page:', error);
      res
        .status(500)
        .render('error', { message: t('tags.detail.error.loadingTagPage') });
    }
  }
);

export default router;

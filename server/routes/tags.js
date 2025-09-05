import express from 'express';
import Block from '../db/models/Block.js';
import { findByTagWithLangPref, getAllTagsWithCounts, getTagTrendData } from '../db/blockService.js';
import { addI18n } from '../services/i18n.js'
import { toBlockPreviewDTO } from '../utils/block.js';

const router = express.Router();

router.get('/tags', addI18n(['tags']), async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '7d';

    const tags = await getAllTagsWithCounts(timeframe);

    const { t, lang } = res.locals;

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
      user: req.user || null
    });
  } catch (error) {
    console.error('Error loading tags overview:', error);
    const { t } = res.locals;
    res.status(500).render('error', { message: t('tags.error.loading') });
  }
});

// Página específica para mostrar bloques por etiqueta
router.get('/tags/:tagName', addI18n(['translation', 'readMore']), async (req, res) => {
  try {
    const preferredLang =
      req.query.lang ||
      req.user?.preferredLang ||
      (req.acceptsLanguages()[0] || "en").split("-")[0];
    const { tagName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const userId = req.user?.id || null;

    // Obtener bloques asociados con la etiqueta especificada
    let taggedBlocks = await findByTagWithLangPref({
      tag: tagName,
      preferredLang,
      sortBy: "voteCount",
      skip,
      limit
    });

    taggedBlocks = taggedBlocks.map(
      b => toBlockPreviewDTO(b, {
        userId
      })
    );

    const totalBlocks = await Block.distinct("groupId", { tags: tagName }).then(arr => arr.length);
    const totalPages = Math.ceil(totalBlocks / limit);

    const trendData = await getTagTrendData(tagName, 30);

    const currentLang = preferredLang;

    res.render('tags/tag', {
      title: `#${tagName} | Daily Page`,
      tagName,
      taggedBlocks,
      currentPage: page,
      totalPages,
      totalBlocks,
      trendData,
      user: req.user || null,
      lang: currentLang,
    });
  } catch (error) {
    console.error('Error loading tag page:', error);
    res.status(500).render('error', { message: 'Error loading tag page' });
  }
});

export default router;

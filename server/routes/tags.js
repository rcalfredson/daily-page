import express from 'express';
import Block from '../db/models/Block.js';
import { findByTagWithLangPref, getAllTagsWithCounts, getTagTrendData } from '../db/blockService.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';

const router = express.Router();

router.get('/tags', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '7d';

    const tags = await getAllTagsWithCounts(timeframe);

    res.render('tags/index', {
      title: 'Tags Overview | Daily Page',
      tags,
      timeframe,
      user: req.user || null
    });
  } catch (error) {
    console.error('Error loading tags overview:', error);
    res.status(500).render('error', { message: 'Error loading tags overview' });
  }
});

// Página específica para mostrar bloques por etiqueta
router.get('/tags/:tagName', async (req, res) => {
  try {
    const preferredLang =
      req.query.lang ||
      req.user?.preferredLang ||
      (req.acceptsLanguages()[0] || "en").split("-")[0];
    const { tagName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Obtener bloques asociados con la etiqueta especificada
    const taggedBlocks = await findByTagWithLangPref({
      tag: tagName,
      preferredLang,
      sortBy: "voteCount",
      skip,
      limit
    })
    taggedBlocks.forEach(block => {
      block.contentHTML = renderMarkdownContent(block.content);
    });

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
      currentLang,
    });
  } catch (error) {
    console.error('Error loading tag page:', error);
    res.status(500).render('error', { message: 'Error loading tag page' });
  }
});

export default router;

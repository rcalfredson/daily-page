import express from 'express';
import Block from '../db/models/Block.js';
import { getAllTagsWithCounts, getTagTrendData } from '../db/blockService.js';
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
    const { tagName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Obtener bloques asociados con la etiqueta especificada
    const taggedBlocks = await Block.find({ tags: tagName })
      .sort({ voteCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    taggedBlocks.forEach(block => {
      block.contentHTML = renderMarkdownContent(block.content);
    });

    const trendData = await getTagTrendData(tagName, 30);

    res.render('tags/tag', {
      title: `#${tagName} | Daily Page`,
      tagName,
      taggedBlocks,
      totalBlocks: taggedBlocks.length,
      trendData,
      user: req.user || null,
    });
  } catch (error) {
    console.error('Error loading tag page:', error);
    res.status(500).render('error', { message: 'Error loading tag page' });
  }
});

export default router;

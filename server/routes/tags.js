import express from 'express';
import Block from '../db/models/Block.js';
import { getTagTrendData } from '../db/blockService.js';
import { renderMarkdownContent } from '../utils/markdownHelper.js';

const router = express.Router();

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
    console.log('trendData:', trendData);

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

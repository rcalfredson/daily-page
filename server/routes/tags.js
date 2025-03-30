import express from 'express';
import Block from '../db/models/Block.js';

const router = express.Router();

// Página específica para mostrar bloques por etiqueta
router.get('/tags/:tagName', async (req, res) => {
  try {
    const { tagName } = req.params;

    // Obtener bloques asociados con la etiqueta especificada
    const taggedBlocks = await Block.find({ tags: tagName })
      .sort({ voteCount: -1, createdAt: -1 })
      .lean();

    res.render('tags/tag', {
      title: `#${tagName} | Daily Page`,
      tagName,
      taggedBlocks,
      totalBlocks: taggedBlocks.length,
      user: req.user || null,
    });
  } catch (error) {
    console.error('Error loading tag page:', error);
    res.status(500).render('error', { message: 'Error loading tag page' });
  }
});

export default router;

import express from 'express';

import optionalAuth from '../middleware/optionalAuth.js';
import { addI18n } from '../services/i18n.js';

const router = express.Router();

router.get(
  '/__dev/views/tag-detail',
  optionalAuth,
  addI18n([
    'blockCommon', 'tags', 'translation', 'readMore', 'voteControls', 'reactions'
  ]),
  (req, res) => {
    res.render('tags/tag', {
      title: 'Tag detail preview',
      tagName: 'design-preview',
      taggedBlocks: [],
      currentPage: 1,
      totalPages: 1,
      totalBlocks: 18,
      trendData: [
        { _id: '2026-05-09', count: 2 },
        { _id: '2026-05-14', count: 5 },
        { _id: '2026-05-19', count: 3 },
        { _id: '2026-05-24', count: 8 },
        { _id: '2026-05-29', count: 6 },
        { _id: '2026-06-03', count: 11 },
      ],
      user: req.user || null,
      uiLang: res.locals.uiLang,
      preferredContentLang: 'en',
    });
  }
);

router.get(
  '/__dev/views/full-post-capacity',
  optionalAuth,
  addI18n(['blockEditor']),
  (req, res) => {
    res.render('fullBlock', {
      title: 'Full post capacity preview',
      block_title: 'A room already full of ideas',
      room_id: 'physics',
      user: req.user || null,
      uiLang: res.locals.uiLang,
    });
  }
);

router.get(
  '/__dev/views/toasts',
  optionalAuth,
  (req, res) => {
    res.render('dev/toasts', {
      title: 'Toast preview',
      user: req.user || null,
      uiLang: res.locals.uiLang,
    });
  }
);

export default router;

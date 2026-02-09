import express from 'express';

import optionalAuth from '../middleware/optionalAuth.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { addI18n } from '../services/i18n.js';
import { getUiLang, getPreferredContentLang } from '../services/localeContext.js';

import { getRoomMetadata } from '../db/roomService.js';
import { searchBlocks, countSearchGroups } from '../db/searchService.js';

const router = express.Router();

function clampInt(val, def, min, max) {
  const n = Number.parseInt(val, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

router.get(
  '/search',
  optionalAuth,
  addI18n(['search']), // add other namespaces later if you want
  stripLegacyLang({ canonicalPath: '/search' }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);
      const preferredContentLang = getPreferredContentLang(res);

      // Parse query
      const rawQ = req.query.q;
      const q = (Array.isArray(rawQ) ? rawQ.join(' ') : String(rawQ || '')).trim();

      const roomId = (req.query.roomId || '').trim() || null;

      // If user passes ?lang=xx, honor it; otherwise use preferredContentLang
      const preferredLang = (req.query.lang || '').trim() || preferredContentLang || null;

      const page = clampInt(req.query.page, 1, 1, 500);
      const limit = 20;

      // Room chip metadata (optional)
      let roomMeta = null;
      let roomName = null;
      if (roomId) {
        roomMeta = await getRoomMetadata(roomId, uiLang);
        roomName = roomMeta?.displayName || roomMeta?.name || roomId;
      }

      // Results
      let results = [];
      let hasSearched = false;
      let totalPages = 1;
      let safePage = page;

      if (q.length >= 2) {
        hasSearched = true;

        const total = await countSearchGroups({ q, roomId });
        totalPages = Math.max(1, Math.ceil(total / limit));
        safePage = Math.min(page, totalPages);
        const safeSkip = (safePage - 1) * limit;

        // Fetch limit+1 so we can know if there's a next page
        const rawResults = await searchBlocks({
          q,
          roomId,
          preferredLang,
          skip: safeSkip,
          limit,
        });

        results = rawResults;
      }

      res.render('search', {
        title: t('search.meta.title'),
        description: t('search.meta.description'),
        uiLang,
        user: req.user || null,

        q,
        roomId,
        preferredLang,
        roomName,

        results,
        hasSearched,
        currentPage: safePage,
        totalPages,
      });
    } catch (error) {
      console.error('Error loading search page:', error);
      return res.status(500).render('error', { message: 'Error loading search page' });
    }
  }
);

export default router;

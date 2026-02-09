import { Router } from 'express';
import { searchBlocks } from '../../db/searchService.js';

const router = Router();

const useSearchAPI = (app) => {
  app.use('/api/v1/search', router);

  router.get('/', async (req, res) => {
    try {
      const rawQ = req.query.q;
      const q = (Array.isArray(rawQ) ? rawQ.join(' ') : String(rawQ || '')).trim();
      if (q.length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters.' });
      }

      const roomId = (req.query.roomId || '').trim() || null;
      const preferredLang = (req.query.lang || '').trim() || null;

      const skip = Number.parseInt(req.query.skip || '0', 10);
      const limit = Number.parseInt(req.query.limit || '20', 10);

      const safeSkip = Number.isFinite(skip) ? Math.max(0, Math.min(skip, 10000)) : 0;
      const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 20;

      const results = await searchBlocks({
        q,
        roomId,
        preferredLang,
        skip: safeSkip,
        limit: safeLimit,
      });

      return res.status(200).json({
        results,
        meta: {
          q,
          roomId,
          preferredLang,
          skip: safeSkip,
          limit: safeLimit,
          countReturned: results.length,
        }
      });
    } catch (error) {
      console.error('Search API error:', error);
      return res.status(500).json({ error: 'Search failed.' });
    }
  });
};

export default useSearchAPI;

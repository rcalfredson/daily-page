import { randomUUID } from 'node:crypto';
import express from 'express';

import { getSurpriseDiscoveryPost } from '../services/homeDiscovery.js';
import { getPreferredContentLang } from '../services/localeContext.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';

const router = express.Router();

export function buildSurpriseDiscoveryHandler({
  loadSurprisePost = getSurpriseDiscoveryPost,
  createSeed = randomUUID
} = {}) {
  return async function surpriseDiscoveryHandler(req, res) {
    const fallbackPath = res.locals.uiPath('/rooms');
    res.set('Cache-Control', 'no-store');

    try {
      const post = await loadSurprisePost({
        preferredLang: getPreferredContentLang(res),
        seed: createSeed()
      });

      if (!post?._id || !post?.roomId) return res.redirect(302, fallbackPath);
      return res.redirect(
        302,
        res.locals.uiPath(`/rooms/${post.roomId}/blocks/${post._id}`)
      );
    } catch (error) {
      console.error('Failed to choose a surprise discovery post:', error);
      return res.redirect(302, fallbackPath);
    }
  };
}

router.get(
  '/discover/surprise',
  stripLegacyLang({ canonicalPath: '/discover/surprise' }),
  buildSurpriseDiscoveryHandler()
);

export default router;

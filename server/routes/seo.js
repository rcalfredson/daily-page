import express from 'express';
import Block from '../db/models/Block.js';
import Room from '../db/models/Room.js';
import { publiclyVisibleBlockMatch } from '../services/blockVisibility.js';
import { getRoomDiscoveryStats } from '../db/roomSeoService.js';
import { listPublicReadingTrails } from '../db/readingTrailService.js';
import { SUPPORTED_UI_LANGS } from '../services/localeContext.js';
import { buildSitemapEntries, renderSitemap } from '../services/sitemap.js';
import * as cache from '../services/cache.js';

export async function loadSitemapResources() {
  const [blocks, rooms, roomStats, editions] = await Promise.all([
    Block.find(publiclyVisibleBlockMatch()).select('_id roomId groupId lang visibility status updatedAt').lean(),
    Room.find({}).lean(),
    getRoomDiscoveryStats(),
    Promise.all(SUPPORTED_UI_LANGS.map(async locale => {
      const trails = await listPublicReadingTrails({ locale });
      return trails.map(trail => ({ locale, trail }));
    }))
  ]);
  return { blocks, rooms, roomStats, trails: editions.flat() };
}

export function createSeoRouter({ loadResources = loadSitemapResources, getCached = cache.get } = {}) {
  const router = express.Router();
  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${res.locals.baseUrl}/sitemap.xml\n`);
  });
  router.get('/sitemap.xml', async (req, res) => {
    try {
      const baseUrl = res.locals.baseUrl;
      const sitemap = await getCached(`seo-sitemap:${baseUrl}`, async () => {
        return renderSitemap(buildSitemapEntries({ baseUrl, ...await loadResources() }));
      }, [], 5 * 60 * 1000);
      res.type('application/xml').send(sitemap);
    } catch (error) {
      console.error('Error generating sitemap:', error);
      res.sendStatus(503);
    }
  });
  return router;
}

export default createSeoRouter();

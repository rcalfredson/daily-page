import { resolveSeo } from '../services/seoPolicy.js';
import express from 'express';
import optionalAuth from '../middleware/optionalAuth.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { getPublicReadingTrail, listPublicReadingTrails } from '../db/readingTrailService.js';
import { addI18n } from '../services/i18n.js';
import { getUiLang } from '../services/localeContext.js';

const router = express.Router();

export function buildReadingTrailIndexHandler({ listTrails = listPublicReadingTrails } = {}) {
  return async function readingTrailIndex(req, res) {
    const { t } = res.locals;
    const uiLang = getUiLang(res);
    try {
      const trails = await listTrails({ locale: uiLang });
      res.locals.seoResource = { directoryHasContent: trails.length > 0 };
      return res.render('reading-trails/index', {
        title: t('readingTrails.overview.meta.title'),
        description: t('readingTrails.overview.meta.description'),
        trails,
        uiLang,
        user: req.user || null
      });
    } catch (error) {
      console.error('Error loading reading trails:', error);
      return res.status(500).render('error', {
        message: t('readingTrails.errors.loadFailed')
      });
    }
  };
}

export function buildReadingTrailDetailHandler({ getTrail = getPublicReadingTrail } = {}) {
  return async function readingTrailDetail(req, res) {
    const { t } = res.locals;
    const uiLang = getUiLang(res);
    try {
      const trail = await getTrail({ slug: req.params.slug, locale: uiLang });
      if (!trail) {
        return res.status(404).render('error', {
          title: t('readingTrails.errors.notFoundTitle'),
          message: t('readingTrails.errors.notFound')
        });
      }

      res.locals.hreflang = resolveSeo({
        path: `/trails/${encodeURIComponent(trail.slug)}`, locale: uiLang,
        baseUrl: res.locals.baseUrl, trail
      }).hreflang;
      return res.render('reading-trails/detail', {
        title: t('readingTrails.detail.meta.title', { trailName: trail.title }),
        description: trail.description,
        trail,
        uiLang,
        user: req.user || null
      });
    } catch (error) {
      console.error(`Error loading reading trail ${req.params.slug}:`, error);
      return res.status(500).render('error', {
        message: t('readingTrails.errors.loadFailed')
      });
    }
  };
}

router.get(
  '/trails',
  optionalAuth,
  addI18n(['readingTrails']),
  stripLegacyLang({ canonicalPath: '/trails' }),
  buildReadingTrailIndexHandler()
);

router.get(
  '/trails/:slug',
  optionalAuth,
  addI18n(['readingTrails']),
  stripLegacyLang({ canonicalPath: req => `/trails/${encodeURIComponent(req.params.slug)}` }),
  buildReadingTrailDetailHandler()
);

export default router;

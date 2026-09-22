import express from 'express';
import optionalAuth from '../middleware/optionalAuth.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { getPublicReadingTrail, listPublicReadingTrails } from '../db/readingTrailService.js';
import { addI18n } from '../services/i18n.js';
import { getUiLang } from '../services/localeContext.js';

const router = express.Router();

function detailHreflang(res, trail) {
  const path = `/trails/${encodeURIComponent(trail.slug)}`;
  const alternates = trail.availableLocales.map(lang => ({
    lang,
    href: `${res.locals.baseUrl}/${lang}${path}`
  }));
  const defaultLang = trail.availableLocales.includes(trail.sourceLanguage)
    ? trail.sourceLanguage
    : trail.availableLocales[0];
  if (defaultLang) {
    alternates.push({
      lang: 'x-default',
      href: `${res.locals.baseUrl}/${defaultLang}${path}`
    });
  }
  return alternates;
}

export function buildReadingTrailIndexHandler({ listTrails = listPublicReadingTrails } = {}) {
  return async function readingTrailIndex(req, res) {
    const { t } = res.locals;
    const uiLang = getUiLang(res);
    try {
      const trails = await listTrails({ locale: uiLang });
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

      res.locals.hreflang = detailHreflang(res, trail);
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

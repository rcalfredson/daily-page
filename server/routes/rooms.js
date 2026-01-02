import express from 'express';
import { fetchAndGroupRooms } from '../db/roomService.js';
import { getRecentlyActiveRooms } from '../db/sessionService.js';
import { addI18n } from '../services/i18n.js';
import { stripLegacyLang } from '../middleware/stripLegacyLang.js';
import { getUiLang } from '../services/localeContext.js';

const router = express.Router();

router.get(
  '/rooms',
  addI18n(['roomsDirectory']),
  stripLegacyLang({ canonicalPath: '/rooms' }),
  async (req, res) => {
    try {
      const { t } = res.locals;
      const uiLang = getUiLang(res);
      const topics = await fetchAndGroupRooms(uiLang) || [];
      const recentlyActiveRaw = await getRecentlyActiveRooms(5);
      const recentlyActiveRooms = recentlyActiveRaw.map(r => ({
        ...r,
        displayName: r.name_i18n?.get?.(uiLang) || r.name_i18n?.[uiLang] || r.name,
        displayDescription: r.description_i18n?.get?.(uiLang) || r.description_i18n?.[uiLang] || r.description
      }))

      res.render('rooms', {
        title: t('roomsDirectory.meta.title'),
        description: t('roomsDirectory.meta.description'),
        topics,
        recentlyActiveRooms,
        uiLang,
      });
    } catch (error) {
      console.error('Error fetching room directory:', error);
      res.status(500).send('Error fetching room directory.');
    }
  });

router.get(
  '/random',
  addI18n(['random']),
  stripLegacyLang({ canonicalPath: '/random' }),
  (req, res) => {
    const { t } = res.locals;

    res.render('random', {
      title: t('random.meta.title'),
      description: t('random.meta.description'),
      uiLang: getUiLang(res),
    });
  });

export default router;

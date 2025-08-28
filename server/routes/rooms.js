import express from 'express';
import { fetchAndGroupRooms } from '../db/roomService.js';
import { getRecentlyActiveRooms } from '../db/sessionService.js';
import { addI18n } from '../services/i18n.js';

const router = express.Router();

router.get('/rooms', addI18n(['roomsDirectory']), async (req, res) => {
  try {
    const lang = res.locals.lang;
    const topics = await fetchAndGroupRooms(lang) || [];
    const recentlyActiveRaw = await getRecentlyActiveRooms(5);
    const recentlyActiveRooms = recentlyActiveRaw.map(r => ({
      ...r,
      displayName: r.name_i18n?.get?.(lang) || r.name_i18n?.[lang] || r.name,
      displayDescription: r.description_i18n?.get?.(lang) || r.description_i18n?.[lang] || r.description
    }))

    res.render('rooms', {
      title: res.locals.t('roomsDirectory.meta.title'),
      description: res.locals.t('roomsDirectory.meta.description'),
      topics,
      recentlyActiveRooms,
    });
  } catch (error) {
    res.status(500).send('Error fetching room directory.');
  }
});

router.get('/random', (req, res) => {
  res.render('random', {
    title: 'Other Projects - Daily Page',
    description: 'Explore baseball journaling, random writing experiments, and more indie corners of Daily Page.'
  });
});

export default router;

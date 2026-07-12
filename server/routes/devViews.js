import express from 'express';

import optionalAuth from '../middleware/optionalAuth.js';
import { addI18n } from '../services/i18n.js';
import { getForestLabTree } from '../services/forestLabTreeCache.js';
import {
  DECIDUOUS_PHENOTYPE,
  LANTERNWOOD_PHENOTYPE
} from '../services/forest/v3/phenotype.js';

const router = express.Router();

const forestFixtureTitles = [
  'Coos County at the Edge of the Continent',
  'Notes from a Summer Thunderstorm',
  'Why Saturn Has Rings',
  'A Small Museum of Lost Buttons',
  'Walking Across Lower Manhattan',
  'The Mathematics of Honeycombs',
  'Letter to an Unfamiliar City',
  'Yalobusha County Field Notes',
  'The Quiet Work of Repair',
  'What the Telescope Remembered',
  'A Recipe Written from Memory',
  'Gosper County Beneath a Wide Sky',
  'How Rivers Choose Their Paths',
  'Three Poems About Streetlights',
  'A Brief History of Public Benches',
  'The Physics of Skipping Stones',
  'Postcard from a Winter Harbor',
  'On Learning the Names of Birds',
  'The Last Independent Bookshop',
  'A Map of Neighborhood Kindness',
  'Cloud Chambers and Cosmic Rays',
  'An Orchard at the City Limit',
  'Notes on Translation and Distance',
  'The Road Home After Midnight'
];

const forestFixtureRooms = [
  'united-states', 'daily-inspiration', 'physics', 'history', 'united-states', 'mathematics'
];

function forestFixtures() {
  return forestFixtureTitles.map((title, index) => {
    const post = {
      id: `forest-lab-post-${index + 1}`,
      title,
      roomId: forestFixtureRooms[index % forestFixtureRooms.length],
      createdAt: new Date(Date.UTC(2024 + (index % 3), index % 12, 3 + index)).toISOString(),
      wordCount: 280 + ((index * 347) % 2500),
      collaboratorCount: index % 5 === 0 ? 2 : index % 3 === 0 ? 1 : 0,
      translationCount: index % 6,
      commentCount: (index * 3) % 15,
      reactionCount: (index * 5) % 21,
      questApproved: index % 4 === 0,
      excerpt: 'A fixture post used to explore the visual grammar of a personal writing forest.'
    };
    const phenotype = index % 2 === 0 ? DECIDUOUS_PHENOTYPE : LANTERNWOOD_PHENOTYPE;
    const { generation: tree, asset } = getForestLabTree(post, { phenotype });
    return {
      ...post,
      url: `/rooms/${post.roomId}/blocks/${post.id}`,
      tree,
      asset
    };
  });
}

router.get(
  '/__dev/views/forest-lab',
  optionalAuth,
  (req, res) => {
    res.render('dev/forest-lab', {
      title: 'Activity Forest Lab',
      user: req.user || null,
      uiLang: res.locals.uiLang,
      trees: forestFixtures()
    });
  }
);

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

router.get(
  '/__dev/views/inactive-warning',
  optionalAuth,
  addI18n(['blockEditor']),
  (req, res) => {
    res.render('dev/inactive-warning', {
      title: 'Inactivity warning preview',
      user: req.user || null,
      uiLang: res.locals.uiLang,
    });
  }
);

export default router;

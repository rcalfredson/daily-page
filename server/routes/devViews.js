import express from 'express';

import optionalAuth from '../middleware/optionalAuth.js';
import { addI18n } from '../services/i18n.js';
import { getForestLabTree } from '../services/forestLabTreeCache.js';
import {
  clearForestSceneAssetPool,
  prepareForestSceneAssets
} from '../services/forestSceneAssetPool.js';
import {
  clearForestSceneRasterAssetCache,
  encodeForestSceneAssets,
  FOREST_ASSET_TRANSPORT_RASTER,
  resolveForestAssetTransport
} from '../services/forestSceneAssetTransport.js';
import { generateForestSceneLayout } from '../services/forestSceneLayout.js';
import { createForestExploration } from '../services/forestSceneExploration.js';
import {
  FOREST_PRESSURE_PROFILES,
  FOREST_SCENE_MAX_ASSET_REQUEST,
  FOREST_SCENE_CELL_SIZE,
  FOREST_SCENE_MAX_CELL_REQUEST,
  FOREST_SCENE_PRELOAD_CELL_COUNT,
  resolveForestPressureProfile,
  serializedForestSceneBytes
} from '../services/forestScenePressure.js';
import {
  forestSceneAssetKeysForCells,
  forestSceneCellIdsForViewport,
  forestScenePlacementCellId
} from '../../public/js/forest-scene-math.js';
import {
  FOREST_PHENOTYPES
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

export function forestFixtures() {
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
    const phenotype = FOREST_PHENOTYPES[index % FOREST_PHENOTYPES.length];
    const { generation: tree, asset } = getForestLabTree(post, { phenotype });
    return {
      ...post,
      url: `/rooms/${post.roomId}/blocks/${post.id}`,
      tree,
      asset
    };
  });
}

function forestSceneForProfile(profile) {
  return createForestExploration(generateForestSceneLayout(profile.layout));
}

function placementsInForestCells(scene, cellIds) {
  const requested = new Set(cellIds);
  return scene.placements.filter((placement) => requested.has(
    forestScenePlacementCellId(placement, FOREST_SCENE_CELL_SIZE)
  ));
}

function initialForestCellIds(scene) {
  return forestSceneCellIdsForViewport({
    x: scene.exploration.spawn.worldX,
    y: scene.exploration.spawn.worldY,
    width: 1,
    height: 1
  }, scene.world, FOREST_SCENE_CELL_SIZE, FOREST_SCENE_PRELOAD_CELL_COUNT);
}

function validRequestedForestCellIds(value, world) {
  const available = new Set(forestSceneCellIdsForViewport({
    x: 0, y: 0, width: world.width, height: world.height
  }, world, FOREST_SCENE_CELL_SIZE));
  return [...new Set(String(value || '').split(',').filter((id) => available.has(id)))]
    .slice(0, FOREST_SCENE_MAX_CELL_REQUEST);
}

function validRequestedForestAssetKeys(value, scene, cellIds) {
  const available = new Set(forestSceneAssetKeysForCells(
    scene.placements, cellIds, FOREST_SCENE_CELL_SIZE
  ));
  return [...new Set(String(value || '').split(',').filter((key) => available.has(key)))]
    .slice(0, FOREST_SCENE_MAX_ASSET_REQUEST);
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
  '/__dev/api/activity-forest/assets',
  async (req, res) => {
    const profile = resolveForestPressureProfile(req.query.pressure);
    const transport = resolveForestAssetTransport(req.query.transport);
    const scene = forestSceneForProfile(profile);
    const cellIds = validRequestedForestCellIds(req.query.cells, scene.world);
    if (!cellIds.length) return res.status(400).json({ error: 'Valid forest cells are required.' });
    const assetKeys = validRequestedForestAssetKeys(req.query.assetKeys, scene, cellIds);
    if (!assetKeys.length) {
      return res.status(400).json({ error: 'Valid unloaded forest assets are required.' });
    }
    const requestedAssetKeys = new Set(assetKeys);
    const { assets: runtimeAssets, diagnostics } = prepareForestSceneAssets(
      placementsInForestCells(scene, cellIds).filter(
        ({ assetKey }) => requestedAssetKeys.has(assetKey)
      )
    );
    const { assets, diagnostics: encoding } = await encodeForestSceneAssets(
      runtimeAssets, transport
    );
    res.set('Cache-Control', 'no-store');
    return res.json({
      cellIds,
      transport,
      assets,
      serverPreparation: {
        ...diagnostics,
        encodingDurationMilliseconds: encoding.durationMilliseconds,
        encodedAssetCount: encoding.encodedAssetCount,
        reusedEncodedAssetCount: encoding.reusedEncodedAssetCount,
        encodedPayloadBytes: encoding.encodedPayloadBytes
      }
    });
  }
);

router.get(
  '/__dev/views/activity-forest',
  optionalAuth,
  async (req, res) => {
    const profile = resolveForestPressureProfile(req.query.pressure);
    const transport = resolveForestAssetTransport(req.query.transport);
    const coldPreparationRequested = req.query.cold === '1';
    if (coldPreparationRequested) {
      clearForestSceneAssetPool();
      clearForestSceneRasterAssetCache();
    }
    const layout = forestSceneForProfile(profile);
    const initialCellIds = initialForestCellIds(layout);
    const { assets: runtimeAssets, diagnostics: preparation } = prepareForestSceneAssets(
      placementsInForestCells(layout, initialCellIds)
    );
    const { assets, diagnostics: encoding } = await encodeForestSceneAssets(
      runtimeAssets, transport
    );
    const scene = JSON.parse(JSON.stringify({
      ...layout,
      assets,
      assetLoading: {
        strategy: 'regional',
        transport,
        profileId: profile.id,
        cellSize: FOREST_SCENE_CELL_SIZE,
        preloadCellCount: FOREST_SCENE_PRELOAD_CELL_COUNT,
        initialCellIds,
        totalAssetCount: new Set(layout.placements.map(({ assetKey }) => assetKey)).size
      }
    }));
    const serverDiagnostics = {
      ...preparation,
      encodingDurationMilliseconds: encoding.durationMilliseconds,
      encodedAssetCount: encoding.encodedAssetCount,
      reusedEncodedAssetCount: encoding.reusedEncodedAssetCount,
      encodedAssetBytes: encoding.encodedPayloadBytes,
      serializedPayloadBytes: serializedForestSceneBytes(scene),
      coldPreparationRequested
    };
    res.render('dev/activity-forest', {
      title: profile.pressure ? `Activity Forest Pressure Test: ${profile.label}`
        : 'Activity Forest Scene',
      user: req.user || null,
      uiLang: res.locals.uiLang,
      scene,
      profile,
      rasterTransport: FOREST_ASSET_TRANSPORT_RASTER,
      pressureProfiles: FOREST_PRESSURE_PROFILES,
      serverDiagnostics
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

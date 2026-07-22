import express from 'express';

import optionalAuth from '../middleware/optionalAuth.js';
import { addI18n } from '../services/i18n.js';
import { getForestLabProjectedTree } from '../services/forestLabTreeCache.js';
import { forestPostTreeFixtures } from '../services/forestPostTreeFixtures.js';
import { projectPostToForestTree } from '../services/forestPostTreeProjection.js';
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
  composeEnvironmentProjectedForestScene,
  composeProjectedForestScene
} from '../services/forestProjectedScene.js';
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
  FOREST_STREAM_BANK_COMPOSITIONS,
  FOREST_STREAM_BANK_DEFINITION_ID,
  FOREST_STREAM_BANK_MODEL_VERSION
} from '../../public/js/forest-stream-banks.js';
import { FOREST_TRANSIENT_LIFE_VERSION } from '../../public/js/forest-transient-life.js';

const router = express.Router();

export function projectForestLabFixture(post, context) {
  try {
    const projection = projectPostToForestTree({
      id: post.id,
      roomId: post.roomId,
      createdAt: post.createdAt,
      wordCount: post.wordCount,
      collaboratorCount: post.collaboratorCount,
      translationCount: post.translationCount,
      commentCount: post.commentCount,
      reactionCount: post.reactionCount,
      questApproved: post.questApproved
    }, context);
    const { generation: tree, asset } = getForestLabProjectedTree(projection);
    return { projection, tree, asset, projectionError: null };
  } catch (error) {
    return {
      projection: null,
      tree: null,
      asset: null,
      projectionError: error instanceof Error ? error.message : 'Unknown projection failure.'
    };
  }
}

export function forestFixtures() {
  return forestPostTreeFixtures().map((fixture) => {
    const post = { ...fixture.post, title: fixture.title, excerpt: fixture.excerpt };
    const projected = projectForestLabFixture(post, fixture.context);
    return {
      ...post,
      url: `/rooms/${post.roomId}/blocks/${post.id}`,
      pair: fixture.pair,
      ...projected
    };
  });
}

function forestSceneForProfile(profile) {
  const baseLayout = generateForestSceneLayout(profile.layout);
  if (!profile.projectedWriting) {
    return { scene: createForestExploration(baseLayout), assetProjections: new Map() };
  }
  const projected = profile.projectedEnvironment
    ? composeEnvironmentProjectedForestScene(baseLayout)
    : composeProjectedForestScene(baseLayout);
  return {
    scene: createForestExploration(projected.layout, { fixtures: projected.fixtures }),
    assetProjections: projected.assetProjections
  };
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

function forestEnvironmentSummary(scene) {
  if (!scene.environment) return null;
  const countBy = field => Object.fromEntries([...new Set(scene.placements.map(
    placement => placement[field]
  ))].sort().map(value => [value, scene.placements.filter(
    placement => placement[field] === value
  ).length]));
  return {
    regions: countBy('originatingRegionId'),
    habitats: countBy('originatingHabitatId'),
    surfaces: countBy('groundSurfaceId'),
    phenotypes: countBy('phenotypeId'),
    transitions: countBy('transitionState'),
    boulderRegions: Object.fromEntries([...new Set(scene.terrainFeatures.map(
      feature => feature.originatingRegionId
    ))].sort().map(value => [value, scene.terrainFeatures.filter(
      feature => feature.originatingRegionId === value
    ).length])),
    boulderVariants: Object.fromEntries([...new Set(scene.terrainFeatures.map(
      feature => feature.variantId
    ))].sort().map(value => [value, scene.terrainFeatures.filter(
      feature => feature.variantId === value
    ).length])),
    boulderPalettes: Object.fromEntries([...new Set(scene.terrainFeatures.map(
      feature => feature.rockPaletteId
    ))].sort().map(value => [value, scene.terrainFeatures.filter(
      feature => feature.rockPaletteId === value
    ).length])),
    terrainRoles: Object.fromEntries([...new Set(scene.terrainFeatures.map(
      feature => feature.terrainRole
    ))].sort().map(value => [value, scene.terrainFeatures.filter(
      feature => feature.terrainRole === value
    ).length])),
    streamBank: {
      definitionId: FOREST_STREAM_BANK_DEFINITION_ID,
      modelVersion: FOREST_STREAM_BANK_MODEL_VERSION,
      compositionIds: FOREST_STREAM_BANK_COMPOSITIONS.map(({ id }) => id)
    },
    crossings: scene.crossings,
    placement: scene.environmentPlacementDiagnostics
  };
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
    const { scene, assetProjections } = forestSceneForProfile(profile);
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
      ),
      assetProjections
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
    const { scene: layout, assetProjections } = forestSceneForProfile(profile);
    const initialCellIds = initialForestCellIds(layout);
    const { assets: runtimeAssets, diagnostics: preparation } = prepareForestSceneAssets(
      placementsInForestCells(layout, initialCellIds),
      assetProjections
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
        : profile.projectedWriting ? `Activity Forest: ${profile.label}` : 'Activity Forest Scene',
      user: req.user || null,
      uiLang: res.locals.uiLang,
      scene,
      profile,
      rasterTransport: FOREST_ASSET_TRANSPORT_RASTER,
      pressureProfiles: FOREST_PRESSURE_PROFILES,
      serverDiagnostics,
      transientLifeVersion: FOREST_TRANSIENT_LIFE_VERSION,
      environmentSummary: forestEnvironmentSummary(layout)
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

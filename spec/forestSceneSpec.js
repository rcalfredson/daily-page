import {
  DEFAULT_FOREST_SCENE_CONFIG,
  forestCorridorCenter,
  generateForestSceneLayout
} from '../server/services/forestSceneLayout.js';
import {
  clearForestSceneAssetPool,
  forestSceneAssetPoolSize,
  prepareForestSceneAssets,
  prepareForestScene,
  prepareForestSceneWithDiagnostics
} from '../server/services/forestSceneAssetPool.js';
import {
  clearForestSceneRasterAssetCache,
  encodeForestSceneAssets,
  FOREST_ASSET_TRANSPORT_RASTER,
  FOREST_ASSET_TRANSPORT_RUNS,
  forestSceneRasterAssetCacheSize,
  resolveForestAssetTransport
} from '../server/services/forestSceneAssetTransport.js';
import sharp from 'sharp';
import {
  FOREST_PRESSURE_PROFILES,
  resolveForestPressureProfile,
  serializedForestSceneBytes
} from '../server/services/forestScenePressure.js';
import {
  cameraFollowingPlayer,
  createForestVisibilityCache,
  focusedForestPlacement,
  focusedForestSceneItem,
  FOREST_AMBIENT_WIND,
  forestAmbientMotionActive,
  forestSceneAssetKeysForCells,
  forestSceneCellIdsForViewport,
  forestScenePlacementCellId,
  forestDepthOrder,
  forestFoliageMotionGroupDisplacement,
  forestTouchGestureIntent,
  forestPlacementWindParameters,
  moveForestPlayer,
  normalizedMovement,
  playerCollides,
  touchMovement,
  placementVisualRect,
  visibleForestObjects,
  visibleForestPlacements
} from '../public/js/forest-scene-math.js';
import {
  createForestExploration,
  forestPlacementCollisionRadius
} from '../server/services/forestSceneExploration.js';

describe('static Activity Forest scene', () => {
  beforeEach(() => {
    clearForestSceneAssetPool();
    clearForestSceneRasterAssetCache();
  });

  it('generates exactly serializable deterministic placements', () => {
    const first = generateForestSceneLayout();
    const repeated = generateForestSceneLayout();
    const changed = generateForestSceneLayout({ seed: 'another-grove' });

    expect(repeated).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(changed.placements).not.toEqual(first.placements);
  });

  it('keeps unique placements valid, spaced, mixed, and outside the corridor', () => {
    const scene = generateForestSceneLayout();
    const ids = new Set(scene.placements.map((placement) => placement.id));
    const phenotypes = new Set(scene.placements.map((placement) => placement.phenotypeId));

    expect(ids.size).toBe(scene.placements.length);
    expect(phenotypes).toEqual(new Set(['open-crown-deciduous', 'sunset-lanternwood']));
    scene.placements.forEach((placement, index) => {
      expect(placement.worldX).toBeGreaterThanOrEqual(DEFAULT_FOREST_SCENE_CONFIG.edgeMargin);
      expect(placement.worldX).toBeLessThanOrEqual(
        scene.world.width - DEFAULT_FOREST_SCENE_CONFIG.edgeMargin
      );
      expect(placement.worldY).toBeGreaterThanOrEqual(DEFAULT_FOREST_SCENE_CONFIG.edgeMargin);
      expect(placement.worldY).toBeLessThanOrEqual(
        scene.world.height - DEFAULT_FOREST_SCENE_CONFIG.edgeMargin
      );
      expect(placement.scale).toBeGreaterThanOrEqual(
        DEFAULT_FOREST_SCENE_CONFIG.scale.minimum
      );
      expect(placement.scale).toBeLessThanOrEqual(
        DEFAULT_FOREST_SCENE_CONFIG.scale.maximum
      );
      expect(Math.abs(placement.worldX - forestCorridorCenter(
        placement.worldY, scene.world.width
      ))).toBeGreaterThanOrEqual(DEFAULT_FOREST_SCENE_CONFIG.corridorHalfWidth);
      for (const other of scene.placements.slice(index + 1)) {
        expect(Math.hypot(
          placement.worldX - other.worldX, placement.worldY - other.worldY
        )).toBeGreaterThanOrEqual(DEFAULT_FOREST_SCENE_CONFIG.minimumSpacing);
      }
    });
    expect(new Set(scene.placements.map((placement) => placement.worldX)).size)
      .toBeGreaterThan(scene.placements.length * 0.9);
  });

  it('prepares and reuses a bounded pool containing runtime assets only', () => {
    const scene = prepareForestScene(generateForestSceneLayout());
    const repeated = prepareForestScene(generateForestSceneLayout());
    const keys = new Set(scene.placements.map((placement) => placement.assetKey));
    const serialized = JSON.stringify(scene);

    expect(keys.size).toBeLessThan(scene.placements.length);
    expect(keys.size).toBeLessThanOrEqual(DEFAULT_FOREST_SCENE_CONFIG.specimenPoolSize * 2);
    expect(scene.assets.length).toBe(keys.size);
    expect(repeated.assets).toEqual(scene.assets);
    expect(forestSceneAssetPoolSize()).toBe(keys.size);
    for (const excluded of ['nodes', 'segments', 'diagnostics', 'attractionPoints']) {
      expect(serialized).not.toContain(`"${excluded}"`);
    }
    expect(JSON.parse(serialized)).toEqual(scene);
  });

  it('defines explicit development pressure profiles without changing the default layout', () => {
    const representative = resolveForestPressureProfile('representative');
    const botanical = resolveForestPressureProfile('botanical-range');
    const variety = resolveForestPressureProfile('asset-variety');
    const unique = resolveForestPressureProfile('unique-assets');
    const large = resolveForestPressureProfile('large-world');

    expect(FOREST_PRESSURE_PROFILES.length).toBe(5);
    expect(representative.pressure).toBeFalse();
    expect(representative.layout).toEqual({});
    expect(resolveForestPressureProfile('unknown')).toBe(representative);
    const botanicalScene = generateForestSceneLayout(botanical.layout);
    expect(botanicalScene.placements.length).toBe(180);
    expect(new Set(botanicalScene.placements.map(({ phenotypeId }) => phenotypeId))).toEqual(
      new Set([
        'open-crown-deciduous',
        'sunset-lanternwood',
        'wind-shaped-highland-conifer'
      ])
    );
    expect(new Set(botanicalScene.placements.map(({ assetKey }) => assetKey)).size)
      .toBeLessThanOrEqual(24);
    const botanicalCounts = [...new Set(botanicalScene.placements.map(
      ({ phenotypeId }) => phenotypeId
    ))].map(id => botanicalScene.placements.filter(({ phenotypeId }) => phenotypeId === id).length);
    expect(Math.max(...botanicalCounts) - Math.min(...botanicalCounts)).toBeLessThan(20);
    expect(generateForestSceneLayout(variety.layout).placements
      .map(({ assetKey }) => assetKey).filter((key, index, keys) => keys.indexOf(key) === index)
      .length).toBe(60);
    expect(new Set(generateForestSceneLayout(unique.layout).placements
      .map(({ assetKey }) => assetKey)).size).toBe(180);
    const largeScene = generateForestSceneLayout(large.layout);
    expect(largeScene.placements.length).toBe(600);
    expect(largeScene.world).toEqual({ width: 6000, height: 3600 });
  });

  it('reports cold and warm server preparation work and exact UTF-8 payload bytes', () => {
    const layout = generateForestSceneLayout({
      seed: 'pressure-diagnostics', placementCount: 8, assetPoolSize: 4
    });
    const cold = prepareForestSceneWithDiagnostics(layout);
    const warm = prepareForestSceneWithDiagnostics(layout);

    expect(cold.diagnostics.generatedAssetCount).toBe(4);
    expect(cold.diagnostics.generationDurationMilliseconds).toBeGreaterThanOrEqual(0);
    expect(cold.diagnostics.reusedAssetCount).toBe(0);
    expect(cold.diagnostics.preparedAssetCount).toBe(4);
    expect(cold.diagnostics.durationMilliseconds).toBeGreaterThanOrEqual(0);
    expect(warm.diagnostics.generatedAssetCount).toBe(0);
    expect(warm.diagnostics.reusedAssetCount).toBe(4);
    expect(serializedForestSceneBytes(cold.scene))
      .toBe(Buffer.byteLength(JSON.stringify(cold.scene), 'utf8'));
  });

  it('encodes and caches deterministic lossless layer rasters by versioned asset key', async () => {
    const layout = generateForestSceneLayout({
      seed: 'raster-transport', placementCount: 1, assetPoolSize: 1,
      phenotypeWeights: {
        'open-crown-deciduous': 0,
        'sunset-lanternwood': 0,
        'wind-shaped-highland-conifer': 1
      }
    });
    const [runtimeAsset] = prepareForestSceneAssets(layout.placements).assets;
    const cold = await encodeForestSceneAssets(
      [runtimeAsset], FOREST_ASSET_TRANSPORT_RASTER
    );
    const warm = await encodeForestSceneAssets(
      [runtimeAsset], FOREST_ASSET_TRANSPORT_RASTER
    );
    clearForestSceneRasterAssetCache();
    const repeated = await encodeForestSceneAssets(
      [runtimeAsset], FOREST_ASSET_TRANSPORT_RASTER
    );
    const [rasterAsset] = cold.assets;

    expect(rasterAsset.cacheKey).toBe(runtimeAsset.cacheKey);
    expect(rasterAsset.dimensions).toEqual(runtimeAsset.dimensions);
    expect(rasterAsset.bounds).toEqual(runtimeAsset.bounds);
    expect(rasterAsset.anchor).toEqual(runtimeAsset.anchor);
    expect(rasterAsset.identity).toEqual(runtimeAsset.identity);
    expect(rasterAsset.layers.map(({ id }) => id)).toEqual([
      'rear-foliage', 'wood', 'front-foliage'
    ]);
    expect(rasterAsset.layers.find(layer => layer.id === 'wood').mediaType).toBe('image/png');
    for (const layer of rasterAsset.layers.filter(layer => layer.motionGroups)) {
      expect(layer.motionGroups.length).toBeGreaterThan(1);
      expect(layer.motionGroups.every(group => (
        group.mediaType === 'image/png' && group.encoding === 'base64' && !group.runs
      ))).toBeTrue();
    }
    expect(cold.diagnostics.encodedAssetCount).toBe(1);
    expect(cold.diagnostics.reusedEncodedAssetCount).toBe(0);
    expect(warm.diagnostics.encodedAssetCount).toBe(0);
    expect(warm.diagnostics.reusedEncodedAssetCount).toBe(1);
    expect(warm.assets).toEqual(cold.assets);
    expect(repeated.assets).toEqual(cold.assets);
    expect(forestSceneRasterAssetCacheSize()).toBe(1);
    expect(cold.diagnostics.encodedPayloadBytes)
      .toBe(Buffer.byteLength(JSON.stringify(cold.assets), 'utf8'));

    for (const [index, rasterLayer] of rasterAsset.layers.entries()) {
      const runtimeLayer = runtimeAsset.layers[index];
      const rasterSources = rasterLayer.motionGroups || [rasterLayer];
      const runtimeSources = runtimeLayer.motionGroups || [runtimeLayer];
      expect(rasterSources.map(source => source.id)).toEqual(
        runtimeSources.map(source => source.id)
      );
      for (const [sourceIndex, source] of rasterSources.entries()) {
        if (runtimeLayer.motionGroups) {
          expect(source.index).toBe(runtimeSources[sourceIndex].index);
          expect(source.attachment).toEqual(runtimeSources[sourceIndex].attachment);
          expect(source.windResponse).toEqual(runtimeSources[sourceIndex].windResponse);
        }
        const { data, info } = await sharp(Buffer.from(source.data, 'base64')).raw().toBuffer({
          resolveWithObject: true
        });
        const expected = Buffer.alloc(data.length);
        for (const run of runtimeSources[sourceIndex].runs) {
          const color = run.color.slice(1);
          const channels = color.length === 3
            ? [...color].map(value => Number.parseInt(`${value}${value}`, 16))
            : [0, 2, 4].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16));
          for (let x = run.x; x < run.x + run.width; x += 1) {
            const offset = ((run.y * info.width) + x) * info.channels;
            expected.set([...channels, 255], offset);
          }
        }
        expect(info.width).toBe(runtimeAsset.dimensions.width);
        expect(info.height).toBe(runtimeAsset.dimensions.height);
        expect(data).toEqual(expected);
      }
    }
  });

  it('keeps color runs as the default development transport with exact bytes', async () => {
    const layout = generateForestSceneLayout({
      seed: 'run-transport', placementCount: 1, assetPoolSize: 1
    });
    const assets = prepareForestSceneAssets(layout.placements).assets;
    const encoded = await encodeForestSceneAssets(assets, FOREST_ASSET_TRANSPORT_RUNS);

    expect(resolveForestAssetTransport('unknown')).toBe(FOREST_ASSET_TRANSPORT_RUNS);
    expect(resolveForestAssetTransport(FOREST_ASSET_TRANSPORT_RASTER))
      .toBe(FOREST_ASSET_TRANSPORT_RASTER);
    expect(encoded.assets).toBe(assets);
    expect(encoded.diagnostics.encodedPayloadBytes)
      .toBe(Buffer.byteLength(JSON.stringify(assets), 'utf8'));
  });

  it('partitions the world into stable cells with a clamped preload ring', () => {
    const world = { width: 1200, height: 900 };

    expect(forestScenePlacementCellId({ worldX: 960, worldY: 479 }, 480)).toBe('2:0');
    expect(forestSceneCellIdsForViewport(
      { x: 450, y: 450, width: 100, height: 100 }, world, 480, 1
    )).toEqual([
      '0:0', '1:0', '2:0',
      '0:1', '1:1', '2:1'
    ]);
    expect(forestSceneCellIdsForViewport(
      { x: 0, y: 0, width: 100, height: 100 }, world, 480, 1
    )).toEqual(['0:0', '1:0', '0:1', '1:1']);
    const placements = [
      { worldX: 10, worldY: 10, assetKey: 'shared' },
      { worldX: 20, worldY: 20, assetKey: 'cell-zero' },
      { worldX: 500, worldY: 20, assetKey: 'shared' },
      { worldX: 510, worldY: 20, assetKey: 'cell-one' },
      { worldX: 20, worldY: 500, assetKey: 'outside' }
    ];
    expect(forestSceneAssetKeysForCells(
      placements, ['0:0', '1:0'], 480, ['shared']
    )).toEqual(['cell-zero', 'cell-one']);
  });

  it('prepares only assets required by a regional placement subset', () => {
    const layout = generateForestSceneLayout({
      seed: 'regional-assets', placementCount: 8, assetPoolSize: 4
    });
    const regionalPlacements = layout.placements.slice(0, 2);
    const cold = prepareForestSceneAssets(regionalPlacements);
    const warm = prepareForestSceneAssets(regionalPlacements);

    expect(cold.assets.length).toBe(2);
    expect(cold.diagnostics.generatedAssetCount).toBe(2);
    expect(warm.diagnostics.generatedAssetCount).toBe(0);
    expect(warm.diagnostics.reusedAssetCount).toBe(2);
    expect(forestSceneAssetPoolSize()).toBe(2);
  });

  it('culls by scaled visual bounds and orders visible trees stably by ground Y', () => {
    const asset = {
      anchor: { x: 5, y: 10 },
      bounds: { x: 1, y: 2, width: 8, height: 9 }
    };
    const assets = new Map([['tree', asset]]);
    const placements = [
      { id: 'tie-b', assetKey: 'tree', worldX: 130, worldY: 60, scale: 2 },
      { id: 'near', assetKey: 'tree', worldX: 50, worldY: 80, scale: 1 },
      { id: 'tie-a', assetKey: 'tree', worldX: 80, worldY: 60, scale: 1 },
      { id: 'partial', assetKey: 'tree', worldX: 5, worldY: 20, scale: 2 },
      { id: 'offscreen', assetKey: 'tree', worldX: 400, worldY: 400, scale: 1 }
    ];

    expect(placementVisualRect(placements[0], asset)).toEqual({
      x: 122, y: 44, width: 16, height: 18
    });
    expect(visibleForestPlacements(
      placements, assets, { x: 0, y: 0, width: 140, height: 100 }, 0
    ).map((placement) => placement.id)).toEqual(['partial', 'tie-a', 'tie-b', 'near']);
  });

  it('derives deterministic wind parameters from placement rather than shared asset identity', () => {
    const firstPlacement = {
      id: 'placement-1', assetKey: 'shared-tree', worldX: 120, worldY: 240
    };
    const secondPlacement = {
      id: 'placement-2', assetKey: 'shared-tree', worldX: 220, worldY: 240
    };
    const first = forestPlacementWindParameters(firstPlacement);
    const repeated = forestPlacementWindParameters({ ...firstPlacement });
    const second = forestPlacementWindParameters(secondPlacement);

    expect(repeated).toEqual(first);
    expect(second.phase).not.toBe(first.phase);
    expect(second).not.toEqual(first);
    expect(first.amplitude).toBeGreaterThanOrEqual(FOREST_AMBIENT_WIND.minimumAmplitude);
    expect(first.amplitude).toBeLessThanOrEqual(FOREST_AMBIENT_WIND.maximumAmplitude);
    expect(first.speed).toBeGreaterThanOrEqual(FOREST_AMBIENT_WIND.minimumSpeed);
    expect(first.speed).toBeLessThanOrEqual(FOREST_AMBIENT_WIND.maximumSpeed);
  });

  it('keeps foliage wind bounded and pixel-snapped and becomes static when inactive', () => {
    const parameters = forestPlacementWindParameters({
      id: 'bounded-wind', worldX: 42, worldY: 84
    });
    const group = { index: 1, windResponse: { phaseOffset: 0, amplitude: 1 } };
    const samples = Array.from({ length: 500 }, (_, index) => (
      forestFoliageMotionGroupDisplacement(parameters, group, index / 30)
    ));

    expect(samples.every(Number.isInteger)).toBeTrue();
    expect(Math.max(...samples)).toBeLessThanOrEqual(
      FOREST_AMBIENT_WIND.maximumDisplacement
    );
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(
      -FOREST_AMBIENT_WIND.maximumDisplacement
    );
    expect(forestFoliageMotionGroupDisplacement(parameters, group, 4.5, false)).toBe(0);
    expect(forestAmbientMotionActive()).toBeTrue();
    expect(forestAmbientMotionActive({ documentHidden: true })).toBeFalse();
    expect(forestAmbientMotionActive({ reducedMotion: true })).toBeFalse();
  });

  it('staggers deterministic motion groups without exceeding the ambient bound', () => {
    const parameters = forestPlacementWindParameters({
      id: 'grouped-wind', worldX: 140, worldY: 280
    });
    const groups = [
      { index: 0, windResponse: { phaseOffset: -0.72, amplitude: 0.82 } },
      { index: 1, windResponse: { phaseOffset: 0, amplitude: 1 } },
      { index: 2, windResponse: { phaseOffset: 0.72, amplitude: 0.9 } }
    ];
    const samples = groups.map(group => Array.from({ length: 500 }, (_, index) => (
      forestFoliageMotionGroupDisplacement(parameters, group, index / 30)
    )));

    expect(new Set(samples.map(sample => sample.join(','))).size).toBe(groups.length);
    expect(samples.flat().every(value => Number.isInteger(value)
      && Math.abs(value) <= FOREST_AMBIENT_WIND.maximumDisplacement)).toBeTrue();
    expect(groups.every(group => (
      forestFoliageMotionGroupDisplacement(parameters, group, 8, false) === 0
    ))).toBeTrue();
  });

  it('reuses visible depth order until a genuine visibility input changes', () => {
    const asset = {
      anchor: { x: 5, y: 10 }, bounds: { x: 1, y: 2, width: 8, height: 9 }
    };
    const assets = new Map([['tree', asset]]);
    const placements = [
      { id: 'visible', assetKey: 'tree', worldX: 50, worldY: 60, scale: 1 },
      { id: 'unloaded', assetKey: 'late-tree', worldX: 70, worldY: 70, scale: 1 }
    ];
    const viewport = { x: 0, y: 0, width: 100, height: 100 };
    const player = { worldX: 40, worldY: 65 };
    const cache = createForestVisibilityCache(placements, assets, 0);
    const initial = cache.read(viewport, player);

    expect(cache.read(viewport, player)).toBe(initial);
    expect(initial.visible.map(({ id }) => id)).toEqual(['visible']);

    const cameraChanged = cache.read({ ...viewport, x: 1 }, player);
    expect(cameraChanged.revision).toBe(initial.revision + 1);
    expect(cache.read({ ...viewport, x: 1 }, player)).toBe(cameraChanged);

    assets.set('late-tree', asset);
    const assetChanged = cache.read({ ...viewport, x: 1 }, player);
    expect(assetChanged.revision).toBe(cameraChanged.revision + 1);
    expect(assetChanged.visible.map(({ id }) => id)).toEqual(['visible', 'unloaded']);

    const playerDepthChanged = cache.read({ ...viewport, x: 1 }, { ...player, worldY: 75 });
    expect(playerDepthChanged.revision).toBe(assetChanged.revision + 1);
    cache.setObjects([{ id: 'marker', worldX: 45, worldY: 65 }]);
    const objectChanged = cache.read({ ...viewport, x: 1 }, { ...player, worldY: 75 });
    expect(objectChanged.revision).toBe(playerDepthChanged.revision + 1);
    expect(objectChanged.visibleObjects.map(({ id }) => id)).toEqual(['marker']);
    cache.invalidate();
    expect(cache.read({ ...viewport, x: 1 }, { ...player, worldY: 75 }).revision)
      .toBe(objectChanged.revision + 1);
  });

  it('adds a deterministic, safe spawn and bounded fixture metadata', () => {
    const scene = prepareForestScene(createForestExploration(generateForestSceneLayout()));
    const repeated = createForestExploration(generateForestSceneLayout());
    const serialized = JSON.stringify(scene);

    expect(repeated.exploration).toEqual(scene.exploration);
    expect(scene.exploration.spawn.worldX).toBeGreaterThan(0);
    expect(scene.exploration.spawn.worldX).toBeLessThan(scene.world.width);
    expect(scene.exploration.spawn.worldY).toBeGreaterThan(0);
    expect(scene.exploration.spawn.worldY).toBeLessThan(scene.world.height);
    expect(playerCollides(scene.exploration.spawn, scene.placements)).toBeFalse();
    expect(scene.exploration.fixtures.length).toBeLessThan(scene.placements.length);
    expect(scene.placements.every((placement) => placement.fixtureId)).toBeTrue();
    expect(scene.assets.length).toBeGreaterThan(0);
    for (const excluded of ['nodes', 'segments', 'diagnostics', 'attractionPoints', 'wordCount']) {
      expect(serialized).not.toContain(`"${excluded}"`);
    }
    expect(JSON.parse(JSON.stringify(scene))).toEqual(scene);
  });

  it('normalizes elapsed-time movement and keeps the player inside world bounds', () => {
    const player = { worldX: 50, worldY: 50, radius: 10, movementSpeed: 100 };
    const diagonal = normalizedMovement({ right: true, down: true });
    const moved = moveForestPlayer(player, diagonal, 0.5, { width: 200, height: 200 }, []);
    const clamped = moveForestPlayer(player, { x: -1, y: -1 }, 10,
      { width: 200, height: 200 }, []);

    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 8);
    expect(Math.hypot(moved.worldX - 50, moved.worldY - 50)).toBeCloseTo(50, 8);
    expect(moveForestPlayer(player, diagonal, 0.5, { width: 200, height: 200 }, []))
      .toEqual(moved);
    expect(clamped.worldX).toBe(10);
    expect(clamped.worldY).toBe(10);
  });

  it('turns touch displacement into proportional analog movement after a dead zone', () => {
    expect(touchMovement(4, 6, 10)).toEqual({ x: 0, y: 0 });
    expect(touchMovement(30, 40, 10)).toEqual({ x: 0.6, y: 0.8 });
    expect(touchMovement(-28, 0, 10).x).toBeCloseTo(-0.5, 8);
    expect(Math.hypot(...Object.values(touchMovement(18, 0, 10)))).toBeLessThan(0.25);
    expect(Math.hypot(...Object.values(touchMovement(60, 0, 10)))).toBe(1);
  });

  it('distinguishes a deliberate touch tap from a joystick drag', () => {
    expect(forestTouchGestureIntent(0)).toBe('tap');
    expect(forestTouchGestureIntent(10)).toBe('tap');
    expect(forestTouchGestureIntent(10.01)).toBe('drag');
    expect(forestTouchGestureIntent(48)).toBe('drag');
    expect(forestTouchGestureIntent(Number.NaN)).toBe('drag');
  });

  it('blocks trunk entry, supports axis sliding, and scales collision radii', () => {
    const player = { worldX: 50, worldY: 50, radius: 10, movementSpeed: 40 };
    const obstacle = { id: 'tree', worldX: 80, worldY: 50, collisionRadius: 12 };
    const blocked = moveForestPlayer(player, { x: 1, y: 0 }, 0.5,
      { width: 200, height: 200 }, [obstacle]);
    const sliding = moveForestPlayer(player, { x: 1, y: 1 }, 0.5,
      { width: 200, height: 200 }, [obstacle]);

    expect(blocked.worldX).toBe(50);
    expect(sliding.worldX).toBe(50);
    expect(sliding.worldY).toBe(70);
    expect(forestPlacementCollisionRadius({ phenotypeId: 'sunset-lanternwood', scale: 2 }))
      .toBe(26);
    expect(forestPlacementCollisionRadius({
      phenotypeId: 'wind-shaped-highland-conifer', scale: 2
    })).toBe(24);
    expect(playerCollides({ ...player, worldX: 30 }, [obstacle])).toBeFalse();
  });

  it('follows the player with camera edge clamping', () => {
    const viewport = { x: 0, y: 0, width: 100, height: 80 };
    const world = { width: 300, height: 200 };
    expect(cameraFollowingPlayer({ worldX: 150, worldY: 100 }, viewport, world))
      .toEqual({ x: 100, y: 60, width: 100, height: 80 });
    expect(cameraFollowingPlayer({ worldX: 0, worldY: 0 }, viewport, world).x).toBe(0);
    expect(cameraFollowingPlayer({ worldX: 300, worldY: 200 }, viewport, world))
      .toEqual({ x: 200, y: 120, width: 100, height: 80 });
  });

  it('orders the player by ground Y and selects proximity with stable ties', () => {
    const player = { worldX: 0, worldY: 50 };
    const placements = [
      { id: 'below', worldX: 0, worldY: 60, collisionRadius: 5 },
      { id: 'tie-b', worldX: 10, worldY: 50, collisionRadius: 5 },
      { id: 'tie-a', worldX: -10, worldY: 50, collisionRadius: 5 },
      { id: 'above', worldX: 0, worldY: 40, collisionRadius: 5 },
      { id: 'far', worldX: 200, worldY: 50, collisionRadius: 5 }
    ];

    expect(forestDepthOrder(placements, player).map((item) => item.id))
      .toEqual(['above', 'far', 'tie-a', 'tie-b', '~player', 'below']);
    expect(focusedForestPlacement(player, placements.slice(1, 3), 10).id).toBe('tie-a');
    expect(focusedForestPlacement(player, [placements[4]], 10)).toBeNull();
    const marker = { id: 'marker-a', worldX: 3, worldY: 50 };
    expect(focusedForestSceneItem(player, placements, [marker], 10)).toEqual(
      jasmine.objectContaining({ kind: 'marker', id: 'marker-a' })
    );
    expect(forestDepthOrder(placements, player, [marker]).map((item) => item.id))
      .toEqual(['above', 'marker-a', 'far', 'tie-a', 'tie-b', '~player', 'below']);
    expect(visibleForestObjects([marker, { id: 'offscreen-marker', worldX: 500, worldY: 500 }],
      { x: 0, y: 0, width: 100, height: 100 }, 0)).toEqual([marker]);
  });
});

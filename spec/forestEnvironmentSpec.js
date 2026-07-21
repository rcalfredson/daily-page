import {
  createForestEnvironmentManifest,
  FOREST_BOULDER_TYPE,
  FOREST_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_GROUND_DETAIL_CELL_SIZE,
  FOREST_GROUND_PRESENTATION_VERSION,
  FOREST_ROCK_PALETTES,
  FOREST_WORLD_GENERATION_VERSION,
  forestEnvironmentAt,
  forestGroundDetailAt,
  resolveForestRockPalette,
  validateForestEnvironmentManifest
} from '../public/js/forest-environment.js';
import { composeEnvironmentProjectedForestScene } from '../server/services/forestProjectedScene.js';
import {
  forestCorridorCenter,
  generateForestSceneLayout
} from '../server/services/forestSceneLayout.js';
import { resolveForestPressureProfile } from '../server/services/forestScenePressure.js';
import {
  clearForestSceneAssetPool,
  prepareForestSceneAssets
} from '../server/services/forestSceneAssetPool.js';
import {
  encodeForestSceneAssets,
  FOREST_ASSET_TRANSPORT_RASTER,
  FOREST_ASSET_TRANSPORT_RUNS
} from '../server/services/forestSceneAssetTransport.js';
import {
  FOREST_TERRAIN_FEATURE_GENERATION_VERSION
} from '../server/services/forestTerrainFeatures.js';
import { playerCollides } from '../public/js/forest-scene-math.js';
import {
  createForestMarker,
  validateForestObjectPlacement
} from '../public/js/forest-world-overlay.js';

describe('first Activity Forest environment grammar', () => {
  const world = Object.freeze({ width: 3000, height: 1800 });

  function manifest(seed = 'environment-contract') {
    return createForestEnvironmentManifest({ seed, world });
  }

  it('defines an exactly serializable, deterministic, explicitly versioned manifest and query', () => {
    const first = manifest();
    const repeated = manifest();
    const position = { worldX: 1700, worldY: 800 };
    const classification = forestEnvironmentAt(first, position);

    expect(first).toEqual(repeated);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(JSON.parse(JSON.stringify(classification))).toEqual(classification);
    expect(classification).toEqual(forestEnvironmentAt(repeated, position));
    expect(first.schemaVersion).toBe(FOREST_ENVIRONMENT_SCHEMA_VERSION);
    expect(first.worldGenerationVersion).toBe(FOREST_WORLD_GENERATION_VERSION);
    expect(first.groundPresentationVersion).toBe(FOREST_GROUND_PRESENTATION_VERSION);
  });

  it('rejects malformed coordinates, manifests, versions, ids, strings, and extra fields', () => {
    const valid = manifest();
    for (const position of [
      { worldX: NaN, worldY: 2 },
      { worldX: Infinity, worldY: 2 },
      { worldX: Number.MAX_SAFE_INTEGER + 1, worldY: 2 },
      { worldX: -1, worldY: 2 },
      { worldX: world.width + 1, worldY: 2 },
      { worldX: 2, worldY: 2, cameraX: 4 }
    ]) expect(() => forestEnvironmentAt(valid, position)).toThrow();
    expect(() => forestEnvironmentAt(valid, { worldX: 0, worldY: 0 })).not.toThrow();
    expect(() => forestEnvironmentAt(valid, {
      worldX: world.width, worldY: world.height
    })).not.toThrow();
    for (const changed of [
      { ...valid, schemaVersion: 99 },
      { ...valid, worldGenerationVersion: 99 },
      { ...valid, groundPresentationVersion: 99 },
      { ...valid, grammarId: 'invented-biome' },
      { ...valid, seed: 'x'.repeat(81) },
      { ...valid, personalOverlay: {} }
    ]) expect(() => validateForestEnvironmentManifest(changed)).toThrow();
  });

  it('contains meaningful grove, rocky, and continuous intergrade area with an irregular edge', () => {
    const environment = manifest();
    const counts = { 'calm-grove': 0, 'rocky-rise': 0, intergrade: 0 };
    const boundaryXs = [];
    for (let worldY = 0; worldY <= world.height; worldY += 30) {
      let firstRockyX = null;
      for (let worldX = 0; worldX <= world.width; worldX += 30) {
        const result = forestEnvironmentAt(environment, { worldX, worldY });
        counts[result.dominantRegionId] += 1;
        if (result.transition.state === 'intergrade') counts.intergrade += 1;
        if (firstRockyX === null && result.dominantRegionId === 'rocky-rise') {
          firstRockyX = worldX;
        }
      }
      if (firstRockyX !== null) boundaryXs.push(firstRockyX);
    }
    expect(counts['calm-grove']).toBeGreaterThan(4000);
    expect(counts['rocky-rise']).toBeGreaterThan(500);
    expect(counts.intergrade).toBeGreaterThan(300);
    expect(new Set(boundaryXs).size).toBeGreaterThan(8);

    for (let worldX = 1; worldX < world.width; worldX += 47) {
      const left = forestEnvironmentAt(environment, { worldX: worldX - 1, worldY: 760 });
      const right = forestEnvironmentAt(environment, { worldX, worldY: 760 });
      expect(Math.abs(left.transition.rockyBlendPermille
        - right.transition.rockyBlendPermille)).toBeLessThanOrEqual(12);
    }
  });

  it('derives recognizable bounded ground details with rocky-frequency differences', () => {
    const environment = manifest();
    const details = [];
    for (let row = 0; row < Math.ceil(world.height / FOREST_GROUND_DETAIL_CELL_SIZE); row += 1) {
      for (let column = 0; column < Math.ceil(world.width / FOREST_GROUND_DETAIL_CELL_SIZE);
        column += 1) {
        const detail = forestGroundDetailAt(environment, { column, row });
        if (detail) details.push(detail);
      }
    }
    expect(JSON.parse(JSON.stringify(details))).toEqual(details);
    expect(details).toEqual(details.map(detail => forestGroundDetailAt(environment, {
      column: detail.cellColumn, row: detail.cellRow
    })));
    expect(new Set(details.map(({ type }) => type))).toEqual(new Set([
      'grass-tuft', 'gravel-patch', 'small-stone', 'bare-soil'
    ]));
    const rockDetails = details.filter(({ rockPaletteId }) => rockPaletteId);
    expect(new Set(rockDetails.map(({ rockPaletteId }) => rockPaletteId))).toEqual(
      new Set(FOREST_ROCK_PALETTES.map(({ id }) => id))
    );
    expect(rockDetails.every(({ rockPaletteId }) => (
      resolveForestRockPalette(rockPaletteId)?.id === rockPaletteId
    ))).toBeTrue();
    expect(resolveForestRockPalette('invented-rock')).toBeNull();
    const rocky = details.filter(({ rockyBlendPermille }) => rockyBlendPermille >= 500);
    const grove = details.filter(({ rockyBlendPermille }) => rockyBlendPermille < 500);
    const rockyStoneShare = rocky.filter(({ type }) => (
      type === 'small-stone' || type === 'gravel-patch'
    )).length / rocky.length;
    const groveStoneShare = grove.filter(({ type }) => (
      type === 'small-stone' || type === 'gravel-patch'
    )).length / grove.length;
    expect(rockyStoneShare).toBeGreaterThan(groveStoneShare * 2);
    expect(() => forestGroundDetailAt(environment, { column: -1, row: 0 })).toThrow();
    expect(() => forestGroundDetailAt(environment, {
      column: 0, row: 0, viewport: 'ignored'
    })).toThrow();
  });

  it('invalidates generated-base identity when environment seed or grammar inputs change', () => {
    const first = generateForestSceneLayout({
      seed: 'same-layout-seed', placementCount: 12, environmentManifest: manifest('first')
    });
    const repeated = generateForestSceneLayout({
      seed: 'same-layout-seed', placementCount: 12, environmentManifest: manifest('first')
    });
    const changed = generateForestSceneLayout({
      seed: 'same-layout-seed', placementCount: 12, environmentManifest: manifest('second')
    });
    const changedGrammar = manifest('first');
    changedGrammar.rockyRise.centerX += 1;
    const changedByGrammar = generateForestSceneLayout({
      seed: 'same-layout-seed', placementCount: 12, environmentManifest: changedGrammar
    });
    expect(repeated).toEqual(first);
    expect(changed.baseIdentity.layoutKey).not.toBe(first.baseIdentity.layoutKey);
    expect(changedByGrammar.baseIdentity.layoutKey).not.toBe(first.baseIdentity.layoutKey);
    expect(() => generateForestSceneLayout({
      placementCount: 2,
      world: { width: 3001, height: 1800 },
      environmentManifest: manifest()
    })).toThrowError('Forest environment and scene world bounds must match.');
  });

  it('derives writing habitat from accepted position before projection and stays botanically varied', () => {
    const profile = resolveForestPressureProfile('first-regions');
    const base = generateForestSceneLayout(profile.layout);
    const projected = composeEnvironmentProjectedForestScene(base);
    const repeated = composeEnvironmentProjectedForestScene(
      generateForestSceneLayout(profile.layout)
    );
    const regions = Object.groupBy(projected.layout.placements,
      placement => placement.originatingRegionId);

    expect(repeated.layout).toEqual(projected.layout);
    expect(projected.layout.placements.length).toBe(60);
    expect(projected.fixtures.length).toBe(60);
    expect(new Set(projected.fixtures.map(({ id }) => id)).size).toBe(60);
    expect(projected.assetProjections.size).toBe(60);
    const serializedPlacements = JSON.stringify(projected.layout.placements);
    for (const excluded of [
      'createdAt', 'roomId', 'wordCount', 'collaboratorCount', 'translationCount',
      'commentCount', 'reactionCount', 'questApproved', 'projectionFingerprint', 'explanations'
    ]) expect(serializedPlacements).not.toContain(`"${excluded}"`);
    for (const placement of projected.layout.placements) {
      const environment = forestEnvironmentAt(projected.layout.environment, {
        worldX: placement.worldX, worldY: placement.worldY
      });
      const fixture = projected.fixtures.find(({ id }) => placement.fixtureId === id);
      expect(placement.originatingHabitatId).toBe(environment.habitatId);
      expect(fixture.treeMeaning.habitat).toBe(environment.habitatId);
      expect(placement.assetKey).toContain('meaning-v1');
    }
    for (const placements of Object.values(regions)) {
      expect(new Set(placements.map(({ phenotypeId }) => phenotypeId)).size).toBeGreaterThan(1);
    }
    const rockyConifers = regions['rocky-rise'].filter(
      ({ phenotypeId }) => phenotypeId === 'wind-shaped-highland-conifer'
    ).length / regions['rocky-rise'].length;
    const groveConifers = regions['calm-grove'].filter(
      ({ phenotypeId }) => phenotypeId === 'wind-shaped-highland-conifer'
    ).length / regions['calm-grove'].length;
    expect(rockyConifers).toBeGreaterThan(groveConifers);
  });

  it('keeps density acceptance bounded, spacing valid, and the established profiles unchanged', () => {
    const profile = resolveForestPressureProfile('first-regions');
    const scene = generateForestSceneLayout(profile.layout);
    expect(scene.environmentPlacementDiagnostics.termination).toBe('requested-count-reached');
    expect(scene.environmentPlacementDiagnostics.densityRejectionCount).toBeGreaterThan(0);
    expect(scene.environmentPlacementDiagnostics.attemptedCandidateCount)
      .toBeLessThanOrEqual(scene.placements.length * 100);
    scene.placements.forEach((placement, index) => {
      expect(placement.treeDensityPermille).toBeGreaterThanOrEqual(670);
      expect(placement.treeDensityPermille).toBeLessThanOrEqual(1000);
      expect(Math.abs(placement.worldX - forestCorridorCenter(
        placement.worldY, scene.world.width
      ))).toBeGreaterThanOrEqual(scene.corridor.halfWidth);
      for (const other of scene.placements.slice(index + 1)) {
        expect(Math.hypot(placement.worldX - other.worldX,
          placement.worldY - other.worldY)).toBeGreaterThanOrEqual(76);
      }
    });
    expect(generateForestSceneLayout()).toEqual(generateForestSceneLayout({}));
    expect(resolveForestPressureProfile('post-tree-meaning').projectedEnvironment)
      .toBeUndefined();
    expect(resolveForestPressureProfile('botanical-range').layout.assetPoolSize).toBe(24);
  });

  it('generates stable collidable boulders with rocky bias and protected navigation space', () => {
    const profile = resolveForestPressureProfile('first-regions');
    const scene = generateForestSceneLayout(profile.layout);
    const repeated = generateForestSceneLayout(profile.layout);
    expect(repeated.terrainFeatures).toEqual(scene.terrainFeatures);
    expect(JSON.parse(JSON.stringify(scene.terrainFeatures))).toEqual(scene.terrainFeatures);
    expect(scene.terrainFeatureGenerationVersion)
      .toBe(FOREST_TERRAIN_FEATURE_GENERATION_VERSION);
    expect(scene.terrainFeatures.length).toBeGreaterThan(10);
    expect(scene.terrainFeatures.filter(({ originatingRegionId }) => (
      originatingRegionId === 'rocky-rise'
    )).length).toBeGreaterThan(scene.terrainFeatures.length * 0.7);
    expect(new Set(scene.terrainFeatures.map(({ variantId }) => variantId))).toEqual(new Set([
      'low', 'shouldered', 'mossy-outcrop'
    ]));
    expect(new Set(scene.terrainFeatures.map(({ rockPaletteId }) => rockPaletteId))).toEqual(
      new Set(FOREST_ROCK_PALETTES.map(({ id }) => id))
    );
    for (const feature of scene.terrainFeatures) {
      expect(feature.type).toBe(FOREST_BOULDER_TYPE);
      expect(Math.abs(feature.worldX - forestCorridorCenter(
        feature.worldY, scene.world.width
      ))).toBeGreaterThanOrEqual(scene.corridor.halfWidth
        + feature.collisionRadius + 24);
      expect(scene.placements.some(placement => Math.hypot(
        placement.worldX - feature.worldX, placement.worldY - feature.worldY
      ) < feature.collisionRadius + 42)).toBeFalse();
      expect(playerCollides({
        worldX: feature.worldX,
        worldY: feature.worldY,
        radius: 10
      }, [feature])).toBeTrue();
    }
    const boulder = scene.terrainFeatures[0];
    const marker = createForestMarker(boulder.worldX, boulder.worldY);
    expect(validateForestObjectPlacement(marker, scene).reason)
      .toBe('terrain-feature-collision');
  });

  it('keeps a corridor route through both regions and both runtime transports', async () => {
    const profile = resolveForestPressureProfile('first-regions');
    const projected = composeEnvironmentProjectedForestScene(
      generateForestSceneLayout(profile.layout)
    );
    const corridorRegions = new Set();
    for (let worldY = 0; worldY <= projected.layout.world.height; worldY += 20) {
      const worldX = Math.round(forestCorridorCenter(worldY, projected.layout.world.width));
      corridorRegions.add(forestEnvironmentAt(projected.layout.environment, { worldX, worldY })
        .dominantRegionId);
    }
    expect(corridorRegions).toEqual(new Set(['calm-grove', 'rocky-rise']));
    const selected = [
      projected.layout.placements.find(({ originatingRegionId }) => (
        originatingRegionId === 'calm-grove'
      )),
      projected.layout.placements.find(({ originatingRegionId }) => (
        originatingRegionId === 'rocky-rise'
      ))
    ];
    clearForestSceneAssetPool();
    const assets = prepareForestSceneAssets(selected, projected.assetProjections).assets;
    const runs = await encodeForestSceneAssets(assets, FOREST_ASSET_TRANSPORT_RUNS);
    const rasters = await encodeForestSceneAssets(assets, FOREST_ASSET_TRANSPORT_RASTER);
    expect(runs.assets).toEqual(assets);
    expect(rasters.assets.map(({ cacheKey }) => cacheKey))
      .toEqual(assets.map(({ cacheKey }) => cacheKey));
    expect(rasters.assets.every(asset => asset.layers.map(({ id }) => id).join(',')
      === 'rear-foliage,wood,front-foliage')).toBeTrue();
  });

  it('keeps the browser painter viewport-bounded and preserves either-surface overlays', async () => {
    const fs = await import('node:fs');
    const painter = fs.readFileSync('public/js/activity-forest.js', 'utf8');
    const overlay = fs.readFileSync('public/js/forest-world-overlay.js', 'utf8');
    expect(painter).toContain('forestEnvironmentAt(scene.environment');
    expect(painter).toContain('forestGroundDetailAt(scene.environment');
    expect(painter).toContain('camera.x + camera.width) / cellSize');
    expect(painter).not.toContain('scene.world.width; worldX += cellSize');
    expect(painter).toContain('paintBoulder(item.object)');
    expect(overlay).not.toContain('forestEnvironmentAt');
    const grove = forestEnvironmentAt(manifest(), { worldX: 100, worldY: 100 });
    const rockyManifest = manifest();
    const rocky = forestEnvironmentAt(rockyManifest, {
      worldX: rockyManifest.rockyRise.centerX, worldY: rockyManifest.rockyRise.centerY
    });
    expect(grove.suitability.clearingObjects).toBe('either-surface');
    expect(rocky.suitability.clearingObjects).toBe('either-surface');
    expect(grove.suitability.discoveries).toBe('either-surface');
    expect(rocky.suitability.discoveries).toBe('either-surface');
  });
});

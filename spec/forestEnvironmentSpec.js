import {
  createForestEnvironmentManifest,
  FOREST_BOULDER_TYPE,
  FOREST_BRIDGE_TYPE,
  FOREST_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_GROUND_DETAIL_CELL_SIZE,
  FOREST_GROUND_PRESENTATION_VERSION,
  FOREST_ROCK_PALETTES,
  FOREST_WORLD_GENERATION_VERSION,
  forestBridgeContains,
  forestBridgeElevationAt,
  forestBridgeLocalCoordinates,
  forestBridgeRailCollides,
  forestBridgeWorldPosition,
  forestEnvironmentAt,
  forestGroundDetailAt,
  forestStreamCenterY,
  resolveForestRockPalette,
  validateForestEnvironmentManifest,
  validateForestStreamCrossing
} from '../public/js/forest-environment.js';
import { composeEnvironmentProjectedForestScene } from '../server/services/forestProjectedScene.js';
import { createForestExploration } from '../server/services/forestSceneExploration.js';
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
import {
  forestTerrainTraversableAt,
  moveForestPlayer,
  playerCollides
} from '../public/js/forest-scene-math.js';
import {
  createForestMarker,
  validateForestObjectPlacement
} from '../public/js/forest-world-overlay.js';
import {
  generateForestDiscoveries,
  validateForestDiscoveryPlacement
} from '../public/js/forest-discoveries.js';

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
      { ...valid, stream: { ...valid.stream, flowDirection: 'west' } },
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

  it('classifies a continuous winding stream, banks, land, and bounded suitability', () => {
    const environment = manifest();
    const sampledCenters = [];
    for (let worldX = 0; worldX <= world.width; worldX += 40) {
      const centerY = forestStreamCenterY(environment, worldX);
      sampledCenters.push(centerY);
      const water = forestEnvironmentAt(environment, { worldX, worldY: centerY });
      const bank = forestEnvironmentAt(environment, {
        worldX,
        worldY: centerY + environment.stream.halfWidth + 1
      });
      const land = forestEnvironmentAt(environment, {
        worldX,
        worldY: centerY + environment.stream.halfWidth + environment.stream.bankWidth + 1
      });
      expect(water.groundSurfaceId).toBe('shallow-stream');
      expect(water.hydrology.state).toBe('water');
      expect(water.suitability.treeDensityPermille).toBe(0);
      expect(water.suitability.discoveries).toBe('forbidden-water');
      expect(bank.groundSurfaceId).toBe('stream-bank');
      expect(bank.hydrology.state).toBe('bank');
      expect(land.hydrology.state).toBe('land');
    }
    expect(Math.max(...sampledCenters) - Math.min(...sampledCenters)).toBeGreaterThan(150);
    expect(new Set(sampledCenters).size).toBeGreaterThan(40);
    expect(() => forestStreamCenterY(environment, -1)).toThrow();
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
      expect(placement.treeDensityPermille).toBeGreaterThanOrEqual(230);
      expect(placement.treeDensityPermille).toBeLessThanOrEqual(1000);
      expect(placement.groundSurfaceId).not.toBe('shallow-stream');
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
    const landBoulders = scene.terrainFeatures.filter(({ terrainRole }) => (
      terrainRole === 'land-boulder'
    ));
    expect(landBoulders.filter(({ originatingRegionId }) => (
      originatingRegionId === 'rocky-rise'
    )).length).toBeGreaterThan(landBoulders.length * 0.7);
    expect(new Set(scene.terrainFeatures.map(({ variantId }) => variantId))).toEqual(new Set([
      'low', 'shouldered', 'mossy-outcrop'
    ]));
    expect(new Set(scene.terrainFeatures.map(({ rockPaletteId }) => rockPaletteId))).toEqual(
      new Set(FOREST_ROCK_PALETTES.map(({ id }) => id))
    );
    const streamBoulders = scene.terrainFeatures.filter(({ terrainRole }) => (
      terrainRole === 'stream-boulder'
    ));
    expect(streamBoulders.length).toBeGreaterThanOrEqual(5);
    expect(streamBoulders.every(feature => forestEnvironmentAt(scene.environment, {
      worldX: feature.worldX, worldY: feature.worldY
    }).hydrology.state === 'water')).toBeTrue();
    expect(streamBoulders.every(feature => (
      scene.crossings.every(crossing => Math.abs(feature.worldX - crossing.worldX) >= 135)
    ))).toBeTrue();
    const bankBoulders = scene.terrainFeatures.filter(({ terrainRole }) => (
      terrainRole === 'bank-boulder'
    ));
    expect(bankBoulders.length).toBeGreaterThanOrEqual(4);
    expect(bankBoulders.every(feature => forestEnvironmentAt(scene.environment, {
      worldX: feature.worldX, worldY: feature.worldY
    }).hydrology.state === 'bank')).toBeTrue();
    expect(bankBoulders.every(feature => (
      scene.crossings.every(crossing => Math.abs(feature.worldX - crossing.worldX) >= 150)
    ))).toBeTrue();
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
      if (feature.terrainRole === 'land-boulder') {
        expect(scene.crossings.some(crossing => forestBridgeContains(
          crossing, feature, feature.collisionRadius + 20
        ))).toBeFalse();
      }
    }
    const boulder = scene.terrainFeatures[0];
    const marker = createForestMarker(boulder.worldX, boulder.worldY);
    expect(validateForestObjectPlacement(marker, scene).reason)
      .toBe('terrain-feature-collision');
  });

  it('places two differently angled arched bridges and permits both planar crossings', () => {
    const scene = generateForestSceneLayout(resolveForestPressureProfile('first-regions').layout);
    const bridge = scene.crossing;
    const secondBridge = scene.crossings[1];
    expect(scene.crossings.length).toBe(2);
    expect(scene.crossings[0]).toBe(bridge);
    expect(bridge.type).toBe(FOREST_BRIDGE_TYPE);
    expect(bridge.maximumElevationPixels).toBe(24);
    expect(JSON.parse(JSON.stringify(bridge))).toEqual(bridge);
    expect(validateForestStreamCrossing(bridge, scene.world)).toBe(bridge);
    expect(() => validateForestStreamCrossing({ ...bridge, orientation: 'north-south' }, scene.world))
      .toThrow();
    expect(() => validateForestStreamCrossing({ ...bridge, angleMilliradians: 1.5 }, scene.world))
      .toThrow();
    expect(bridge.worldY).toBe(forestStreamCenterY(scene.environment, bridge.worldX));
    expect(Math.abs(bridge.worldX - forestCorridorCenter(
      bridge.worldY, scene.world.width
    ))).toBeLessThanOrEqual(1);
    expect(forestBridgeElevationAt(bridge, {
      worldX: bridge.worldX, worldY: bridge.worldY
    })).toBe(bridge.maximumElevationPixels);
    const angle = bridge.angleMilliradians / 1000;
    const secondAngle = secondBridge.angleMilliradians / 1000;
    expect(Math.abs(Math.cos(angle))).toBeGreaterThan(0.25);
    expect(Math.abs(Math.sin(angle))).toBeGreaterThan(0.25);
    expect(Math.abs(secondAngle - angle)).toBeGreaterThan(0.75);
    expect(validateForestStreamCrossing(secondBridge, scene.world)).toBe(secondBridge);
    expect(secondBridge.worldY).toBe(forestStreamCenterY(
      scene.environment, secondBridge.worldX
    ));
    expect(forestBridgeElevationAt(secondBridge, {
      worldX: secondBridge.worldX, worldY: secondBridge.worldY
    })).toBe(secondBridge.maximumElevationPixels);
    expect(forestTerrainTraversableAt(scene, {
      worldX: secondBridge.worldX, worldY: secondBridge.worldY, radius: 10
    })).toBeTrue();
    expect(scene.placements.some(placement => forestBridgeContains(
      secondBridge, placement, 42
    ))).toBeFalse();
    for (const crossing of scene.crossings) {
      const railPosition = forestBridgeWorldPosition(
        crossing, crossing.halfLength - 5, crossing.halfWidth + 2
      );
      expect(forestEnvironmentAt(scene.environment, {
        worldX: Math.round(railPosition.worldX),
        worldY: Math.round(railPosition.worldY)
      }).hydrology.state).not.toBe('water');
      expect(forestBridgeRailCollides(crossing, { ...railPosition, radius: 10 }, 10))
        .toBeTrue();
      expect(forestTerrainTraversableAt(scene, { ...railPosition, radius: 10 })).toBeFalse();
      const outsideRail = forestBridgeWorldPosition(
        crossing, crossing.halfLength - 5, crossing.halfWidth + 18
      );
      expect(forestTerrainTraversableAt(scene, { ...outsideRail, radius: 10 })).toBeTrue();
      let railingTestPlayer = { ...outsideRail, radius: 10, movementSpeed: 100 };
      const crossingAngle = crossing.angleMilliradians / 1000;
      for (let step = 0; step < 6; step += 1) {
        railingTestPlayer = moveForestPlayer(railingTestPlayer, {
          x: Math.sin(crossingAngle), y: -Math.cos(crossingAngle)
        }, 0.05, scene.world, [], scene);
      }
      expect(forestBridgeLocalCoordinates(crossing, railingTestPlayer).lateral)
        .toBeGreaterThan(crossing.halfWidth + 2);
    }
    const southApproach = forestBridgeWorldPosition(bridge, bridge.halfLength);
    expect(forestBridgeElevationAt(bridge, southApproach)).toBe(0);
    expect(forestBridgeLocalCoordinates(bridge, southApproach).longitudinal)
      .toBeCloseTo(bridge.halfLength, 6);
    expect(forestBridgeContains(bridge, {
      worldX: bridge.worldX, worldY: bridge.worldY
    })).toBeTrue();
    const verticalBridge = { ...bridge, angleMilliradians: 1571 };
    expect(forestBridgeElevationAt(verticalBridge, {
      worldX: verticalBridge.worldX, worldY: verticalBridge.worldY
    })).toBe(0);
    const almostVerticalBridge = { ...bridge, angleMilliradians: 1560 };
    expect(forestBridgeElevationAt(almostVerticalBridge, {
      worldX: almostVerticalBridge.worldX, worldY: almostVerticalBridge.worldY
    })).toBe(almostVerticalBridge.maximumElevationPixels);
    expect(forestTerrainTraversableAt(scene, {
      worldX: bridge.worldX, worldY: bridge.worldY, radius: 10
    })).toBeTrue();
    const offBridgeX = Math.round(bridge.worldX - (Math.sin(angle) * 90));
    const offBridgeStreamY = forestStreamCenterY(scene.environment, offBridgeX);
    expect(forestTerrainTraversableAt(scene, {
      worldX: offBridgeX, worldY: offBridgeStreamY, radius: 10
    })).toBeFalse();

    const walk = (crossing) => {
      const crossingAngle = crossing.angleMilliradians / 1000;
      const start = forestBridgeWorldPosition(crossing, crossing.halfLength + 18);
      let player = {
        ...start,
        radius: 10,
        movementSpeed: 100
      };
      for (let step = 0; step < 58; step += 1) {
        player = moveForestPlayer(player, {
          x: -Math.cos(crossingAngle), y: -Math.sin(crossingAngle)
        }, 0.05, scene.world, [], scene);
      }
      return player;
    };
    expect(forestBridgeLocalCoordinates(bridge, walk(bridge)).longitudinal)
      .toBeLessThan(-bridge.halfLength + 5);
    expect(forestBridgeLocalCoordinates(secondBridge, walk(secondBridge)).longitudinal)
      .toBeLessThan(-secondBridge.halfLength + 5);
  });

  it('keeps the environment-profile discovery offering finite and out of water', () => {
    const projected = composeEnvironmentProjectedForestScene(generateForestSceneLayout(
      resolveForestPressureProfile('first-regions').layout
    ));
    const scene = createForestExploration(projected.layout, { fixtures: projected.fixtures });
    const discoveries = generateForestDiscoveries(scene);
    expect(discoveries.length).toBe(9);
    expect(discoveries.every(discovery => forestEnvironmentAt(scene.environment, {
      worldX: discovery.worldX, worldY: discovery.worldY
    }).hydrology.state !== 'water')).toBeTrue();
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

  it('keeps painting viewport-bounded and applies explicit water suitability', async () => {
    const fs = await import('node:fs');
    const painter = fs.readFileSync('public/js/activity-forest.js', 'utf8');
    const overlay = fs.readFileSync('public/js/forest-world-overlay.js', 'utf8');
    expect(painter).toContain('forestEnvironmentAt(scene.environment');
    expect(painter).toContain('forestGroundDetailAt(scene.environment');
    expect(painter).toContain('camera.x + camera.width) / cellSize');
    expect(painter).not.toContain('scene.world.width; worldX += cellSize');
    expect(painter).toContain('paintBoulder(item.object)');
    expect(painter).toContain('streamFlowDeflection(worldX, baseY)');
    expect(painter).toContain('streamFlowVariation(markIndex, lane');
    expect(painter).toContain('paintStreamColorBand(7, 20');
    expect(painter).toContain('const grove = [82, 132, 76]');
    expect(painter).toContain("paintStreamRibbon(stream.halfWidth, '#247486')");
    expect(painter).toContain('paintStreamSurfaceTexture(stream)');
    expect(painter).toContain('paintStreamEdgeTexture(stream)');
    expect(painter).toContain("terrainRole === 'bank-boulder'");
    expect(painter).toContain('ambientMotionActive ? Math.floor(elapsedSeconds * 6) : 0');
    expect(painter).toContain('const flowIdentity = markIndex - flowCycle');
    expect(painter).toContain('forestStreamCenterY(scene.environment, streamQueryX)');
    expect(painter).toContain('forestBridgeWorldPosition(bridge');
    expect(painter).toContain('forestBridgeWorldPosition(bridge, longitudinal, 0)');
    expect(painter).toContain('crossings.forEach(paintBridgeDeck)');
    expect(painter).toContain('crossings.forEach(paintBridgeRails)');
    expect(painter).toContain('bridge, 1, plankOrdinal');
    expect(painter).toContain('bridge, 2, plankOrdinal + 1');
    expect(painter).toContain("context.strokeStyle = '#2f2924'");
    expect(painter).toContain('const elevationRatio = forestBridgeElevationAt');
    expect(overlay).toContain('forestEnvironmentAt');
    const grove = forestEnvironmentAt(manifest(), { worldX: 100, worldY: 100 });
    const rockyManifest = manifest();
    const rocky = forestEnvironmentAt(rockyManifest, {
      worldX: rockyManifest.rockyRise.centerX, worldY: rockyManifest.rockyRise.centerY
    });
    expect(grove.suitability.clearingObjects).toBe('either-land-surface');
    expect(rocky.suitability.clearingObjects).toBe('either-land-surface');
    expect(grove.suitability.discoveries).toBe('land-and-bank');
    expect(rocky.suitability.discoveries).toBe('land-and-bank');
    const streamY = forestStreamCenterY(rockyManifest, 100);
    const waterMarker = createForestMarker(100, streamY);
    expect(validateForestObjectPlacement(waterMarker, {
      environment: rockyManifest,
      world: rockyManifest.world,
      placements: [],
      terrainFeatures: []
    }).reason).toBe('water-or-bank-surface');
    expect(validateForestDiscoveryPlacement({
      schemaVersion: 1,
      id: 'forest-discovery-v1-aaaaaaaa-0-01',
      type: 'discovery',
      material: 'smooth-stones',
      cycle: 0,
      worldX: 100,
      worldY: streamY
    }, {
      environment: rockyManifest,
      world: rockyManifest.world,
      placements: [],
      terrainFeatures: []
    }).reason).toBe('water-surface');
  });
});

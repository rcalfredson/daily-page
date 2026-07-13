import {
  DEFAULT_FOREST_SCENE_CONFIG,
  forestCorridorCenter,
  generateForestSceneLayout
} from '../server/services/forestSceneLayout.js';
import {
  clearForestSceneAssetPool,
  forestSceneAssetPoolSize,
  prepareForestScene
} from '../server/services/forestSceneAssetPool.js';
import {
  placementVisualRect,
  visibleForestPlacements
} from '../public/js/forest-scene-math.js';

describe('static Activity Forest scene', () => {
  beforeEach(() => clearForestSceneAssetPool());

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
});

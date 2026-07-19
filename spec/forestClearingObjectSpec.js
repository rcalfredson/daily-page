import {
  canAffordForestClearingObject,
  createForestClearingObject,
  createForestClearingPlacementPreview,
  FOREST_CLEARING_OBJECT_MINIMUM_SPACING,
  FOREST_CLEARING_OBJECT_DEFINITIONS,
  FOREST_CLEARING_OBJECT_MAXIMUM,
  FOREST_CLEARING_OBJECT_PER_TYPE_MAXIMUM,
  FOREST_CLEARING_OBJECT_TYPES,
  FOREST_CLEARING_TREE_CLEARANCE,
  forestClearingMaterialLedger,
  isForestClearingObject,
  nextForestClearingObjectId,
  normalizeForestSignText,
  overlayWithForestClearingObject,
  overlayWithoutForestClearingObject,
  validateForestClearingObjectPlacement
} from '../public/js/forest-clearing-objects.js';
import {
  createEmptyForestOverlay,
  FOREST_SEED_POD_LANTERN_TYPE,
  FOREST_STONE_BENCH_TYPE,
  FOREST_TRAIL_SIGN_TYPE,
  applyForestOverlay,
  validateForestOverlay
} from '../public/js/forest-world-overlay.js';
import { createForestDevOverlayPersistence } from '../public/js/forest-overlay-persistence.js';
import {
  focusedForestSceneItem,
  forestDepthOrder,
  forestLanternGlowIntensity,
  forestSolidClearingPlacements,
  moveForestPlayer,
  visibleForestObjects
} from '../public/js/forest-scene-math.js';
import { createForestExploration } from '../server/services/forestSceneExploration.js';
import { generateForestSceneLayout } from '../server/services/forestSceneLayout.js';

const fullInventory = { 'fallen-twigs': 3, 'smooth-stones': 3, 'seed-pods': 3 };

function openScene() {
  const scene = createForestExploration(generateForestSceneLayout({
    seed: 'clearing-contract', world: { width: 700, height: 700 }, placementCount: 0
  }));
  return { ...scene, exploration: { ...scene.exploration,
    spawn: { ...scene.exploration.spawn, worldX: 50, worldY: 650 } } };
}

function memoryStorage(fail = false) {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (fail) throw new Error('write unavailable');
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key)
  };
}

function place(overlay, scene, type, x, y, inventory = fullInventory, text = '') {
  const id = nextForestClearingObjectId(overlay, type);
  return overlayWithForestClearingObject(overlay,
    createForestClearingObject(type, x, y, id, text), scene, inventory);
}

describe('Activity Forest clearing objects', () => {
  it('defines exactly three versioned affordances with fixed costs', () => {
    expect(FOREST_CLEARING_OBJECT_TYPES).toEqual([
      'trail-sign', 'stone-bench', 'seed-pod-lantern'
    ]);
    expect(FOREST_CLEARING_OBJECT_DEFINITIONS[FOREST_TRAIL_SIGN_TYPE].cost).toEqual({
      'fallen-twigs': 2, 'smooth-stones': 0, 'seed-pods': 0
    });
    expect(FOREST_CLEARING_OBJECT_DEFINITIONS[FOREST_STONE_BENCH_TYPE].cost).toEqual({
      'fallen-twigs': 0, 'smooth-stones': 2, 'seed-pods': 0
    });
    expect(FOREST_CLEARING_OBJECT_DEFINITIONS[FOREST_SEED_POD_LANTERN_TYPE].cost).toEqual({
      'fallen-twigs': 1, 'smooth-stones': 0, 'seed-pods': 2
    });
    expect(Object.isFrozen(FOREST_CLEARING_OBJECT_DEFINITIONS)).toBeTrue();
  });

  it('uses discriminated exact schemas and normalized bounded sign text', () => {
    const sign = createForestClearingObject(FOREST_TRAIL_SIGN_TYPE, 100.4, 120.7,
      'forest-clearing-v1-trail-sign-01', '  Cafe\u0301\npath  ');
    const bench = createForestClearingObject(FOREST_STONE_BENCH_TYPE, 200, 220,
      'forest-clearing-v1-stone-bench-01');
    expect(sign.text).toBe('Café path');
    expect(Object.keys(sign).sort()).toEqual([
      'id', 'schemaVersion', 'text', 'type', 'worldX', 'worldY'
    ]);
    expect(Object.keys(bench).sort()).toEqual([
      'id', 'schemaVersion', 'type', 'worldX', 'worldY'
    ]);
    expect(isForestClearingObject(sign)).toBeTrue();
    expect(isForestClearingObject({ ...bench, text: 'not allowed' })).toBeFalse();
    expect(normalizeForestSignText('bad\u0000text').reason).toBe('sign-control-character');
    expect(normalizeForestSignText('🌲'.repeat(61)).reason).toBe('sign-text-too-long');
    expect(JSON.parse(JSON.stringify(sign))).toEqual(sign);
  });

  it('derives exact available and committed materials from valid objects', () => {
    const scene = openScene();
    let overlay = createEmptyForestOverlay(scene.baseIdentity);
    overlay = place(overlay, scene, FOREST_TRAIL_SIGN_TYPE, 180, 180).overlay;
    overlay = place(overlay, scene, FOREST_STONE_BENCH_TYPE, 280, 280).overlay;
    overlay = place(overlay, scene, FOREST_SEED_POD_LANTERN_TYPE, 380, 380).overlay;
    expect(forestClearingMaterialLedger(fullInventory, overlay.objects)).toEqual({
      committed: { 'fallen-twigs': 3, 'smooth-stones': 2, 'seed-pods': 2 },
      available: { 'fallen-twigs': 0, 'smooth-stones': 1, 'seed-pods': 1 },
      valid: true, reason: null
    });
    expect(canAffordForestClearingObject(fullInventory, overlay.objects,
      FOREST_TRAIL_SIGN_TYPE)).toBeFalse();
    expect(forestClearingMaterialLedger({ ...fullInventory, 'fallen-twigs': 2 },
      overlay.objects).reason).toBe('impossible-material-commitment');
  });

  it('places once, preserves identity and cost on move/edit, and refunds once on removal', () => {
    const scene = openScene();
    const empty = createEmptyForestOverlay(scene.baseIdentity);
    const placed = place(empty, scene, FOREST_TRAIL_SIGN_TYPE, 180, 180,
      fullInventory, 'North path');
    expect(placed.valid).toBeTrue();
    const moved = overlayWithForestClearingObject(placed.overlay,
      createForestClearingObject(FOREST_TRAIL_SIGN_TYPE, 280, 220,
        placed.overlay.objects[0].id, 'A quieter path'), scene, fullInventory);
    expect(moved.valid).toBeTrue();
    expect(moved.overlay.objects[0].id).toBe(placed.overlay.objects[0].id);
    expect(forestClearingMaterialLedger(fullInventory, moved.overlay.objects).committed)
      .toEqual(forestClearingMaterialLedger(fullInventory, placed.overlay.objects).committed);
    const removed = overlayWithoutForestClearingObject(moved.overlay, moved.overlay.objects[0].id);
    expect(removed.valid).toBeTrue();
    expect(forestClearingMaterialLedger(fullInventory, removed.overlay.objects).available)
      .toEqual(fullInventory);
    expect(overlayWithoutForestClearingObject(removed.overlay,
      moved.overlay.objects[0].id).reason).toBe('clearing-object-not-found');
  });

  it('rejects unaffordable, colliding, bounded, duplicate, and unknown placements', () => {
    const scene = openScene();
    const empty = createEmptyForestOverlay(scene.baseIdentity);
    expect(place(empty, scene, FOREST_TRAIL_SIGN_TYPE, 180, 180,
      { ...fullInventory, 'fallen-twigs': 1 }).reason).toBe('insufficient-materials');
    const preview = createForestClearingPlacementPreview(FOREST_STONE_BENCH_TYPE,
      scene.exploration.spawn.worldX, scene.exploration.spawn.worldY,
      'forest-clearing-v1-stone-bench-01', scene, [], [], scene.exploration.spawn);
    expect(preview.valid).toBeFalse();
    expect(['entrance-collision', 'protected-entrance', 'player-collision'])
      .toContain(preview.reason);
    expect(() => createForestClearingObject('house', 1, 1, 'bad')).toThrow();

    let overlay = empty;
    for (let index = 0; index < FOREST_CLEARING_OBJECT_PER_TYPE_MAXIMUM; index += 1) {
      overlay = place(overlay, scene, FOREST_STONE_BENCH_TYPE,
        140 + index * 100, 160, { ...fullInventory, 'smooth-stones': 20 }).overlay;
    }
    expect(place(overlay, scene, FOREST_STONE_BENCH_TYPE, 500, 160,
      { ...fullInventory, 'smooth-stones': 20 }).reason).toBe('clearing-object-type-limit');
    expect(FOREST_CLEARING_OBJECT_MAXIMUM).toBe(9);
  });

  it('allows close creative compositions while preserving exact collision footprints', () => {
    const scene = openScene();
    const tree = { id: 'nearby-tree', worldX: 300, worldY: 300, collisionRadius: 20 };
    scene.placements = [tree];
    const bench = createForestClearingObject(FOREST_STONE_BENCH_TYPE,
      tree.worldX + tree.collisionRadius
        + FOREST_CLEARING_OBJECT_DEFINITIONS[FOREST_STONE_BENCH_TYPE].collisionRadius
        + FOREST_CLEARING_TREE_CLEARANCE,
      tree.worldY, 'forest-clearing-v1-stone-bench-01');
    const lantern = createForestClearingObject(FOREST_SEED_POD_LANTERN_TYPE,
      bench.worldX,
      bench.worldY + FOREST_CLEARING_OBJECT_DEFINITIONS[FOREST_STONE_BENCH_TYPE].collisionRadius
        + FOREST_CLEARING_OBJECT_DEFINITIONS[FOREST_SEED_POD_LANTERN_TYPE].collisionRadius
        + FOREST_CLEARING_OBJECT_MINIMUM_SPACING,
      'forest-clearing-v1-seed-pod-lantern-01');

    expect(FOREST_CLEARING_TREE_CLEARANCE).toBe(8);
    expect(FOREST_CLEARING_OBJECT_MINIMUM_SPACING).toBe(8);
    expect(validateForestClearingObjectPlacement(bench, scene)).toEqual({
      valid: true, reason: null
    });
    expect(validateForestClearingObjectPlacement(lantern, scene, [bench])).toEqual({
      valid: true, reason: null
    });
    expect(validateForestClearingObjectPlacement({ ...bench, worldX: bench.worldX - 1 }, scene)
      .reason).toBe('tree-interaction-space');
    expect(validateForestClearingObjectPlacement({ ...lantern, worldY: lantern.worldY - 1 },
      scene, [bench]).reason).toBe('clearing-object-spacing');

    const overlay = { ...createEmptyForestOverlay(scene.baseIdentity), revision: 2,
      objects: [bench, lantern] };
    expect(applyForestOverlay(scene, overlay).error).toBeNull();
  });

  it('persists the complete candidate before live state changes on success or failure', () => {
    const scene = openScene();
    const live = createEmptyForestOverlay(scene.baseIdentity);
    const candidate = place(live, scene, FOREST_TRAIL_SIGN_TYPE, 180, 180).overlay;
    const failing = createForestDevOverlayPersistence(memoryStorage(true));
    expect(() => failing.save(candidate)).toThrowError(/write unavailable/);
    expect(live.objects).toEqual([]);
    expect(forestClearingMaterialLedger(fullInventory, live.objects).available).toEqual(fullInventory);
    const persistence = createForestDevOverlayPersistence(memoryStorage());
    const saved = persistence.save(candidate);
    expect(saved).toEqual(candidate);
    expect(validateForestOverlay(saved, scene.baseIdentity).valid).toBeTrue();
  });

  it('participates in deterministic focus, culling, depth order, and solid collision', () => {
    const sign = createForestClearingObject(FOREST_TRAIL_SIGN_TYPE, 100, 100,
      'forest-clearing-v1-trail-sign-01', 'Here');
    const bench = createForestClearingObject(FOREST_STONE_BENCH_TYPE, 100, 130,
      'forest-clearing-v1-stone-bench-01');
    const player = { worldX: 100, worldY: 100, radius: 8, movementSpeed: 100 };
    expect(visibleForestObjects([sign, bench], { x: 0, y: 0, width: 200, height: 200 }))
      .toEqual([sign, bench]);
    expect(focusedForestSceneItem(player, [], [bench, sign], 40).id).toBe(sign.id);
    expect(forestDepthOrder([], player, [bench, sign]).map(({ id }) => id)).toEqual([
      sign.id, '~player', bench.id
    ]);
    const moved = moveForestPlayer({ ...player, worldX: 60 }, { x: 1, y: 0 }, 0.4,
      { width: 500, height: 500 }, forestSolidClearingPlacements([
        { ...bench, worldY: 100 }
      ]));
    expect(moved.worldX).toBe(60);
    expect(validateForestClearingObjectPlacement(sign, openScene(), [], [], player).reason)
      .toBe('player-collision');
  });

  it('gives lanterns a deterministic bounded flicker and a static reduced-motion treatment', () => {
    const lantern = createForestClearingObject(FOREST_SEED_POD_LANTERN_TYPE, 100, 100,
      'forest-clearing-v1-seed-pod-lantern-01');
    const samples = [0, 0.2, 0.8, 1.4].map((time) => (
      forestLanternGlowIntensity(lantern, time)
    ));
    expect(new Set(samples).size).toBeGreaterThan(1);
    expect(samples.every((value) => value >= 0.4 && value <= 0.72)).toBeTrue();
    expect(forestLanternGlowIntensity(lantern, 0, false)).toBe(0.56);
    expect(forestLanternGlowIntensity(lantern, 50, false)).toBe(0.56);
  });
});

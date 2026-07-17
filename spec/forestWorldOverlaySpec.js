import {
  applyForestOverlay,
  createEmptyForestOverlay,
  createForestMarker,
  createForestSteppingStone,
  createForestTrailPlacementPreview,
  forestSteppingStoneJoins,
  FOREST_MARKER_ID,
  FOREST_STEPPING_STONE_TYPE,
  FOREST_TRAIL_MAX_STONES,
  FOREST_TREE_TRAIL_CLEARANCE,
  nextForestSteppingStoneId,
  overlayWithForestSteppingStone,
  overlayWithoutForestSteppingStone,
  overlayWithForestMarker,
  sameForestBaseIdentity,
  validateForestObjectPlacement,
  validateForestTrailPlacement,
  validateForestOverlay
} from '../public/js/forest-world-overlay.js';
import {
  forestDepthOrder,
  visibleForestObjects
} from '../public/js/forest-scene-math.js';
import { createForestDevOverlayPersistence } from '../public/js/forest-overlay-persistence.js';
import { createForestExploration } from '../server/services/forestSceneExploration.js';
import { generateForestSceneLayout } from '../server/services/forestSceneLayout.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values
  };
}

function sceneFixture() {
  return createForestExploration(generateForestSceneLayout({
    seed: 'overlay-contract', world: { width: 500, height: 500 }, placementCount: 3
  }));
}

function safeMarker(scene) {
  for (let worldY = 30; worldY < scene.world.height; worldY += 20) {
    for (let worldX = 30; worldX < scene.world.width; worldX += 20) {
      const marker = createForestMarker(worldX, worldY);
      if (validateForestObjectPlacement(marker, scene).valid) return marker;
    }
  }
  throw new Error('The fixture did not contain a valid marker position.');
}

function openTrailScene() {
  const scene = sceneFixture();
  return {
    ...scene,
    world: { width: 500, height: 500 },
    placements: [],
    exploration: { ...scene.exploration,
      spawn: { ...scene.exploration.spawn, worldX: 30, worldY: 30 } }
  };
}

function addStone(overlay, scene, worldX, worldY, id = nextForestSteppingStoneId(overlay)) {
  return overlayWithForestSteppingStone(
    overlay, createForestSteppingStone(worldX, worldY, id), scene
  );
}

describe('Activity Forest personal overlay contract', () => {
  it('keeps generated base identity deterministic and independent of tree asset identity', () => {
    const first = generateForestSceneLayout({ seed: 'identity-proof' });
    const repeated = generateForestSceneLayout({ seed: 'identity-proof' });
    const changed = generateForestSceneLayout({ seed: 'identity-proof-2' });
    const resized = generateForestSceneLayout({
      seed: 'identity-proof', world: { width: 3600, height: 2000 }
    });

    expect(repeated.baseIdentity).toEqual(first.baseIdentity);
    expect(sameForestBaseIdentity(repeated.baseIdentity, first.baseIdentity)).toBeTrue();
    expect(sameForestBaseIdentity(changed.baseIdentity, first.baseIdentity)).toBeFalse();
    expect(sameForestBaseIdentity(resized.baseIdentity, first.baseIdentity)).toBeFalse();
    expect(repeated.placements).toEqual(first.placements);
    expect(repeated.placements.map(({ id, assetKey, worldX, worldY }) => (
      { id, assetKey, worldX, worldY }
    ))).toEqual(first.placements.map(({ id, assetKey, worldX, worldY }) => (
      { id, assetKey, worldX, worldY }
    )));
  });

  it('round trips a bounded overlay without serializing the generated scene', () => {
    const scene = sceneFixture();
    const generatedIdentity = scene.placements.map(({ id, assetKey, worldX, worldY }) => (
      { id, assetKey, worldX, worldY }
    ));
    const overlay = overlayWithForestMarker(
      createEmptyForestOverlay(scene.baseIdentity), safeMarker(scene)
    );
    const roundTrip = JSON.parse(JSON.stringify(overlay));

    expect(validateForestOverlay(roundTrip, scene.baseIdentity).valid).toBeTrue();
    expect(roundTrip).toEqual(overlay);
    expect(JSON.stringify(roundTrip)).not.toContain('placements');
    expect(applyForestOverlay(scene, roundTrip)).toEqual({
      objects: overlay.objects, error: null
    });
    expect(scene.placements.map(({ id, assetKey, worldX, worldY }) => (
      { id, assetKey, worldX, worldY }
    ))).toEqual(generatedIdentity);
  });

  it('retains stable object identity when the representative marker moves', () => {
    const scene = sceneFixture();
    const initial = overlayWithForestMarker(
      createEmptyForestOverlay(scene.baseIdentity), safeMarker(scene)
    );
    const movedMarker = createForestMarker(250, 250);
    const moved = overlayWithForestMarker(initial, movedMarker);

    expect(initial.objects[0].id).toBe(FOREST_MARKER_ID);
    expect(moved.objects[0].id).toBe(initial.objects[0].id);
    expect(moved.revision).toBe(initial.revision + 1);
    expect(moved.objects.length).toBe(1);
  });

  it('validates world bounds, generated tree occupancy, the entrance, and other objects', () => {
    const scene = sceneFixture();
    const tree = scene.placements[0];
    const valid = safeMarker(scene);

    expect(validateForestObjectPlacement(valid, scene)).toEqual({ valid: true, reason: null });
    expect(validateForestObjectPlacement(createForestMarker(2, 2), scene).reason)
      .toBe('world-bounds');
    expect(validateForestObjectPlacement(
      createForestMarker(tree.worldX, tree.worldY), scene
    ).reason).toBe('tree-collision');
    expect(validateForestObjectPlacement(createForestMarker(
      scene.exploration.spawn.worldX, scene.exploration.spawn.worldY
    ), scene).reason).toBe('entrance-collision');
    expect(validateForestObjectPlacement(
      createForestMarker(valid.worldX + 1, valid.worldY + 1, 'forest-marker-v1-second'),
      scene,
      [valid]
    ).reason).toBe('object-collision');
  });

  it('rejects unknown fields, malformed objects, duplicate ids, and unsupported versions', () => {
    const scene = sceneFixture();
    const valid = overlayWithForestMarker(
      createEmptyForestOverlay(scene.baseIdentity), safeMarker(scene)
    );

    expect(validateForestOverlay({ ...valid, extra: true }, scene.baseIdentity).reason)
      .toBe('invalid-shape');
    expect(validateForestOverlay({ ...valid, schemaVersion: 2 }, scene.baseIdentity).reason)
      .toBe('unsupported-version');
    expect(validateForestOverlay({ ...valid, objects: [{ ...valid.objects[0], label: 'free text' }] },
      scene.baseIdentity).reason).toBe('invalid-objects');
    expect(validateForestOverlay({ ...valid, objects: [valid.objects[0], valid.objects[0]] },
      scene.baseIdentity).reason).toBe('duplicate-object-id');
  });

  it('saves independently, reloads after base regeneration, and resets explicitly', () => {
    const storage = memoryStorage();
    const persistence = createForestDevOverlayPersistence(storage);
    const scene = sceneFixture();
    const overlay = overlayWithForestMarker(
      createEmptyForestOverlay(scene.baseIdentity), safeMarker(scene)
    );

    persistence.save(overlay);
    const regenerated = sceneFixture();
    const loaded = persistence.load(regenerated.baseIdentity);

    expect(loaded.status).toBe('loaded');
    expect(applyForestOverlay(regenerated, loaded.overlay).objects).toEqual(overlay.objects);
    expect(regenerated.placements).toEqual(scene.placements);
    expect(persistence.reset(scene.baseIdentity).objects).toEqual([]);
    expect(persistence.load(scene.baseIdentity).status).toBe('empty');
  });

  it('recovers to an empty overlay without overwriting invalid or incompatible data', () => {
    const scene = sceneFixture();
    const storage = memoryStorage();
    const persistence = createForestDevOverlayPersistence(storage);
    const key = `daily-page:activity-forest:overlay:${scene.baseIdentity.sceneVersion}:${
      scene.baseIdentity.layoutKey}:${scene.baseIdentity.seed}`;

    storage.setItem(key, '{bad json');
    const invalid = persistence.load(scene.baseIdentity);
    expect(invalid.status).toBe('recovered');
    expect(invalid.overlay.objects).toEqual([]);
    expect(storage.getItem(key)).toBe('{bad json');

    const incompatible = createEmptyForestOverlay({ ...scene.baseIdentity, seed: 'other-base' });
    storage.setItem(key, JSON.stringify(incompatible));
    expect(persistence.load(scene.baseIdentity)).toEqual(jasmine.objectContaining({
      status: 'recovered', error: 'incompatible-base'
    }));
    expect(storage.getItem(key)).toBe(JSON.stringify(incompatible));
  });

  it('round trips an explicit bounded stepping-stone schema and rejects malformed bounds', () => {
    const scene = openTrailScene();
    const stone = createForestSteppingStone(150.4, 159.6, 'forest-stone-v1-01');
    const placed = addStone(createEmptyForestOverlay(scene.baseIdentity), scene, 150, 160);
    const roundTrip = JSON.parse(JSON.stringify(placed.overlay));

    expect(stone).toEqual({ schemaVersion: 1, id: 'forest-stone-v1-01',
      type: FOREST_STEPPING_STONE_TYPE, worldX: 150, worldY: 160 });
    expect(validateForestOverlay(roundTrip, scene.baseIdentity).valid).toBeTrue();
    expect(roundTrip).toEqual(placed.overlay);
    expect(() => createForestSteppingStone(1, 1, 'stone')).toThrow();
    expect(validateForestOverlay({ ...roundTrip,
      objects: [{ ...stone, worldX: 100001 }] }, scene.baseIdentity).reason)
      .toBe('invalid-objects');

    let bounded = createEmptyForestOverlay(scene.baseIdentity);
    for (let index = 0; index < FOREST_TRAIL_MAX_STONES; index += 1) {
      bounded = addStone(bounded, scene, 120 + (index * 30), 220).overlay;
    }
    expect(nextForestSteppingStoneId(bounded)).toBeNull();
    expect(addStone(bounded, scene, 480, 220, 'forest-stone-v1-extra').reason)
      .toBe('stone-limit');
  });

  it('preserves stable identity across deterministic moves and orders objects by identity', () => {
    const scene = openTrailScene();
    const empty = createEmptyForestOverlay(scene.baseIdentity);
    const first = addStone(empty, scene, 150, 150);
    const second = addStone(first.overlay, scene, 200, 150);
    const moved = addStone(second.overlay, scene, 145, 160, first.overlay.objects[0].id);

    expect(first.valid).toBeTrue();
    expect(second.valid).toBeTrue();
    expect(moved.valid).toBeTrue();
    expect(moved.overlay.objects.map(({ id }) => id)).toEqual([
      'forest-stone-v1-01', 'forest-stone-v1-02'
    ]);
    expect(moved.overlay.objects[0].id).toBe(first.overlay.objects[0].id);
    expect(moved.overlay.revision).toBe(second.overlay.revision + 1);
  });

  it('returns legible deterministic preview reasons for every protected placement space', () => {
    const scene = sceneFixture();
    const tree = { ...scene.placements[0], worldX: 250, worldY: 250, collisionRadius: 20 };
    const isolatedScene = {
      ...scene,
      placements: [tree],
      exploration: { ...scene.exploration,
        spawn: { ...scene.exploration.spawn, worldX: 30, worldY: 30 } }
    };
    const first = createForestSteppingStone(2, 2, 'forest-stone-v1-01');
    const entrance = createForestSteppingStone(scene.exploration.spawn.worldX,
      scene.exploration.spawn.worldY, 'forest-stone-v1-01');
    const treeCenter = createForestSteppingStone(tree.worldX, tree.worldY,
      'forest-stone-v1-01');
    const treeApproach = createForestSteppingStone(
      tree.worldX + tree.collisionRadius + 11 + FOREST_TREE_TRAIL_CLEARANCE - 1,
      tree.worldY, 'forest-stone-v1-01'
    );
    const openPassage = createForestSteppingStone(
      tree.worldX + tree.collisionRadius + 11 + FOREST_TREE_TRAIL_CLEARANCE,
      tree.worldY, 'forest-stone-v1-01'
    );

    expect(validateForestTrailPlacement(first, scene).reason).toBe('world-bounds');
    expect(validateForestTrailPlacement(entrance, scene).reason).toBe('entrance-collision');
    expect(validateForestTrailPlacement(treeCenter, isolatedScene).reason).toBe('tree-collision');
    expect(validateForestTrailPlacement(treeApproach, isolatedScene).reason)
      .toBe('tree-interaction-space');
    expect(validateForestTrailPlacement(openPassage, isolatedScene))
      .toEqual({ valid: true, reason: null });
    expect(validateForestTrailPlacement(treeApproach, isolatedScene))
      .toEqual(validateForestTrailPlacement(treeApproach, isolatedScene));
    expect(createForestTrailPlacementPreview(
      treeApproach.worldX, treeApproach.worldY, treeApproach.id, isolatedScene
    )).toEqual({ stone: treeApproach, valid: false, reason: 'tree-interaction-space' });
  });

  it('validates overlay collisions and the narrow stone spacing and continuity rules', () => {
    const scene = openTrailScene();
    const marker = createForestMarker(150, 150, 'forest-marker-v1-near-trail');
    const first = createForestSteppingStone(150, 150, 'forest-stone-v1-01');
    const close = createForestSteppingStone(170, 150, 'forest-stone-v1-02');
    const connected = createForestSteppingStone(190, 150, 'forest-stone-v1-02');
    const gap = createForestSteppingStone(300, 150, 'forest-stone-v1-02');

    expect(validateForestTrailPlacement(first, scene, [marker]).reason)
      .toBe('object-collision');
    expect(validateForestTrailPlacement(close, scene, [first]).reason).toBe('stone-too-close');
    expect(validateForestTrailPlacement(connected, scene, [first])).toEqual({
      valid: true, reason: null
    });
    expect(validateForestTrailPlacement(gap, scene, [first]).reason).toBe('trail-gap');
  });

  it('places, moves, removes, resets, and regenerates without partial or generated-state edits', () => {
    const scene = openTrailScene();
    const generated = JSON.parse(JSON.stringify(scene.placements));
    const storage = memoryStorage();
    const persistence = createForestDevOverlayPersistence(storage);
    const first = addStone(createEmptyForestOverlay(scene.baseIdentity), scene, 150, 150);
    const second = addStone(first.overlay, scene, 200, 150);
    const third = addStone(second.overlay, scene, 250, 150);
    const rejectedMiddleRemoval = overlayWithoutForestSteppingStone(
      third.overlay, 'forest-stone-v1-02'
    );
    const moved = addStone(third.overlay, scene, 250, 180, 'forest-stone-v1-03');
    const removed = overlayWithoutForestSteppingStone(moved.overlay, 'forest-stone-v1-03');

    expect(rejectedMiddleRemoval.valid).toBeFalse();
    expect(rejectedMiddleRemoval.reason).toBe('trail-disconnected');
    expect(rejectedMiddleRemoval.overlay).toBe(third.overlay);
    expect(moved.valid).toBeTrue();
    expect(removed.valid).toBeTrue();
    persistence.save(removed.overlay);
    const regenerated = openTrailScene();
    expect(applyForestOverlay(regenerated,
      persistence.load(regenerated.baseIdentity).overlay).objects).toEqual(removed.overlay.objects);
    expect(scene.placements).toEqual(generated);
    expect(persistence.reset(scene.baseIdentity).objects).toEqual([]);
  });

  it('recovers unsupported trail data and keeps overlay/base/marker compatibility intact', () => {
    const scene = openTrailScene();
    const marker = createForestMarker(400, 400);
    const withMarker = overlayWithForestMarker(createEmptyForestOverlay(scene.baseIdentity), marker);
    const withStone = addStone(withMarker, scene, 150, 150).overlay;
    const storage = memoryStorage();
    const persistence = createForestDevOverlayPersistence(storage);
    persistence.save(withStone);

    expect(withStone.objects.find(({ type }) => type === 'marker')).toEqual(marker);
    expect(applyForestOverlay(scene, withStone).error).toBeNull();
    const invalid = { ...withStone, objects: withStone.objects.map((object) => (
      object.type === FOREST_STEPPING_STONE_TYPE ? { ...object, schemaVersion: 2 } : object
    )) };
    expect(validateForestOverlay(invalid, scene.baseIdentity).reason).toBe('invalid-objects');
    const unsupported = { ...withStone, schemaVersion: 2 };
    expect(validateForestOverlay(unsupported, scene.baseIdentity).reason)
      .toBe('unsupported-version');
  });

  it('culls stones by their bounded footprint and uses stable ground-Y depth ordering and joins', () => {
    const stones = [
      createForestSteppingStone(50, 60, 'forest-stone-v1-02'),
      createForestSteppingStone(50, 60, 'forest-stone-v1-01'),
      createForestSteppingStone(100, 60, 'forest-stone-v1-03')
    ];
    const visible = visibleForestObjects(stones, { x: 55, y: 55, width: 40, height: 20 }, 0);
    const order = forestDepthOrder([], { worldX: 0, worldY: 60 }, visible);

    expect(visible.map(({ id }) => id)).toEqual([
      'forest-stone-v1-01', 'forest-stone-v1-02', 'forest-stone-v1-03'
    ]);
    expect(order.map(({ id }) => id)).toEqual([
      'forest-stone-v1-01', 'forest-stone-v1-02', 'forest-stone-v1-03', '~player'
    ]);
    expect(forestSteppingStoneJoins(stones)).toEqual([
      { fromId: 'forest-stone-v1-01', toId: 'forest-stone-v1-02' },
      { fromId: 'forest-stone-v1-01', toId: 'forest-stone-v1-03' }
    ]);
  });
});

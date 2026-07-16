import {
  applyForestOverlay,
  createEmptyForestOverlay,
  createForestMarker,
  FOREST_MARKER_ID,
  overlayWithForestMarker,
  sameForestBaseIdentity,
  validateForestObjectPlacement,
  validateForestOverlay
} from '../public/js/forest-world-overlay.js';
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
});

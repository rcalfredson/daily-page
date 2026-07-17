import {
  availableForestDiscoveries,
  createEmptyForestDiscoveryState,
  FOREST_DISCOVERY_MATERIALS,
  FOREST_DISCOVERY_MAX_INVENTORY_COUNT,
  FOREST_DISCOVERY_OFFERING_COUNT,
  FOREST_DISCOVERY_PICKUP_RADIUS,
  FOREST_DISCOVERY_TYPE,
  forestDiscoveryStateAfterPickup,
  generateForestDiscoveries,
  isForestDiscovery,
  isForestDiscoveryMaterial,
  renewForestDiscoveryState,
  validateForestDiscoveryPlacement,
  validateForestDiscoveryState
} from '../public/js/forest-discoveries.js';
import {
  createForestDevDiscoveryPersistence,
  FOREST_DEV_DISCOVERY_STORAGE_PREFIX
} from '../public/js/forest-discovery-persistence.js';
import {
  createEmptyForestOverlay,
  createForestMarker,
  createForestSteppingStone,
  overlayWithForestMarker,
  overlayWithForestSteppingStone
} from '../public/js/forest-world-overlay.js';
import { createForestDevOverlayPersistence } from '../public/js/forest-overlay-persistence.js';
import {
  focusedForestSceneItem,
  forestDepthOrder,
  visibleForestObjects
} from '../public/js/forest-scene-math.js';
import { createForestExploration } from '../server/services/forestSceneExploration.js';
import { generateForestSceneLayout } from '../server/services/forestSceneLayout.js';

function sceneFixture(options = {}) {
  return createForestExploration(generateForestSceneLayout({
    seed: 'discovery-contract', ...options
  }));
}

function memoryStorage(initial = {}, failure = null) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => {
      if (failure === 'get') throw new Error('read unavailable');
      return values.has(key) ? values.get(key) : null;
    },
    setItem: (key, value) => {
      if (failure === 'set') throw new Error('write unavailable');
      values.set(key, value);
    },
    removeItem: (key) => {
      if (failure === 'remove') throw new Error('remove unavailable');
      values.delete(key);
    },
    values
  };
}

function collectedOffering(state, offering) {
  return offering.reduce((current, discovery) => (
    forestDiscoveryStateAfterPickup(current, discovery, offering).state
  ), state);
}

describe('Activity Forest discoveries and tiny inventory', () => {
  it('uses exactly three calm material types and rejects unknown vocabulary', () => {
    expect(FOREST_DISCOVERY_MATERIALS.map(({ id }) => id)).toEqual([
      'fallen-twigs', 'smooth-stones', 'seed-pods'
    ]);
    FOREST_DISCOVERY_MATERIALS.forEach(({ id }) => {
      expect(isForestDiscoveryMaterial(id)).toBeTrue();
    });
    expect(isForestDiscoveryMaterial('rare-gem')).toBeFalse();
  });

  it('generates an exact bounded schema with stable identities, types, and positions', () => {
    const scene = sceneFixture();
    const first = generateForestDiscoveries(scene);
    const repeated = generateForestDiscoveries(scene);

    expect(first.length).toBe(FOREST_DISCOVERY_OFFERING_COUNT);
    expect(repeated).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
    first.forEach((discovery) => {
      expect(isForestDiscovery(discovery)).toBeTrue();
      expect(Object.keys(discovery).sort()).toEqual([
        'cycle', 'id', 'material', 'schemaVersion', 'type', 'worldX', 'worldY'
      ]);
    });
    expect(first.filter(({ material }) => material === 'fallen-twigs').length).toBe(3);
    expect(first.filter(({ material }) => material === 'smooth-stones').length).toBe(3);
    expect(first.filter(({ material }) => material === 'seed-pods').length).toBe(3);
  });

  it('makes cycle changes explicit without altering trees or tree asset identity', () => {
    const scene = sceneFixture();
    const generatedIdentity = scene.placements.map(({ id, assetKey, worldX, worldY }) => ({
      id, assetKey, worldX, worldY
    }));
    const first = generateForestDiscoveries(scene, 0);
    const next = generateForestDiscoveries(scene, 1);

    expect(next.map(({ id }) => id)).not.toEqual(first.map(({ id }) => id));
    expect(next.map(({ worldX, worldY }) => ({ worldX, worldY })))
      .not.toEqual(first.map(({ worldX, worldY }) => ({ worldX, worldY })));
    expect(scene.placements.map(({ id, assetKey, worldX, worldY }) => ({
      id, assetKey, worldX, worldY
    }))).toEqual(generatedIdentity);
  });

  it('respects world, tree, entrance, overlay, and discovery spacing constraints', () => {
    const scene = sceneFixture();
    const discoveries = generateForestDiscoveries(scene);
    discoveries.forEach((discovery, index) => {
      expect(validateForestDiscoveryPlacement(
        discovery, scene, discoveries.slice(0, index)
      )).toEqual({ valid: true, reason: null });
    });
    const discovery = discoveries[0];
    const atTree = { ...discovery, worldX: scene.placements[0].worldX,
      worldY: scene.placements[0].worldY };
    const atEntrance = { ...discovery, worldX: scene.exploration.spawn.worldX,
      worldY: scene.exploration.spawn.worldY };
    const atEdge = { ...discovery, worldX: 1, worldY: 1 };
    const stone = createForestSteppingStone(
      discovery.worldX, discovery.worldY, 'forest-stone-v1-01'
    );

    expect(validateForestDiscoveryPlacement(atTree, scene).reason)
      .toBe('tree-interaction-space');
    expect(validateForestDiscoveryPlacement(atEntrance, scene).reason)
      .toBe('protected-entrance');
    expect(validateForestDiscoveryPlacement(atEdge, scene).reason).toBe('world-bounds');
    expect(validateForestDiscoveryPlacement(discovery, scene, [], [stone]).reason)
      .toBe('overlay-collision');
    expect(validateForestDiscoveryPlacement(discovery, scene, [discovery]).reason)
      .toBe('discovery-spacing');
  });

  it('uses overlay positions as stable generation inputs without changing overlay identities', () => {
    const scene = sceneFixture();
    const first = generateForestDiscoveries(scene);
    const marker = createForestMarker(first[0].worldX, first[0].worldY);
    const overlay = overlayWithForestMarker(createEmptyForestOverlay(scene.baseIdentity), marker);
    const movedAroundOverlay = generateForestDiscoveries(scene, 0, overlay.objects);

    expect(movedAroundOverlay[0].id).toBe(first[0].id);
    expect(movedAroundOverlay[0]).not.toEqual(first[0]);
    expect(overlay.objects[0].id).toBe(marker.id);
  });

  it('keeps representative and large-world offerings equally small and reachable near entrance', () => {
    const representative = sceneFixture();
    const large = sceneFixture({
      world: { width: 6000, height: 3600 }, placementCount: 600, assetPoolSize: 60
    });
    for (const scene of [representative, large]) {
      const discoveries = generateForestDiscoveries(scene);
      expect(discoveries.length).toBe(FOREST_DISCOVERY_OFFERING_COUNT);
      discoveries.forEach(({ worldY }) => {
        expect(worldY).toBeLessThan(scene.exploration.spawn.worldY - 100);
        expect(worldY).toBeGreaterThanOrEqual(scene.exploration.spawn.worldY - 1180);
      });
    }
  });

  it('validates exact inventory state, safe bounds, ids, and JSON round trips', () => {
    const scene = sceneFixture();
    const state = createEmptyForestDiscoveryState(scene.baseIdentity);
    const roundTrip = JSON.parse(JSON.stringify(state));

    expect(roundTrip).toEqual(state);
    expect(validateForestDiscoveryState(roundTrip, scene.baseIdentity).valid).toBeTrue();
    expect(validateForestDiscoveryState({ ...state, extra: true }, scene.baseIdentity).reason)
      .toBe('invalid-shape');
    expect(validateForestDiscoveryState({ ...state, schemaVersion: 2 }, scene.baseIdentity).reason)
      .toBe('unsupported-version');
    expect(validateForestDiscoveryState({ ...state,
      inventory: { ...state.inventory, 'fallen-twigs': -1 } }, scene.baseIdentity).reason)
      .toBe('invalid-inventory');
    expect(validateForestDiscoveryState({ ...state,
      inventory: { ...state.inventory, mystery: 1 } }, scene.baseIdentity).reason)
      .toBe('invalid-inventory');
  });

  it('selects nearby discoveries deterministically by distance then identity', () => {
    const scene = sceneFixture();
    const [first, second] = generateForestDiscoveries(scene).map((discovery) => ({
      ...discovery, worldX: 100, worldY: 100
    })).sort((left, right) => left.id.localeCompare(right.id));
    const player = { worldX: 100, worldY: 100 };
    const focused = focusedForestSceneItem(player, [], [], 70, [second, first]);

    expect(focused.kind).toBe(FOREST_DISCOVERY_TYPE);
    expect(focused.id).toBe(first.id);
    expect(focused.distance).toBe(0);
    expect(FOREST_DISCOVERY_PICKUP_RADIUS).toBe(34);
  });

  it('picks up exactly once and increments exactly one bounded count', () => {
    const scene = sceneFixture();
    const offering = generateForestDiscoveries(scene);
    const state = createEmptyForestDiscoveryState(scene.baseIdentity);
    const first = forestDiscoveryStateAfterPickup(state, offering[0], offering);
    const repeated = forestDiscoveryStateAfterPickup(first.state, offering[0], offering);

    expect(first.valid).toBeTrue();
    expect(first.state.revision).toBe(1);
    expect(first.state.inventory[offering[0].material]).toBe(1);
    expect(first.state.collectedDiscoveryIds).toEqual([offering[0].id]);
    expect(repeated.valid).toBeFalse();
    expect(repeated.reason).toBe('already-collected');
    expect(repeated.state).toBe(first.state);

    const full = { ...state, inventory: {
      ...state.inventory, [offering[0].material]: FOREST_DISCOVERY_MAX_INVENTORY_COUNT
    } };
    expect(forestDiscoveryStateAfterPickup(full, offering[0], offering).reason)
      .toBe('inventory-limit');
  });

  it('renews only completed offerings without time and never consumes inventory', () => {
    const scene = sceneFixture();
    const offering = generateForestDiscoveries(scene);
    const empty = createEmptyForestDiscoveryState(scene.baseIdentity);
    const incomplete = renewForestDiscoveryState(empty, offering);
    const complete = collectedOffering(empty, offering);
    const renewed = renewForestDiscoveryState(complete, offering);

    expect(incomplete.reason).toBe('offering-incomplete');
    expect(renewed.valid).toBeTrue();
    expect(renewed.state.cycle).toBe(1);
    expect(renewed.state.collectedDiscoveryIds).toEqual([]);
    expect(renewed.state.inventory).toEqual(complete.inventory);
    expect(generateForestDiscoveries(scene, renewed.state.cycle)).not.toEqual(offering);
  });

  it('persists inventory and progress independently of the generated manifest', () => {
    const scene = sceneFixture();
    const offering = generateForestDiscoveries(scene);
    const state = forestDiscoveryStateAfterPickup(
      createEmptyForestDiscoveryState(scene.baseIdentity), offering[0], offering
    ).state;
    const storage = memoryStorage();
    const persistence = createForestDevDiscoveryPersistence(storage);

    persistence.save(state);
    const loaded = persistence.load(scene.baseIdentity);
    expect(loaded).toEqual({ state, status: 'loaded', error: null });
    expect(JSON.stringify(loaded.state)).not.toContain('worldX');
    expect(availableForestDiscoveries(
      generateForestDiscoveries(scene, loaded.state.cycle), loaded.state
    ).length).toBe(FOREST_DISCOVERY_OFFERING_COUNT - 1);
  });

  it('uses a separate key and leaves existing marker-and-trail overlay records unchanged', () => {
    const scene = sceneFixture();
    const openScene = {
      ...scene,
      placements: [],
      exploration: { ...scene.exploration,
        spawn: { ...scene.exploration.spawn, worldX: 30, worldY: 30 } }
    };
    const markerOverlay = overlayWithForestMarker(
      createEmptyForestOverlay(scene.baseIdentity), createForestMarker(400, 400)
    );
    const trailOverlay = overlayWithForestSteppingStone(
      markerOverlay, createForestSteppingStone(150, 150, 'forest-stone-v1-01'), openScene
    ).overlay;
    const storage = memoryStorage();
    const overlayPersistence = createForestDevOverlayPersistence(storage);
    const discoveryPersistence = createForestDevDiscoveryPersistence(storage);
    const offering = generateForestDiscoveries(scene);
    const state = forestDiscoveryStateAfterPickup(
      createEmptyForestDiscoveryState(scene.baseIdentity), offering[0], offering
    ).state;

    overlayPersistence.save(trailOverlay);
    discoveryPersistence.save(state);

    expect(overlayPersistence.load(scene.baseIdentity).overlay).toEqual(trailOverlay);
    expect(discoveryPersistence.load(scene.baseIdentity).state).toEqual(state);
    expect(storage.values.size).toBe(2);
  });

  it('keeps a failed save atomic because the candidate is not live state', () => {
    const scene = sceneFixture();
    const offering = generateForestDiscoveries(scene);
    const live = createEmptyForestDiscoveryState(scene.baseIdentity);
    const candidate = forestDiscoveryStateAfterPickup(live, offering[0], offering);
    const persistence = createForestDevDiscoveryPersistence(memoryStorage({}, 'set'));

    expect(() => persistence.save(candidate.state)).toThrowError('write unavailable');
    expect(live.inventory[offering[0].material]).toBe(0);
    expect(live.collectedDiscoveryIds).toEqual([]);
    expect(availableForestDiscoveries(offering, live)).toEqual(offering);
  });

  it('recovers visibly from invalid JSON and malformed or incompatible state', () => {
    const scene = sceneFixture();
    const key = `${FOREST_DEV_DISCOVERY_STORAGE_PREFIX}${scene.baseIdentity.sceneVersion}:${
      scene.baseIdentity.layoutKey}:${scene.baseIdentity.seed}`;
    const storage = memoryStorage({ [key]: '{bad json' });
    const persistence = createForestDevDiscoveryPersistence(storage);
    expect(persistence.load(scene.baseIdentity).status).toBe('recovered');
    expect(storage.getItem(key)).toBe('{bad json');

    const state = createEmptyForestDiscoveryState(scene.baseIdentity);
    const malformed = { ...state, collectedDiscoveryIds: ['forest-discovery-v1-bad'] };
    storage.setItem(key, JSON.stringify(malformed));
    expect(persistence.load(scene.baseIdentity).error).toBe('invalid-collected-discoveries');

    const incompatible = createEmptyForestDiscoveryState({
      ...scene.baseIdentity, seed: 'another-base'
    });
    storage.setItem(key, JSON.stringify(incompatible));
    expect(persistence.load(scene.baseIdentity).error).toBe('incompatible-base');

    storage.setItem(key, JSON.stringify({ ...state, schemaVersion: 2 }));
    expect(persistence.load(scene.baseIdentity).error).toBe('unsupported-version');
    storage.setItem(key, JSON.stringify({ ...state,
      inventory: { ...state.inventory, 'smooth-stones': -3 } }));
    expect(persistence.load(scene.baseIdentity).error).toBe('invalid-inventory');
    storage.setItem(key, JSON.stringify({ ...state,
      inventory: { ...state.inventory, unknown: 1 } }));
    expect(persistence.load(scene.baseIdentity).error).toBe('invalid-inventory');
  });

  it('rejects duplicate and wrong-cycle collection identities', () => {
    const scene = sceneFixture();
    const offering = generateForestDiscoveries(scene);
    const state = createEmptyForestDiscoveryState(scene.baseIdentity);
    const duplicate = { ...state,
      collectedDiscoveryIds: [offering[0].id, offering[0].id] };
    const wrongCycle = { ...state, collectedDiscoveryIds: [
      offering[0].id.replace('-0-01', '-1-01')
    ] };

    expect(validateForestDiscoveryState(duplicate, scene.baseIdentity).reason)
      .toBe('duplicate-collected-discovery-id');
    expect(validateForestDiscoveryState(wrongCycle, scene.baseIdentity).reason)
      .toBe('incompatible-collected-discovery');
  });

  it('resets explicitly without touching a marker-and-trail overlay', () => {
    const scene = sceneFixture();
    const overlay = {
      ...createEmptyForestOverlay(scene.baseIdentity),
      objects: [createForestSteppingStone(50, 50, 'forest-stone-v1-01')]
    };
    const storage = memoryStorage();
    const persistence = createForestDevDiscoveryPersistence(storage);
    const offering = generateForestDiscoveries(scene);
    persistence.save(forestDiscoveryStateAfterPickup(
      createEmptyForestDiscoveryState(scene.baseIdentity), offering[0], offering
    ).state);

    const reset = persistence.reset(scene.baseIdentity);
    expect(reset.inventory).toEqual({ 'fallen-twigs': 0, 'smooth-stones': 0, 'seed-pods': 0 });
    expect(reset.collectedDiscoveryIds).toEqual([]);
    expect(overlay.objects[0].id).toBe('forest-stone-v1-01');
  });

  it('culls discoveries by fixed bounds and gives them stable ground-Y depth order', () => {
    const scene = sceneFixture();
    const discoveries = generateForestDiscoveries(scene).slice(0, 2).map((discovery) => ({
      ...discovery, worldX: 50, worldY: 60
    })).sort((left, right) => left.id.localeCompare(right.id));
    const visible = visibleForestObjects(
      [...discoveries].reverse(), { x: 40, y: 50, width: 20, height: 20 }, 0
    );
    const ordered = forestDepthOrder([], { worldX: 50, worldY: 60 }, visible);

    expect(visible.map(({ id }) => id)).toEqual(discoveries.map(({ id }) => id));
    expect(ordered.map(({ id }) => id)).toEqual([
      discoveries[0].id, discoveries[1].id, '~player'
    ]);
  });
});

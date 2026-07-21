import { forestEnvironmentAt } from './forest-environment.js';

export const FOREST_OVERLAY_SCHEMA_VERSION = 1;
export const FOREST_PLACED_OBJECT_SCHEMA_VERSION = 1;
export const FOREST_MARKER_ID = 'forest-marker-v1-personal-clearing';
export const FOREST_MARKER_TYPE = 'marker';
export const FOREST_STEPPING_STONE_TYPE = 'stepping-stone';
export const FOREST_TRAIL_SIGN_TYPE = 'trail-sign';
export const FOREST_STONE_BENCH_TYPE = 'stone-bench';
export const FOREST_SEED_POD_LANTERN_TYPE = 'seed-pod-lantern';
export const FOREST_MARKER_COLLISION_RADIUS = 9;
export const FOREST_MARKER_INTERACTION_RADIUS = 54;
export const FOREST_OVERLAY_MAX_OBJECTS = 32;
export const FOREST_TRAIL_MAX_STONES = 12;
export const FOREST_STONE_COLLISION_RADIUS = 11;
export const FOREST_STONE_MINIMUM_SPACING = 26;
export const FOREST_STONE_MAXIMUM_SPACING = 96;
export const FOREST_ENTRANCE_PROTECTION_RADIUS = 52;
export const FOREST_TREE_TRAIL_CLEARANCE = 14;
export const FOREST_CLEARING_OBJECT_MINIMUM_SPACING = 8;
export const FOREST_CLEARING_TREE_CLEARANCE = 8;

const OVERLAY_ID_PATTERN = /^forest-overlay-v1-[a-z0-9-]{1,48}$/;
const MARKER_ID_PATTERN = /^forest-marker-v1-[a-z0-9-]{1,48}$/;
const STONE_ID_PATTERN = /^forest-stone-v1-[a-z0-9-]{1,48}$/;
const CLEARING_ID_PATTERN = /^forest-clearing-v1-(trail-sign|stone-bench|seed-pod-lantern)-[0-9]{2}$/;

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function validCoordinate(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100000;
}

export function isForestBaseIdentity(value) {
  return exactKeys(value, ['schemaVersion', 'sceneVersion', 'seed', 'layoutKey'])
    && value.schemaVersion === 1
    && Number.isSafeInteger(value.sceneVersion) && value.sceneVersion > 0
    && typeof value.seed === 'string' && value.seed.length > 0 && value.seed.length <= 80
    && typeof value.layoutKey === 'string' && /^[a-f0-9]{8}$/.test(value.layoutKey);
}

export function sameForestBaseIdentity(left, right) {
  return isForestBaseIdentity(left) && isForestBaseIdentity(right)
    && left.schemaVersion === right.schemaVersion
    && left.sceneVersion === right.sceneVersion
    && left.seed === right.seed && left.layoutKey === right.layoutKey;
}

export function isForestPlacedObject(value) {
  const basicKeys = ['schemaVersion', 'id', 'type', 'worldX', 'worldY'];
  const sign = value?.type === FOREST_TRAIL_SIGN_TYPE;
  return exactKeys(value, sign ? [...basicKeys, 'text'] : basicKeys)
    && value.schemaVersion === FOREST_PLACED_OBJECT_SCHEMA_VERSION
    && typeof value.id === 'string'
    && ((value.type === FOREST_MARKER_TYPE && MARKER_ID_PATTERN.test(value.id))
      || (value.type === FOREST_STEPPING_STONE_TYPE && STONE_ID_PATTERN.test(value.id))
      || ([FOREST_TRAIL_SIGN_TYPE, FOREST_STONE_BENCH_TYPE,
        FOREST_SEED_POD_LANTERN_TYPE].includes(value.type) && CLEARING_ID_PATTERN.test(value.id)
        && value.id.startsWith(`forest-clearing-v1-${value.type}-`)))
    && validCoordinate(value.worldX) && validCoordinate(value.worldY)
    && (!sign || (typeof value.text === 'string' && value.text === value.text.normalize('NFC')
      && value.text === value.text.trim() && !/[\n\r]/.test(value.text)
      && !/\p{Cc}/u.test(value.text) && [...value.text].length <= 60));
}

export function createForestMarker(worldX, worldY, id = FOREST_MARKER_ID) {
  return {
    schemaVersion: FOREST_PLACED_OBJECT_SCHEMA_VERSION,
    id,
    type: FOREST_MARKER_TYPE,
    worldX: Math.round(worldX),
    worldY: Math.round(worldY)
  };
}

export function createForestSteppingStone(worldX, worldY, id) {
  if (typeof id !== 'string' || !STONE_ID_PATTERN.test(id)) {
    throw new Error('A versioned stepping-stone identity is required.');
  }
  return {
    schemaVersion: FOREST_PLACED_OBJECT_SCHEMA_VERSION,
    id,
    type: FOREST_STEPPING_STONE_TYPE,
    worldX: Math.round(worldX),
    worldY: Math.round(worldY)
  };
}

export function nextForestSteppingStoneId(overlay) {
  const used = new Set(overlay.objects.map(({ id }) => id));
  for (let ordinal = 1; ordinal <= FOREST_TRAIL_MAX_STONES; ordinal += 1) {
    const id = `forest-stone-v1-${String(ordinal).padStart(2, '0')}`;
    if (!used.has(id)) return id;
  }
  return null;
}

export function createEmptyForestOverlay(baseIdentity) {
  if (!isForestBaseIdentity(baseIdentity)) throw new Error('A valid forest base identity is required.');
  return {
    schemaVersion: FOREST_OVERLAY_SCHEMA_VERSION,
    id: 'forest-overlay-v1-local-personal',
    baseIdentity: { ...baseIdentity },
    revision: 0,
    objects: []
  };
}

export function validateForestOverlay(value, expectedBaseIdentity) {
  if (!exactKeys(value, [
    'schemaVersion', 'id', 'baseIdentity', 'revision', 'objects'
  ])) return { valid: false, reason: 'invalid-shape' };
  if (value.schemaVersion !== FOREST_OVERLAY_SCHEMA_VERSION) {
    return { valid: false, reason: 'unsupported-version' };
  }
  if (typeof value.id !== 'string' || !OVERLAY_ID_PATTERN.test(value.id)) {
    return { valid: false, reason: 'invalid-id' };
  }
  if (!isForestBaseIdentity(value.baseIdentity)) {
    return { valid: false, reason: 'invalid-base-identity' };
  }
  if (expectedBaseIdentity && !sameForestBaseIdentity(value.baseIdentity, expectedBaseIdentity)) {
    return { valid: false, reason: 'incompatible-base' };
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
    return { valid: false, reason: 'invalid-revision' };
  }
  if (!Array.isArray(value.objects) || value.objects.length > FOREST_OVERLAY_MAX_OBJECTS
    || !value.objects.every(isForestPlacedObject)) {
    return { valid: false, reason: 'invalid-objects' };
  }
  if (new Set(value.objects.map(({ id }) => id)).size !== value.objects.length) {
    return { valid: false, reason: 'duplicate-object-id' };
  }
  if (value.objects.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE).length
    > FOREST_TRAIL_MAX_STONES) return { valid: false, reason: 'too-many-stones' };
  const clearingObjects = value.objects.filter(({ type }) => [FOREST_TRAIL_SIGN_TYPE,
    FOREST_STONE_BENCH_TYPE, FOREST_SEED_POD_LANTERN_TYPE].includes(type));
  if (clearingObjects.length > 9) return { valid: false, reason: 'too-many-clearing-objects' };
  if ([FOREST_TRAIL_SIGN_TYPE, FOREST_STONE_BENCH_TYPE,
    FOREST_SEED_POD_LANTERN_TYPE].some((type) => (
    clearingObjects.filter((object) => object.type === type).length > 3
  ))) return { valid: false, reason: 'too-many-clearing-objects-of-type' };
  return { valid: true, reason: null };
}

export function overlayWithForestMarker(overlay, marker) {
  const validation = validateForestOverlay(overlay, overlay?.baseIdentity);
  if (!validation.valid || !isForestPlacedObject(marker)) {
    throw new Error('A valid overlay and marker are required.');
  }
  return {
    ...overlay,
    revision: overlay.revision + 1,
    objects: [...overlay.objects.filter(({ type }) => type !== FOREST_MARKER_TYPE), { ...marker }]
      .sort((left, right) => left.id.localeCompare(right.id))
  };
}


function objectRadius(object) {
  if (object.type === FOREST_STEPPING_STONE_TYPE) return FOREST_STONE_COLLISION_RADIUS;
  if (object.type === FOREST_STONE_BENCH_TYPE) return 18;
  if (object.type === FOREST_TRAIL_SIGN_TYPE) return 10;
  if (object.type === FOREST_SEED_POD_LANTERN_TYPE) return 9;
  return FOREST_MARKER_COLLISION_RADIUS;
}

function stoneTrailConnected(stones) {
  if (stones.length < 2) return true;
  const visited = new Set([stones[0].id]);
  const remaining = [stones[0]];
  while (remaining.length) {
    const current = remaining.shift();
    for (const stone of stones) {
      const distance = Math.hypot(current.worldX - stone.worldX, current.worldY - stone.worldY);
      if (!visited.has(stone.id) && distance <= FOREST_STONE_MAXIMUM_SPACING) {
        visited.add(stone.id);
        remaining.push(stone);
      }
    }
  }
  return visited.size === stones.length;
}

export function forestSteppingStoneJoins(objects) {
  const stones = objects.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE)
    .sort((left, right) => left.id.localeCompare(right.id));
  return stones.slice(1).map((stone, index) => {
    const candidates = stones.slice(0, index + 1).map((other) => ({
      from: other,
      to: stone,
      distance: Math.hypot(stone.worldX - other.worldX, stone.worldY - other.worldY)
    })).filter(({ distance }) => distance <= FOREST_STONE_MAXIMUM_SPACING)
      .sort((left, right) => left.distance - right.distance
        || left.from.id.localeCompare(right.from.id));
    return candidates[0] || null;
  }).filter(Boolean).map(({ from, to }) => ({ fromId: from.id, toId: to.id }));
}

export function validateForestObjectPlacement(object, scene, otherObjects = []) {
  if (!isForestPlacedObject(object)) return { valid: false, reason: 'invalid-object' };
  const radius = objectRadius(object);
  if (object.worldX - radius < 0 || object.worldY - radius < 0
    || object.worldX + radius > scene.world.width
    || object.worldY + radius > scene.world.height) {
    return { valid: false, reason: 'world-bounds' };
  }
  if (scene.environment) {
    const environment = forestEnvironmentAt(scene.environment, {
      worldX: object.worldX, worldY: object.worldY
    });
    if (environment.hydrology.state !== 'land'
      || environment.hydrology.distanceToCenter <= environment.hydrology.waterHalfWidth
        + environment.hydrology.bankWidth + radius) {
      return { valid: false, reason: 'water-or-bank-surface' };
    }
  }
  if (scene.placements.some((placement) => Math.hypot(
    object.worldX - placement.worldX, object.worldY - placement.worldY
  ) < radius + placement.collisionRadius)) {
    return { valid: false, reason: 'tree-collision' };
  }
  if ((scene.terrainFeatures || []).some((feature) => Math.hypot(
    object.worldX - feature.worldX, object.worldY - feature.worldY
  ) < radius + feature.collisionRadius)) {
    return { valid: false, reason: 'terrain-feature-collision' };
  }
  const spawn = scene.exploration?.spawn;
  if (spawn && Math.hypot(object.worldX - spawn.worldX, object.worldY - spawn.worldY)
    < radius + spawn.radius) return { valid: false, reason: 'entrance-collision' };
  if (otherObjects.some((other) => other.id !== object.id && Math.hypot(
    object.worldX - other.worldX, object.worldY - other.worldY
  ) < radius + objectRadius(other))) return { valid: false, reason: 'object-collision' };
  return { valid: true, reason: null };
}

export function validateForestTrailPlacement(stone, scene, otherObjects = []) {
  if (!isForestPlacedObject(stone) || stone.type !== FOREST_STEPPING_STONE_TYPE) {
    return { valid: false, reason: 'invalid-stone' };
  }
  const basic = validateForestObjectPlacement(stone, scene, otherObjects.filter(
    ({ type }) => type !== FOREST_STEPPING_STONE_TYPE
  ));
  if (!basic.valid) return basic;
  const spawn = scene.exploration?.spawn;
  if (spawn && Math.hypot(stone.worldX - spawn.worldX, stone.worldY - spawn.worldY)
    < FOREST_ENTRANCE_PROTECTION_RADIUS) return { valid: false, reason: 'protected-entrance' };
  if (scene.placements.some((placement) => Math.hypot(
    stone.worldX - placement.worldX, stone.worldY - placement.worldY
  ) < FOREST_STONE_COLLISION_RADIUS + placement.collisionRadius
    + FOREST_TREE_TRAIL_CLEARANCE)) {
    return { valid: false, reason: 'tree-interaction-space' };
  }
  const otherStones = otherObjects.filter(({ id, type }) => (
    id !== stone.id && type === FOREST_STEPPING_STONE_TYPE
  ));
  if (otherStones.some((other) => Math.hypot(
    stone.worldX - other.worldX, stone.worldY - other.worldY
  ) < FOREST_STONE_MINIMUM_SPACING)) return { valid: false, reason: 'stone-too-close' };
  if (otherStones.length && !otherStones.some((other) => Math.hypot(
    stone.worldX - other.worldX, stone.worldY - other.worldY
  ) <= FOREST_STONE_MAXIMUM_SPACING)) return { valid: false, reason: 'trail-gap' };
  return { valid: true, reason: null };
}

export function createForestTrailPlacementPreview(worldX, worldY, id, scene, otherObjects = []) {
  const stone = createForestSteppingStone(worldX, worldY, id);
  return { stone, ...validateForestTrailPlacement(stone, scene, otherObjects) };
}

export function overlayWithForestSteppingStone(overlay, stone, scene) {
  const validation = validateForestOverlay(overlay, overlay?.baseIdentity);
  if (!validation.valid) throw new Error(`Invalid forest overlay: ${validation.reason}.`);
  const existing = overlay.objects.find(({ id }) => id === stone.id);
  if (existing && existing.type !== FOREST_STEPPING_STONE_TYPE) {
    throw new Error('A stepping stone cannot replace another object type.');
  }
  if (!existing && overlay.objects.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE).length
    >= FOREST_TRAIL_MAX_STONES) return { overlay, valid: false, reason: 'stone-limit' };
  const otherObjects = overlay.objects.filter(({ id }) => id !== stone.id);
  const placement = validateForestTrailPlacement(stone, scene, otherObjects);
  if (!placement.valid) return { overlay, ...placement };
  const objects = [...otherObjects, { ...stone }].sort((left, right) =>
    left.id.localeCompare(right.id));
  const stones = objects.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE);
  if (!stoneTrailConnected(stones)) return { overlay, valid: false, reason: 'trail-disconnected' };
  return { overlay: { ...overlay, revision: overlay.revision + 1, objects },
    valid: true, reason: null };
}

export function overlayWithoutForestSteppingStone(overlay, stoneId) {
  const existing = overlay.objects.find(({ id, type }) => id === stoneId
    && type === FOREST_STEPPING_STONE_TYPE);
  if (!existing) return { overlay, valid: false, reason: 'stone-not-found' };
  const objects = overlay.objects.filter(({ id }) => id !== stoneId);
  if (!stoneTrailConnected(objects.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE))) {
    return { overlay, valid: false, reason: 'trail-disconnected' };
  }
  return { overlay: { ...overlay, revision: overlay.revision + 1, objects },
    valid: true, reason: null };
}

export function applyForestOverlay(scene, overlay) {
  const validation = validateForestOverlay(overlay, scene.baseIdentity);
  if (!validation.valid) return { objects: [], error: validation.reason };
  const ordered = [...overlay.objects].sort((left, right) => left.id.localeCompare(right.id));
  for (const object of ordered) {
    const otherObjects = ordered.filter(({ id }) => id !== object.id);
    const placement = object.type === FOREST_STEPPING_STONE_TYPE
      ? validateForestTrailPlacement(object, scene, otherObjects)
      : validateForestObjectPlacement(object, scene, otherObjects);
    if (!placement.valid) return { objects: [], error: placement.reason };
    if ([FOREST_TRAIL_SIGN_TYPE, FOREST_STONE_BENCH_TYPE,
      FOREST_SEED_POD_LANTERN_TYPE].includes(object.type)) {
      const radius = objectRadius(object);
      const spawn = scene.exploration?.spawn;
      if (spawn && Math.hypot(object.worldX - spawn.worldX, object.worldY - spawn.worldY)
        < FOREST_ENTRANCE_PROTECTION_RADIUS + radius) {
        return { objects: [], error: 'protected-entrance' };
      }
      if (scene.placements.some((tree) => Math.hypot(
        object.worldX - tree.worldX, object.worldY - tree.worldY
      ) < radius + tree.collisionRadius + FOREST_CLEARING_TREE_CLEARANCE)) {
        return { objects: [], error: 'tree-interaction-space' };
      }
      if (otherObjects.some((other) => [FOREST_TRAIL_SIGN_TYPE, FOREST_STONE_BENCH_TYPE,
        FOREST_SEED_POD_LANTERN_TYPE].includes(other.type) && Math.hypot(
        object.worldX - other.worldX, object.worldY - other.worldY
      ) < radius + objectRadius(other) + FOREST_CLEARING_OBJECT_MINIMUM_SPACING)) {
        return { objects: [], error: 'clearing-object-spacing' };
      }
    }
  }
  if (!stoneTrailConnected(ordered.filter(({ type }) => type === FOREST_STEPPING_STONE_TYPE))) {
    return { objects: [], error: 'trail-disconnected' };
  }
  return { objects: ordered.map((object) => ({ ...object })), error: null };
}

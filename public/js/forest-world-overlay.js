export const FOREST_OVERLAY_SCHEMA_VERSION = 1;
export const FOREST_PLACED_OBJECT_SCHEMA_VERSION = 1;
export const FOREST_MARKER_ID = 'forest-marker-v1-personal-clearing';
export const FOREST_MARKER_TYPE = 'marker';
export const FOREST_MARKER_COLLISION_RADIUS = 9;
export const FOREST_MARKER_INTERACTION_RADIUS = 54;
export const FOREST_OVERLAY_MAX_OBJECTS = 32;

const OVERLAY_ID_PATTERN = /^forest-overlay-v1-[a-z0-9-]{1,48}$/;
const OBJECT_ID_PATTERN = /^forest-marker-v1-[a-z0-9-]{1,48}$/;

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
  return exactKeys(value, ['schemaVersion', 'id', 'type', 'worldX', 'worldY'])
    && value.schemaVersion === FOREST_PLACED_OBJECT_SCHEMA_VERSION
    && typeof value.id === 'string' && OBJECT_ID_PATTERN.test(value.id)
    && value.type === FOREST_MARKER_TYPE
    && validCoordinate(value.worldX) && validCoordinate(value.worldY);
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
    objects: [{ ...marker }]
  };
}

export function validateForestObjectPlacement(object, scene, otherObjects = []) {
  if (!isForestPlacedObject(object)) return { valid: false, reason: 'invalid-object' };
  const radius = FOREST_MARKER_COLLISION_RADIUS;
  if (object.worldX - radius < 0 || object.worldY - radius < 0
    || object.worldX + radius > scene.world.width
    || object.worldY + radius > scene.world.height) {
    return { valid: false, reason: 'world-bounds' };
  }
  if (scene.placements.some((placement) => Math.hypot(
    object.worldX - placement.worldX, object.worldY - placement.worldY
  ) < radius + placement.collisionRadius)) {
    return { valid: false, reason: 'tree-collision' };
  }
  const spawn = scene.exploration?.spawn;
  if (spawn && Math.hypot(object.worldX - spawn.worldX, object.worldY - spawn.worldY)
    < radius + spawn.radius) return { valid: false, reason: 'entrance-collision' };
  if (otherObjects.some((other) => other.id !== object.id && Math.hypot(
    object.worldX - other.worldX, object.worldY - other.worldY
  ) < radius * 2)) return { valid: false, reason: 'object-collision' };
  return { valid: true, reason: null };
}

export function applyForestOverlay(scene, overlay) {
  const validation = validateForestOverlay(overlay, scene.baseIdentity);
  if (!validation.valid) return { objects: [], error: validation.reason };
  const objects = [];
  for (const object of overlay.objects) {
    const placement = validateForestObjectPlacement(object, scene, objects);
    if (!placement.valid) return { objects: [], error: placement.reason };
    objects.push({ ...object });
  }
  return { objects, error: null };
}

import {
  FOREST_PLACED_OBJECT_SCHEMA_VERSION,
  FOREST_SEED_POD_LANTERN_TYPE,
  FOREST_STONE_BENCH_TYPE,
  FOREST_TRAIL_SIGN_TYPE,
  FOREST_CLEARING_OBJECT_MINIMUM_SPACING,
  FOREST_CLEARING_TREE_CLEARANCE,
  FOREST_ENTRANCE_PROTECTION_RADIUS,
  validateForestObjectPlacement,
  validateForestOverlay
} from './forest-world-overlay.js';

export const FOREST_CLEARING_OBJECT_TYPES = Object.freeze([
  FOREST_TRAIL_SIGN_TYPE, FOREST_STONE_BENCH_TYPE, FOREST_SEED_POD_LANTERN_TYPE
]);
export const FOREST_CLEARING_OBJECT_MAXIMUM = 9;
export const FOREST_CLEARING_OBJECT_PER_TYPE_MAXIMUM = 3;
export const FOREST_CLEARING_SIGN_MAX_CODE_POINTS = 60;
export const FOREST_CLEARING_OBJECT_INTERACTION_RADIUS = 58;
export const FOREST_CLEARING_PLAYER_CLEARANCE = 8;

export { FOREST_CLEARING_OBJECT_MINIMUM_SPACING, FOREST_CLEARING_TREE_CLEARANCE };

export const FOREST_CLEARING_OBJECT_DEFINITIONS = Object.freeze({
  [FOREST_TRAIL_SIGN_TYPE]: Object.freeze({
    type: FOREST_TRAIL_SIGN_TYPE, label: 'Trail sign', affordance: 'sign',
    collisionRadius: 10, visualVersion: 1,
    cost: Object.freeze({ 'fallen-twigs': 2, 'smooth-stones': 0, 'seed-pods': 0 })
  }),
  [FOREST_STONE_BENCH_TYPE]: Object.freeze({
    type: FOREST_STONE_BENCH_TYPE, label: 'Stone bench', affordance: 'seat',
    collisionRadius: 18, visualVersion: 1,
    cost: Object.freeze({ 'fallen-twigs': 0, 'smooth-stones': 2, 'seed-pods': 0 })
  }),
  [FOREST_SEED_POD_LANTERN_TYPE]: Object.freeze({
    type: FOREST_SEED_POD_LANTERN_TYPE, label: 'Seed-pod lantern', affordance: 'light',
    collisionRadius: 9, visualVersion: 1,
    cost: Object.freeze({ 'fallen-twigs': 1, 'smooth-stones': 0, 'seed-pods': 2 })
  })
});

const MATERIAL_IDS = ['fallen-twigs', 'smooth-stones', 'seed-pods'];

export function normalizeForestSignText(value) {
  if (typeof value !== 'string') return { valid: false, reason: 'invalid-sign-text' };
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n');
  if ([...normalized].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 9 || codePoint === 11 || codePoint === 12
      || (codePoint >= 14 && codePoint <= 31) || (codePoint >= 127 && codePoint <= 159);
  })) {
    return { valid: false, reason: 'sign-control-character' };
  }
  const text = normalized.replace(/\n+/g, ' ')
    .trim().replace(/[ \t]+/g, ' ');
  if (!text) return { valid: true, text: '' };
  if ([...text].length > FOREST_CLEARING_SIGN_MAX_CODE_POINTS) {
    return { valid: false, reason: 'sign-text-too-long' };
  }
  return { valid: true, text };
}

export function createForestClearingObject(type, worldX, worldY, id, text = '') {
  if (!FOREST_CLEARING_OBJECT_TYPES.includes(type)) throw new Error('Unknown clearing object type.');
  const object = {
    schemaVersion: FOREST_PLACED_OBJECT_SCHEMA_VERSION,
    id, type, worldX: Math.round(worldX), worldY: Math.round(worldY)
  };
  if (type === FOREST_TRAIL_SIGN_TYPE) {
    const normalized = normalizeForestSignText(text);
    if (!normalized.valid) throw new Error(normalized.reason);
    object.text = normalized.text;
  }
  return object;
}

export function isForestClearingObject(value) {
  if (!value || !FOREST_CLEARING_OBJECT_TYPES.includes(value.type)) return false;
  const definition = FOREST_CLEARING_OBJECT_DEFINITIONS[value.type];
  if (value.schemaVersion !== FOREST_PLACED_OBJECT_SCHEMA_VERSION
    || typeof value.id !== 'string'
    || !new RegExp(`^forest-clearing-v1-${value.type}-[0-9]{2}$`).test(value.id)
    || !Number.isSafeInteger(value.worldX) || !Number.isSafeInteger(value.worldY)) return false;
  if (value.type === FOREST_TRAIL_SIGN_TYPE) {
    const normalized = normalizeForestSignText(value.text);
    return Object.keys(value).length === 6 && normalized.valid && normalized.text === value.text;
  }
  return Object.keys(value).length === 5 && Boolean(definition);
}

export function nextForestClearingObjectId(overlay, type) {
  if (!FOREST_CLEARING_OBJECT_TYPES.includes(type)) return null;
  const used = new Set(overlay.objects.map(({ id }) => id));
  for (let ordinal = 1; ordinal <= FOREST_CLEARING_OBJECT_PER_TYPE_MAXIMUM; ordinal += 1) {
    const id = `forest-clearing-v1-${type}-${String(ordinal).padStart(2, '0')}`;
    if (!used.has(id)) return id;
  }
  return null;
}

export function forestClearingMaterialLedger(inventory, objects) {
  const committed = Object.fromEntries(MATERIAL_IDS.map((id) => [id, 0]));
  objects.filter(isForestClearingObject).forEach(({ type }) => {
    MATERIAL_IDS.forEach((id) => { committed[id] += FOREST_CLEARING_OBJECT_DEFINITIONS[type].cost[id]; });
  });
  const available = Object.fromEntries(MATERIAL_IDS.map((id) => [id, inventory[id] - committed[id]]));
  const valid = MATERIAL_IDS.every((id) => Number.isSafeInteger(inventory[id]) && available[id] >= 0);
  return { committed, available, valid, reason: valid ? null : 'impossible-material-commitment' };
}

export function canAffordForestClearingObject(inventory, objects, type) {
  const definition = FOREST_CLEARING_OBJECT_DEFINITIONS[type];
  if (!definition) return false;
  const ledger = forestClearingMaterialLedger(inventory, objects);
  return ledger.valid && MATERIAL_IDS.every((id) => ledger.available[id] >= definition.cost[id]);
}

export function validateForestClearingObjectPlacement(object, scene, otherObjects = [],
  discoveries = [], player = null) {
  if (!isForestClearingObject(object)) return { valid: false, reason: 'invalid-clearing-object' };
  const definition = FOREST_CLEARING_OBJECT_DEFINITIONS[object.type];
  const basic = validateForestObjectPlacement(object, scene, otherObjects);
  if (!basic.valid) return basic;
  const spawn = scene.exploration?.spawn;
  if (spawn && Math.hypot(object.worldX - spawn.worldX, object.worldY - spawn.worldY)
    < FOREST_ENTRANCE_PROTECTION_RADIUS + definition.collisionRadius) {
    return { valid: false, reason: 'protected-entrance' };
  }
  if (player && Math.hypot(object.worldX - player.worldX, object.worldY - player.worldY)
    < definition.collisionRadius + player.radius + FOREST_CLEARING_PLAYER_CLEARANCE) {
    return { valid: false, reason: 'player-collision' };
  }
  if (scene.placements.some((tree) => Math.hypot(
    object.worldX - tree.worldX, object.worldY - tree.worldY
  ) < definition.collisionRadius + tree.collisionRadius + FOREST_CLEARING_TREE_CLEARANCE)) {
    return { valid: false, reason: 'tree-interaction-space' };
  }
  if (otherObjects.some((other) => other.id !== object.id && isForestClearingObject(other)
    && Math.hypot(object.worldX - other.worldX, object.worldY - other.worldY)
      < definition.collisionRadius
        + FOREST_CLEARING_OBJECT_DEFINITIONS[other.type].collisionRadius
        + FOREST_CLEARING_OBJECT_MINIMUM_SPACING)) {
    return { valid: false, reason: 'clearing-object-spacing' };
  }
  if (discoveries.some((discovery) => Math.hypot(
    object.worldX - discovery.worldX, object.worldY - discovery.worldY
  ) < definition.collisionRadius + 28)) return { valid: false, reason: 'discovery-collision' };
  return { valid: true, reason: null };
}

export function createForestClearingPlacementPreview(type, worldX, worldY, id, scene,
  otherObjects = [], discoveries = [], player = null, text = '') {
  const object = createForestClearingObject(type, worldX, worldY, id, text);
  return { object, ...validateForestClearingObjectPlacement(
    object, scene, otherObjects, discoveries, player
  ) };
}

export function overlayWithForestClearingObject(overlay, object, scene, inventory,
  discoveries = [], player = null) {
  const validation = validateForestOverlay(overlay, overlay?.baseIdentity);
  if (!validation.valid) throw new Error(`Invalid forest overlay: ${validation.reason}.`);
  const existing = overlay.objects.find(({ id }) => id === object.id);
  if (existing && !isForestClearingObject(existing)) {
    return { overlay, valid: false, reason: 'object-type-conflict' };
  }
  const clearing = overlay.objects.filter(isForestClearingObject);
  if (!existing && clearing.length >= FOREST_CLEARING_OBJECT_MAXIMUM) {
    return { overlay, valid: false, reason: 'clearing-object-limit' };
  }
  if (!existing && clearing.filter(({ type }) => type === object.type).length
    >= FOREST_CLEARING_OBJECT_PER_TYPE_MAXIMUM) {
    return { overlay, valid: false, reason: 'clearing-object-type-limit' };
  }
  if (!existing && !canAffordForestClearingObject(inventory, overlay.objects, object.type)) {
    return { overlay, valid: false, reason: 'insufficient-materials' };
  }
  if (existing && existing.type !== object.type) {
    return { overlay, valid: false, reason: 'object-type-conflict' };
  }
  const otherObjects = overlay.objects.filter(({ id }) => id !== object.id);
  const placement = validateForestClearingObjectPlacement(
    object, scene, otherObjects, discoveries, player
  );
  if (!placement.valid) return { overlay, ...placement };
  return { overlay: { ...overlay, revision: overlay.revision + 1,
    objects: [...otherObjects, { ...object }].sort((a, b) => a.id.localeCompare(b.id)) },
  valid: true, reason: null };
}

export function overlayWithoutForestClearingObject(overlay, objectId) {
  const existing = overlay.objects.find(({ id }) => id === objectId);
  if (!isForestClearingObject(existing)) {
    return { overlay, valid: false, reason: 'clearing-object-not-found' };
  }
  return { overlay: { ...overlay, revision: overlay.revision + 1,
    objects: overlay.objects.filter(({ id }) => id !== objectId) }, valid: true, reason: null };
}

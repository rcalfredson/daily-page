import {
  FOREST_MARKER_TYPE,
  FOREST_SEED_POD_LANTERN_TYPE,
  FOREST_STONE_BENCH_TYPE,
  FOREST_STEPPING_STONE_TYPE,
  FOREST_TRAIL_SIGN_TYPE,
  isForestBaseIdentity,
  sameForestBaseIdentity
} from './forest-world-overlay.js';

export const FOREST_DISCOVERY_SCHEMA_VERSION = 1;
export const FOREST_DISCOVERY_STATE_SCHEMA_VERSION = 1;
export const FOREST_DISCOVERY_GENERATION_VERSION = 1;
export const FOREST_DISCOVERY_TYPE = 'discovery';
export const FOREST_DISCOVERY_PICKUP_RADIUS = 34;
export const FOREST_DISCOVERY_RENDER_RADIUS = 10;
export const FOREST_DISCOVERY_MINIMUM_SPACING = 92;
export const FOREST_DISCOVERY_TREE_CLEARANCE = 26;
export const FOREST_DISCOVERY_ENTRANCE_CLEARANCE = 96;
export const FOREST_DISCOVERY_OVERLAY_CLEARANCE = 18;
export const FOREST_DISCOVERY_OFFERING_COUNT = 9;
export const FOREST_DISCOVERY_MAX_CYCLE = 9999;
export const FOREST_DISCOVERY_MAX_INVENTORY_COUNT = 9999;

export const FOREST_DISCOVERY_MATERIALS = Object.freeze([
  Object.freeze({ id: 'fallen-twigs', label: 'Fallen twigs', shortLabel: 'Twigs' }),
  Object.freeze({ id: 'smooth-stones', label: 'Smooth stones', shortLabel: 'Stones' }),
  Object.freeze({ id: 'seed-pods', label: 'Seed pods', shortLabel: 'Seeds' })
]);

const MATERIAL_IDS = new Set(FOREST_DISCOVERY_MATERIALS.map(({ id }) => id));
const DISCOVERY_ID_PATTERN = /^forest-discovery-v1-[a-f0-9]{8}-[0-9]{1,4}-[0-9]{2}$/;
const STATE_ID = 'forest-discovery-state-v1-local-personal';

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function validCoordinate(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100000;
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function unit(seed) {
  return hash(seed) / 4294967296;
}

function discoveryBaseKey(baseIdentity) {
  return hash(JSON.stringify(baseIdentity)).toString(16).padStart(8, '0');
}

function corridorCenter(scene, worldY) {
  return (scene.world.width / 2) + (Math.sin((worldY / 330) + 0.7) * 155);
}

function overlayRadius(object) {
  return object.type === FOREST_STEPPING_STONE_TYPE ? 14
    : object.type === FOREST_STONE_BENCH_TYPE ? 20
      : [FOREST_TRAIL_SIGN_TYPE, FOREST_SEED_POD_LANTERN_TYPE,
        FOREST_MARKER_TYPE].includes(object.type) ? 12 : 12;
}

export function isForestDiscoveryMaterial(value) {
  return typeof value === 'string' && MATERIAL_IDS.has(value);
}

export function isForestDiscovery(value) {
  return exactKeys(value, [
    'schemaVersion', 'id', 'type', 'material', 'cycle', 'worldX', 'worldY'
  ]) && value.schemaVersion === FOREST_DISCOVERY_SCHEMA_VERSION
    && typeof value.id === 'string' && DISCOVERY_ID_PATTERN.test(value.id)
    && value.type === FOREST_DISCOVERY_TYPE
    && isForestDiscoveryMaterial(value.material)
    && Number.isSafeInteger(value.cycle) && value.cycle >= 0
    && value.cycle <= FOREST_DISCOVERY_MAX_CYCLE
    && validCoordinate(value.worldX) && validCoordinate(value.worldY);
}

export function emptyForestDiscoveryInventory() {
  return Object.fromEntries(FOREST_DISCOVERY_MATERIALS.map(({ id }) => [id, 0]));
}

export function createEmptyForestDiscoveryState(baseIdentity) {
  if (!isForestBaseIdentity(baseIdentity)) throw new Error('A valid forest base identity is required.');
  return {
    schemaVersion: FOREST_DISCOVERY_STATE_SCHEMA_VERSION,
    id: STATE_ID,
    baseIdentity: { ...baseIdentity },
    revision: 0,
    cycle: 0,
    inventory: emptyForestDiscoveryInventory(),
    collectedDiscoveryIds: []
  };
}

export function validateForestDiscoveryState(value, expectedBaseIdentity) {
  if (!exactKeys(value, [
    'schemaVersion', 'id', 'baseIdentity', 'revision', 'cycle', 'inventory',
    'collectedDiscoveryIds'
  ])) return { valid: false, reason: 'invalid-shape' };
  if (value.schemaVersion !== FOREST_DISCOVERY_STATE_SCHEMA_VERSION) {
    return { valid: false, reason: 'unsupported-version' };
  }
  if (value.id !== STATE_ID) return { valid: false, reason: 'invalid-id' };
  if (!isForestBaseIdentity(value.baseIdentity)) {
    return { valid: false, reason: 'invalid-base-identity' };
  }
  if (expectedBaseIdentity && !sameForestBaseIdentity(value.baseIdentity, expectedBaseIdentity)) {
    return { valid: false, reason: 'incompatible-base' };
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
    return { valid: false, reason: 'invalid-revision' };
  }
  if (!Number.isSafeInteger(value.cycle) || value.cycle < 0
    || value.cycle > FOREST_DISCOVERY_MAX_CYCLE) {
    return { valid: false, reason: 'invalid-cycle' };
  }
  const materialIds = FOREST_DISCOVERY_MATERIALS.map(({ id }) => id);
  if (!exactKeys(value.inventory, materialIds) || materialIds.some((id) => (
    !Number.isSafeInteger(value.inventory[id]) || value.inventory[id] < 0
      || value.inventory[id] > FOREST_DISCOVERY_MAX_INVENTORY_COUNT
  ))) return { valid: false, reason: 'invalid-inventory' };
  if (!Array.isArray(value.collectedDiscoveryIds)
    || value.collectedDiscoveryIds.length > FOREST_DISCOVERY_OFFERING_COUNT
    || value.collectedDiscoveryIds.some((id) => (
      typeof id !== 'string' || !DISCOVERY_ID_PATTERN.test(id)
    ))) return { valid: false, reason: 'invalid-collected-discoveries' };
  if (new Set(value.collectedDiscoveryIds).size !== value.collectedDiscoveryIds.length) {
    return { valid: false, reason: 'duplicate-collected-discovery-id' };
  }
  const expectedPrefix = `forest-discovery-v1-${discoveryBaseKey(value.baseIdentity)}-${
    value.cycle}-`;
  if (value.collectedDiscoveryIds.some((id) => !id.startsWith(expectedPrefix))) {
    return { valid: false, reason: 'incompatible-collected-discovery' };
  }
  if (value.collectedDiscoveryIds.some((id) => {
    const ordinal = Number(id.slice(expectedPrefix.length));
    return !Number.isSafeInteger(ordinal) || ordinal < 1
      || ordinal > FOREST_DISCOVERY_OFFERING_COUNT;
  })) return { valid: false, reason: 'invalid-collected-discovery-ordinal' };
  return { valid: true, reason: null };
}

export function validateForestDiscoveryPlacement(discovery, scene, placed = [], objects = []) {
  if (!isForestDiscovery(discovery)) return { valid: false, reason: 'invalid-discovery' };
  const radius = FOREST_DISCOVERY_RENDER_RADIUS;
  if (discovery.worldX - radius < 0 || discovery.worldY - radius < 0
    || discovery.worldX + radius > scene.world.width
    || discovery.worldY + radius > scene.world.height) {
    return { valid: false, reason: 'world-bounds' };
  }
  if (scene.placements.some((tree) => Math.hypot(
    discovery.worldX - tree.worldX, discovery.worldY - tree.worldY
  ) < radius + tree.collisionRadius + FOREST_DISCOVERY_TREE_CLEARANCE)) {
    return { valid: false, reason: 'tree-interaction-space' };
  }
  const spawn = scene.exploration?.spawn;
  if (spawn && Math.hypot(discovery.worldX - spawn.worldX, discovery.worldY - spawn.worldY)
    < FOREST_DISCOVERY_ENTRANCE_CLEARANCE) {
    return { valid: false, reason: 'protected-entrance' };
  }
  if (objects.some((object) => Math.hypot(
    discovery.worldX - object.worldX, discovery.worldY - object.worldY
  ) < radius + overlayRadius(object) + FOREST_DISCOVERY_OVERLAY_CLEARANCE)) {
    return { valid: false, reason: 'overlay-collision' };
  }
  if (placed.some((other) => Math.hypot(
    discovery.worldX - other.worldX, discovery.worldY - other.worldY
  ) < FOREST_DISCOVERY_MINIMUM_SPACING)) {
    return { valid: false, reason: 'discovery-spacing' };
  }
  return { valid: true, reason: null };
}

export function generateForestDiscoveries(scene, cycle = 0, objects = []) {
  if (!isForestBaseIdentity(scene?.baseIdentity)) throw new Error('A valid forest scene is required.');
  if (!Number.isSafeInteger(cycle) || cycle < 0 || cycle > FOREST_DISCOVERY_MAX_CYCLE) {
    throw new Error('A bounded discovery cycle is required.');
  }
  const discoveries = [];
  const verticalReach = Math.min(1180, Math.max(420, scene.world.height - 360));
  const minimumY = Math.max(80, scene.exploration.spawn.worldY - verticalReach);
  const maximumY = Math.max(minimumY, scene.exploration.spawn.worldY - 150);
  const seed = [
    `forest-discoveries-v${FOREST_DISCOVERY_GENERATION_VERSION}`,
    scene.baseIdentity.sceneVersion,
    scene.baseIdentity.seed,
    scene.baseIdentity.layoutKey,
    cycle
  ].join(':');

  for (let ordinal = 0; ordinal < FOREST_DISCOVERY_OFFERING_COUNT; ordinal += 1) {
    let accepted = null;
    for (let attempt = 0; attempt < 2000 && !accepted; attempt += 1) {
      const decision = `${seed}:${ordinal}:${attempt}`;
      const worldY = Math.round(minimumY + (unit(`${decision}:y`) * (maximumY - minimumY)));
      const halfWidth = Math.max(70, scene.corridor.halfWidth - 24);
      const worldX = Math.round(corridorCenter(scene, worldY)
        + ((unit(`${decision}:x`) * 2 - 1) * halfWidth));
      const discovery = {
        schemaVersion: FOREST_DISCOVERY_SCHEMA_VERSION,
        id: `forest-discovery-v1-${discoveryBaseKey(scene.baseIdentity)}-${cycle}-${String(
          ordinal + 1
        ).padStart(2, '0')}`,
        type: FOREST_DISCOVERY_TYPE,
        material: FOREST_DISCOVERY_MATERIALS[ordinal % FOREST_DISCOVERY_MATERIALS.length].id,
        cycle,
        worldX,
        worldY
      };
      if (validateForestDiscoveryPlacement(discovery, scene, discoveries, objects).valid) {
        accepted = discovery;
      }
    }
    if (!accepted) throw new Error(`Could not place discovery ${ordinal + 1}.`);
    discoveries.push(accepted);
  }
  return discoveries;
}

export function availableForestDiscoveries(discoveries, state) {
  const validation = validateForestDiscoveryState(state, state?.baseIdentity);
  if (!validation.valid) throw new Error(`Invalid discovery state: ${validation.reason}.`);
  const collected = new Set(state.collectedDiscoveryIds);
  return discoveries.filter(({ id }) => !collected.has(id));
}

export function forestDiscoveryStateAfterPickup(state, discovery, offering) {
  const validation = validateForestDiscoveryState(state, state?.baseIdentity);
  if (!validation.valid) return { state, valid: false, reason: validation.reason };
  if (!isForestDiscovery(discovery) || discovery.cycle !== state.cycle
    || !offering.some(({ id }) => id === discovery.id)) {
    return { state, valid: false, reason: 'discovery-not-offered' };
  }
  if (state.collectedDiscoveryIds.includes(discovery.id)) {
    return { state, valid: false, reason: 'already-collected' };
  }
  if (state.inventory[discovery.material] >= FOREST_DISCOVERY_MAX_INVENTORY_COUNT) {
    return { state, valid: false, reason: 'inventory-limit' };
  }
  return {
    state: {
      ...state,
      revision: state.revision + 1,
      inventory: {
        ...state.inventory,
        [discovery.material]: state.inventory[discovery.material] + 1
      },
      collectedDiscoveryIds: [...state.collectedDiscoveryIds, discovery.id].sort()
    },
    valid: true,
    reason: null
  };
}

export function renewForestDiscoveryState(state, offering) {
  const validation = validateForestDiscoveryState(state, state?.baseIdentity);
  if (!validation.valid) return { state, valid: false, reason: validation.reason };
  if (offering.length !== FOREST_DISCOVERY_OFFERING_COUNT
    || offering.some(({ id }) => !state.collectedDiscoveryIds.includes(id))) {
    return { state, valid: false, reason: 'offering-incomplete' };
  }
  if (state.cycle >= FOREST_DISCOVERY_MAX_CYCLE) {
    return { state, valid: false, reason: 'cycle-limit' };
  }
  return {
    state: {
      ...state,
      revision: state.revision + 1,
      cycle: state.cycle + 1,
      collectedDiscoveryIds: []
    },
    valid: true,
    reason: null
  };
}

export function forestDiscoveryMaterial(materialId) {
  return FOREST_DISCOVERY_MATERIALS.find(({ id }) => id === materialId) || null;
}

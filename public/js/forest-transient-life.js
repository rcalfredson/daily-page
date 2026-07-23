import {
  forestBridgeContains,
  forestEnvironmentAt
} from './forest-environment.js';

export const FOREST_TRANSIENT_LIFE_VERSION = 2;
export const FOREST_TRANSIENT_ACTOR_SCHEMA_VERSION = 2;
export const FOREST_TRANSIENT_BIRD_LIMIT = 4;
export const FOREST_TRANSIENT_GROUND_BIRD_COUNT = 2;
export const FOREST_TRANSIENT_VISIBLE_REDUCED_MOTION_LIMIT = 2;
export const FOREST_TRANSIENT_SIMULATION_MARGIN = 160;
export const FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS = 50;
export const FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE = 4;
export const FOREST_TRANSIENT_STARTLE_RADIUS = 88;
export const FOREST_TRANSIENT_STARTLE_RESET_RADIUS = 142;
export const FOREST_TRANSIENT_GROUND_RADIUS = 9;
export const FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS = 4;

export const FOREST_BIRD_VARIANTS = Object.freeze([
  Object.freeze({ id: 'moss-cap', body: '#63714d', wing: '#394b40', breast: '#d7c58f' }),
  Object.freeze({ id: 'rust-breast', body: '#8d6748', wing: '#3f4d45', breast: '#dda66c' }),
  Object.freeze({ id: 'blue-shadow', body: '#647987', wing: '#354957', breast: '#d5cfaa' })
]);

export function forestBirdForagePecking(actor, active = true) {
  if (!active || actor?.behavior?.state !== 'ground-forage') return false;
  const identity = actor.anchorChoice >>> 0;
  const period = 1050 + (identity % 650);
  const phaseOffset = Math.floor(identity / 7) % period;
  const phase = (actor.behavior.elapsedMilliseconds + phaseOffset) % period;
  const firstDuration = 150 + (identity % 100);
  const secondStart = firstDuration + 140 + (identity % 170);
  const doublePeck = identity % 3 !== 0;
  return phase < firstDuration
    || (doublePeck && phase >= secondStart && phase < secondStart + 120);
}

const BIRD_STATES = Object.freeze([
  'perched', 'branch-hop', 'ground-forage', 'ground-wander', 'flight'
]);
const MOTION_CAUSES = Object.freeze([
  'autonomous-hop', 'autonomous-flight', 'player-startled', 'autonomous-return',
  'session-wander'
]);

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnit(value) {
  return stableHash(value) / 4294967296;
}

function nextSessionUnit(life) {
  let state = life.randomState >>> 0 || 0x9E3779B9;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  life.randomState = state >>> 0;
  return life.randomState / 4294967296;
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

export function validForestPerchAnchor(anchor) {
  return exactKeys(anchor, ['id', 'x', 'y', 'depth', 'layer'])
    && /^perch-\d{3}$/.test(anchor.id)
    && Number.isInteger(anchor.x) && Number.isInteger(anchor.y)
    && Number.isFinite(anchor.depth)
    && ['behind-wood', 'front-of-wood'].includes(anchor.layer);
}

function placementIsBirdSuitable(placement) {
  return typeof placement?.id === 'string'
    && typeof placement.assetKey === 'string'
    && Number.isFinite(placement.worldX)
    && Number.isFinite(placement.worldY)
    && placement.groundSurfaceId !== 'shallow-stream'
    && (!placement.originatingHabitatId
      || ['neutral-grove', 'rocky-edge'].includes(placement.originatingHabitatId));
}

function castCandidates(scene) {
  const spawn = scene.exploration.spawn;
  const nearby = scene.placements.filter(placement => placementIsBirdSuitable(placement)
    && Math.hypot(placement.worldX - spawn.worldX, placement.worldY - spawn.worldY) <= 920);
  const candidates = nearby.length >= 6 ? nearby : scene.placements.filter(placementIsBirdSuitable);
  return [...candidates].sort((left, right) => (
    stableHash(`${scene.seed}:transient-tree:${left.id}`)
      - stableHash(`${scene.seed}:transient-tree:${right.id}`)
      || left.id.localeCompare(right.id)
  ));
}

function routeFromSource(candidates, source, seed) {
  if (!source) return [];
  const neighbors = candidates.filter(({ id }) => id !== source.id).sort((left, right) => (
    Math.hypot(left.worldX - source.worldX, left.worldY - source.worldY)
      - Math.hypot(right.worldX - source.worldX, right.worldY - source.worldY)
      || stableHash(`${seed}:${source.id}:route:${left.id}`)
        - stableHash(`${seed}:${source.id}:route:${right.id}`)
      || left.id.localeCompare(right.id)
  ));
  return [source.id, ...neighbors.slice(0, 2).map(({ id }) => id)];
}

function routeFor(candidates, actorIndex, seed, groundCenter = null) {
  const source = groundCenter && actorIndex >= FOREST_TRANSIENT_BIRD_LIMIT
    - FOREST_TRANSIENT_GROUND_BIRD_COUNT
    ? [...candidates].sort((left, right) => (
      Math.hypot(left.worldX - groundCenter.worldX, left.worldY - groundCenter.worldY)
        - Math.hypot(right.worldX - groundCenter.worldX, right.worldY - groundCenter.worldY)
        || left.id.localeCompare(right.id)
    ))[actorIndex % FOREST_TRANSIENT_GROUND_BIRD_COUNT]
    : candidates[actorIndex % candidates.length];
  return routeFromSource(candidates, source, seed);
}

function obstacleRadius(object) {
  if (Number.isFinite(object.collisionRadius)) return object.collisionRadius;
  if (Number.isFinite(object.width)) return Math.max(10, object.width / 2);
  return object.type === 'stone-bench' ? 18 : object.type === 'stepping-stone' ? 14 : 12;
}

export function forestTransientGroundSuitability(scene, point, objects = []) {
  if (!Number.isSafeInteger(point?.worldX) || !Number.isSafeInteger(point?.worldY)) {
    return { valid: false, reason: 'invalid-point' };
  }
  const clearance = FOREST_TRANSIENT_GROUND_RADIUS + 10;
  if (point.worldX < clearance || point.worldY < clearance
    || point.worldX > scene.world.width - clearance
    || point.worldY > scene.world.height - clearance) {
    return { valid: false, reason: 'world-bounds' };
  }
  if (scene.environment) {
    const environment = forestEnvironmentAt(scene.environment, point);
    if (environment.hydrology.state !== 'land'
      || environment.hydrology.distanceToCenter <= environment.hydrology.waterHalfWidth
        + environment.hydrology.bankWidth + clearance) {
      return { valid: false, reason: 'wet-or-bank-ground' };
    }
  }
  if ((scene.crossings || []).some(crossing => forestBridgeContains(
    crossing, point, clearance
  ))) return { valid: false, reason: 'bridge-ground' };
  if (scene.placements.some(placement => Math.hypot(
    point.worldX - placement.worldX, point.worldY - placement.worldY
  ) < placement.collisionRadius + clearance + 6)) {
    return { valid: false, reason: 'tree-ground' };
  }
  if ((scene.terrainFeatures || []).some(feature => Math.hypot(
    point.worldX - feature.worldX, point.worldY - feature.worldY
  ) < feature.collisionRadius + clearance)) {
    return { valid: false, reason: 'terrain-ground' };
  }
  if (objects.some(object => Number.isFinite(object.worldX) && Number.isFinite(object.worldY)
    && Math.hypot(point.worldX - object.worldX, point.worldY - object.worldY)
      < obstacleRadius(object) + clearance)) {
    return { valid: false, reason: 'authored-object-ground' };
  }
  return { valid: true, reason: null };
}

export function selectForestTransientGroundGroup(scene, objects = []) {
  const spawn = scene.exploration.spawn;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const angle = stableUnit(`${scene.seed}:ground-group:${attempt}:angle`) * Math.PI * 2;
    const distance = 170 + Math.round(
      stableUnit(`${scene.seed}:ground-group:${attempt}:distance`) * 250
    );
    const point = {
      worldX: Math.round(spawn.worldX + (Math.cos(angle) * distance)),
      worldY: Math.round(spawn.worldY + (Math.sin(angle) * distance))
    };
    if (forestTransientGroundSuitability(scene, point, objects).valid) {
      return { point, attempts: attempt + 1, exhausted: false };
    }
  }
  return { point: null, attempts: 48, exhausted: true };
}

function groundPoint(center, actorIndex) {
  const side = actorIndex % 2 ? 1 : -1;
  const worldX = center.worldX + (side * 9);
  const worldY = center.worldY + (side * 3);
  return {
    placementId: null,
    anchorId: null,
    layer: 'ground',
    x: worldX,
    y: worldY,
    z: 0,
    projectedY: worldY
  };
}

export function createForestTransientLife(scene, {
  objects = [], sessionSeed = stableHash(`${scene.seed}:default-transient-session`)
} = {}) {
  const candidates = castCandidates(scene);
  const count = Math.min(FOREST_TRANSIENT_BIRD_LIMIT, candidates.length);
  const groundSelection = count === FOREST_TRANSIENT_BIRD_LIMIT
    ? selectForestTransientGroundGroup(scene, objects)
    : { point: null, attempts: 0, exhausted: true };
  const groundStartIndex = count - FOREST_TRANSIENT_GROUND_BIRD_COUNT;
  const actors = Array.from({ length: count }, (_, index) => {
    const identitySeed = stableHash(`${scene.seed}:bird:${index}`);
    const inGroundGroup = Boolean(groundSelection.point && index >= groundStartIndex);
    return {
      schemaVersion: FOREST_TRANSIENT_ACTOR_SCHEMA_VERSION,
      id: `forest-bird-v2-${String(index + 1).padStart(2, '0')}`,
      kind: 'bird',
      variantId: FOREST_BIRD_VARIANTS[identitySeed % FOREST_BIRD_VARIANTS.length].id,
      route: routeFor(candidates, index, scene.seed, groundSelection.point),
      anchorChoice: identitySeed,
      groupId: inGroundGroup ? 'forest-ground-flock-v1-01' : null,
      behavior: {
        state: inGroundGroup ? 'ground-forage' : 'perched',
        routeIndex: 0,
        anchorOffset: 0,
        hopsAtTree: 0,
        elapsedMilliseconds: 0,
        durationMilliseconds: 6500 + (identitySeed % 5500),
        startleDelayMilliseconds: inGroundGroup ? (index - groundStartIndex) * 180 : 0,
        retreatAttempts: 0,
        wanderElapsedMilliseconds: 0,
        wanderDurationMilliseconds: inGroundGroup
          ? 2200 + (stableHash(`${sessionSeed}:${identitySeed}:wander`) % 5200) : 0,
        transitionCount: 0,
        motion: null,
        groundPoint: inGroundGroup ? groundPoint(groundSelection.point, index) : null
      }
    };
  });
  const groundActors = actors.filter(({ groupId }) => groupId);
  return {
    version: FOREST_TRANSIENT_LIFE_VERSION,
    seed: `${scene.seed}:transient-life-v${FOREST_TRANSIENT_LIFE_VERSION}`,
    randomState: sessionSeed >>> 0,
    elapsedMilliseconds: 0,
    remainderMilliseconds: 0,
    actors,
    groundGroup: groundSelection.point ? {
      id: 'forest-ground-flock-v1-01',
      center: groundSelection.point,
      actorIds: groundActors.map(({ id }) => id),
      armed: false,
      startled: false,
      cooldownElapsedMilliseconds: 0,
      selectionAttempts: groundSelection.attempts
    } : null,
    diagnostics: {
      autonomousTransitions: 0,
      playerStartledTransitions: 0,
      branchHops: 0,
      selectionExhaustions: count < FOREST_TRANSIENT_BIRD_LIMIT || groundSelection.exhausted ? 1 : 0,
      suppressedByReducedMotion: false,
      lastStepCount: 0
    }
  };
}

function validPoint(point) {
  return exactKeys(point, [
    'placementId', 'anchorId', 'layer', 'x', 'y', 'z', 'projectedY'
  ])
    && (point.placementId === null
      || (typeof point.placementId === 'string' && point.placementId.length <= 200))
    && (point.anchorId === null || /^perch-\d{3}$/.test(point.anchorId))
    && ['behind-wood', 'front-of-wood', 'ground'].includes(point.layer)
    && ['x', 'y', 'z', 'projectedY'].every(key => Number.isFinite(point[key]));
}

function validMotion(motion) {
  return exactKeys(motion, [
    'cause', 'from', 'to', 'x', 'y', 'z', 'projectedY', 'arrival'
  ]) && MOTION_CAUSES.includes(motion.cause)
    && validPoint(motion.from) && validPoint(motion.to)
    && ['x', 'y', 'z', 'projectedY'].every(key => Number.isFinite(motion[key]))
    && exactKeys(motion.arrival, ['state', 'routeIndex', 'anchorOffset'])
    && ['perched', 'ground-forage'].includes(motion.arrival.state)
    && Number.isInteger(motion.arrival.routeIndex)
    && Number.isInteger(motion.arrival.anchorOffset);
}

function validGroundGroup(group) {
  return group === null || (exactKeys(group, [
    'id', 'center', 'actorIds', 'armed', 'startled', 'cooldownElapsedMilliseconds',
    'selectionAttempts'
  ]) && group.id === 'forest-ground-flock-v1-01'
    && exactKeys(group.center, ['worldX', 'worldY'])
    && Number.isSafeInteger(group.center.worldX) && Number.isSafeInteger(group.center.worldY)
    && Array.isArray(group.actorIds) && group.actorIds.length === FOREST_TRANSIENT_GROUND_BIRD_COUNT
    && group.actorIds.every(id => /^forest-bird-v2-\d{2}$/.test(id))
    && typeof group.armed === 'boolean' && typeof group.startled === 'boolean'
    && Number.isFinite(group.cooldownElapsedMilliseconds)
    && Number.isInteger(group.selectionAttempts));
}

export function validateForestTransientLife(life) {
  if (!exactKeys(life, [
    'version', 'seed', 'randomState', 'elapsedMilliseconds', 'remainderMilliseconds', 'actors',
    'groundGroup', 'diagnostics'
  ]) || life.version !== FOREST_TRANSIENT_LIFE_VERSION
    || typeof life.seed !== 'string' || life.seed.length > 200
    || !Number.isInteger(life.randomState) || life.randomState < 0
    || !Number.isFinite(life.elapsedMilliseconds)
    || !Number.isFinite(life.remainderMilliseconds)
    || !Array.isArray(life.actors) || life.actors.length > FOREST_TRANSIENT_BIRD_LIMIT
    || !validGroundGroup(life.groundGroup)
    || !exactKeys(life.diagnostics, [
      'autonomousTransitions', 'playerStartledTransitions', 'branchHops',
      'selectionExhaustions', 'suppressedByReducedMotion', 'lastStepCount'
    ])
    || !['autonomousTransitions', 'playerStartledTransitions', 'branchHops',
      'selectionExhaustions', 'lastStepCount'].every(key => Number.isInteger(life.diagnostics[key])
        && life.diagnostics[key] >= 0)
    || typeof life.diagnostics.suppressedByReducedMotion !== 'boolean') return false;
  return life.actors.every(actor => exactKeys(actor, [
    'schemaVersion', 'id', 'kind', 'variantId', 'route', 'anchorChoice', 'groupId', 'behavior'
  ]) && actor.schemaVersion === FOREST_TRANSIENT_ACTOR_SCHEMA_VERSION
    && /^forest-bird-v2-\d{2}$/.test(actor.id)
    && actor.kind === 'bird'
    && FOREST_BIRD_VARIANTS.some(({ id }) => id === actor.variantId)
    && Array.isArray(actor.route) && actor.route.length >= 1 && actor.route.length <= 3
    && actor.route.every(id => typeof id === 'string' && id.length <= 200)
    && new Set(actor.route).size === actor.route.length
    && Number.isInteger(actor.anchorChoice)
    && (actor.groupId === null || actor.groupId === 'forest-ground-flock-v1-01')
    && exactKeys(actor.behavior, [
      'state', 'routeIndex', 'anchorOffset', 'hopsAtTree', 'elapsedMilliseconds',
      'durationMilliseconds', 'startleDelayMilliseconds', 'retreatAttempts',
      'wanderElapsedMilliseconds', 'wanderDurationMilliseconds', 'transitionCount', 'motion',
      'groundPoint'
    ]) && BIRD_STATES.includes(actor.behavior.state)
    && Number.isInteger(actor.behavior.routeIndex)
    && actor.behavior.routeIndex >= 0 && actor.behavior.routeIndex < actor.route.length
    && Number.isInteger(actor.behavior.anchorOffset) && actor.behavior.anchorOffset >= 0
    && Number.isInteger(actor.behavior.hopsAtTree) && actor.behavior.hopsAtTree >= 0
    && Number.isInteger(actor.behavior.retreatAttempts)
    && actor.behavior.retreatAttempts >= 0
    && actor.behavior.retreatAttempts <= FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS
    && ['elapsedMilliseconds', 'durationMilliseconds', 'startleDelayMilliseconds',
      'wanderElapsedMilliseconds', 'wanderDurationMilliseconds'].every(key => (
      Number.isFinite(actor.behavior[key]) && actor.behavior[key] >= 0))
    && Number.isInteger(actor.behavior.transitionCount)
    && actor.behavior.transitionCount >= 0
    && (actor.behavior.motion === null || validMotion(actor.behavior.motion))
    && (actor.behavior.groundPoint === null || validPoint(actor.behavior.groundPoint)));
}

function placementById(placements, id) {
  return placements.find(placement => placement.id === id) || null;
}

function selectedAnchor(actor, asset, placementId, anchorOffset) {
  const anchors = Array.isArray(asset?.perchAnchors)
    && asset.perchAnchors.every(validForestPerchAnchor) ? asset.perchAnchors : [];
  if (!anchors.length) return null;
  if (anchorOffset === 0 && actor.anchorChoice % 3 === 0) {
    let readable = anchors[0];
    for (let index = 1; index < anchors.length; index += 1) {
      const anchor = anchors[index];
      const distance = Math.abs(anchor.x - asset.anchor.x);
      const readableDistance = Math.abs(readable.x - asset.anchor.x);
      if (distance > readableDistance
        || (distance === readableDistance && anchor.id < readable.id)) readable = anchor;
    }
    return readable;
  }
  const base = stableHash(`${actor.anchorChoice}:${placementId}`) % anchors.length;
  return anchors[(base + anchorOffset) % anchors.length];
}

export function forestBirdPerchPoint(actor, placements, assetsByKey, routeIndex,
  anchorOffset = actor.behavior.anchorOffset) {
  const placementId = actor.route[routeIndex];
  const placement = placementById(placements, placementId);
  const asset = placement ? assetsByKey.get(placement.assetKey) : null;
  const anchor = placement && asset
    ? selectedAnchor(actor, asset, placementId, anchorOffset) : null;
  if (!placement || !asset || !anchor) return null;
  const projectedY = placement.worldY + ((anchor.y - asset.anchor.y) * placement.scale);
  const elevation = Math.max(8, placement.worldY - projectedY);
  return {
    placementId,
    anchorId: anchor.id,
    layer: anchor.layer,
    x: placement.worldX + ((anchor.x - asset.anchor.x) * placement.scale),
    y: placement.worldY,
    z: elevation,
    projectedY
  };
}

function actorPoint(actor, placements, assetsByKey) {
  if (['flight', 'branch-hop', 'ground-wander'].includes(actor.behavior.state)) {
    return actor.behavior.motion;
  }
  if (actor.behavior.state === 'ground-forage') return actor.behavior.groundPoint;
  return forestBirdPerchPoint(actor, placements, assetsByKey, actor.behavior.routeIndex);
}

function pointWithinSimulationMargin(point, viewport) {
  if (!viewport || !point) return true;
  return point.x >= viewport.x - FOREST_TRANSIENT_SIMULATION_MARGIN
    && point.x <= viewport.x + viewport.width + FOREST_TRANSIENT_SIMULATION_MARGIN
    && point.projectedY >= viewport.y - FOREST_TRANSIENT_SIMULATION_MARGIN
    && point.projectedY <= viewport.y + viewport.height + FOREST_TRANSIENT_SIMULATION_MARGIN;
}

function motionDuration(from, to, minimum = 1600, maximum = 3200) {
  const distance = Math.hypot(to.x - from.x, to.projectedY - from.projectedY);
  return Math.round(Math.max(minimum, Math.min(maximum, distance / 0.12)));
}

function beginMotion(life, actor, state, cause, from, to, arrival, durationMilliseconds) {
  if (!from || !to) {
    life.diagnostics.selectionExhaustions += 1;
    actor.behavior.elapsedMilliseconds = 0;
    actor.behavior.durationMilliseconds = 3000;
    return false;
  }
  actor.behavior.state = state;
  actor.behavior.elapsedMilliseconds = 0;
  actor.behavior.durationMilliseconds = durationMilliseconds;
  actor.behavior.motion = {
    cause, from, to, x: from.x, y: from.y, z: from.z, projectedY: from.projectedY, arrival
  };
  actor.behavior.transitionCount += 1;
  if (cause === 'player-startled') life.diagnostics.playerStartledTransitions += 1;
  else life.diagnostics.autonomousTransitions += 1;
  if (state === 'branch-hop') life.diagnostics.branchHops += 1;
  return true;
}

function beginTreeFlight(life, actor, placements, assetsByKey) {
  if (actor.route.length < 2) return false;
  const fromIndex = actor.behavior.routeIndex;
  const toIndex = (fromIndex + 1) % actor.route.length;
  const from = forestBirdPerchPoint(actor, placements, assetsByKey, fromIndex);
  const toOffset = actor.behavior.anchorOffset + 1;
  const to = forestBirdPerchPoint(actor, placements, assetsByKey, toIndex, toOffset);
  if (from?.placementId === to?.placementId) return false;
  return beginMotion(life, actor, 'flight', 'autonomous-flight', from, to, {
    state: 'perched', routeIndex: toIndex, anchorOffset: toOffset
  }, motionDuration(from, to));
}

function beginBranchHop(life, actor, placements, assetsByKey) {
  const routeIndex = actor.behavior.routeIndex;
  const from = forestBirdPerchPoint(actor, placements, assetsByKey, routeIndex);
  const toOffset = actor.behavior.anchorOffset + 1;
  const to = forestBirdPerchPoint(actor, placements, assetsByKey, routeIndex, toOffset);
  if (!from || !to || from.anchorId === to.anchorId) return false;
  return beginMotion(life, actor, 'branch-hop', 'autonomous-hop', from, to, {
    state: 'perched', routeIndex, anchorOffset: toOffset
  }, 420);
}

function beginStartledFlight(life, actor, placements, assetsByKey) {
  const routeIndex = actor.behavior.routeIndex;
  const from = actor.behavior.groundPoint;
  const to = forestBirdPerchPoint(actor, placements, assetsByKey, routeIndex, 0);
  const started = beginMotion(life, actor, 'flight', 'player-startled', from, to, {
    state: 'perched', routeIndex, anchorOffset: 0
  }, to ? motionDuration(from, to, 1200, 2600) : 1200);
  if (started) return true;
  actor.behavior.retreatAttempts += 1;
  actor.behavior.routeIndex = (routeIndex + 1) % actor.route.length;
  actor.behavior.durationMilliseconds = Math.min(
    3000, 500 * (2 ** (actor.behavior.retreatAttempts - 1))
  );
  return false;
}

function beginReturnFlight(life, actor, placements, assetsByKey) {
  const from = forestBirdPerchPoint(actor, placements, assetsByKey, actor.behavior.routeIndex);
  const to = {
    ...actor.behavior.groundPoint,
    z: 0,
    projectedY: actor.behavior.groundPoint.y
  };
  return beginMotion(life, actor, 'flight', 'autonomous-return', from, to, {
    state: 'ground-forage', routeIndex: actor.behavior.routeIndex,
    anchorOffset: actor.behavior.anchorOffset
  }, motionDuration(from, to, 1400, 2800));
}

function completeMotion(life, actor) {
  const { arrival, cause } = actor.behavior.motion;
  if (arrival.state === 'ground-forage') actor.behavior.groundPoint = actor.behavior.motion.to;
  actor.behavior.state = arrival.state;
  actor.behavior.routeIndex = arrival.routeIndex;
  actor.behavior.anchorOffset = arrival.anchorOffset;
  actor.behavior.hopsAtTree = cause === 'autonomous-hop'
    ? actor.behavior.hopsAtTree + 1 : 0;
  actor.behavior.elapsedMilliseconds = 0;
  actor.behavior.durationMilliseconds = arrival.state === 'ground-forage' ? 12000
    : 7000 + ((actor.anchorChoice + actor.behavior.transitionCount * 977) % 7500);
  actor.behavior.motion = null;
  actor.behavior.transitionCount += 1;
  if (cause === 'player-startled') life.diagnostics.playerStartledTransitions += 1;
  else life.diagnostics.autonomousTransitions += 1;
}

function updateMotion(life, actor) {
  const behavior = actor.behavior;
  behavior.elapsedMilliseconds = Math.min(
    behavior.durationMilliseconds,
    behavior.elapsedMilliseconds + FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS
  );
  const progress = behavior.elapsedMilliseconds / behavior.durationMilliseconds;
  const { from, to } = behavior.motion;
  const arcHeight = behavior.state === 'branch-hop' ? 6
    : behavior.state === 'ground-wander' ? 2 : 34;
  const arc = Math.sin(progress * Math.PI) * arcHeight;
  behavior.motion.x = from.x + ((to.x - from.x) * progress);
  behavior.motion.y = from.y + ((to.y - from.y) * progress);
  behavior.motion.z = from.z + ((to.z - from.z) * progress) + arc;
  behavior.motion.projectedY = behavior.motion.y - behavior.motion.z;
  if (progress >= 1) completeMotion(life, actor);
}

function groundGroupActors(life) {
  if (!life.groundGroup) return [];
  const ids = new Set(life.groundGroup.actorIds);
  return life.actors.filter(({ id }) => ids.has(id));
}

function groundActorPoint(actor) {
  return actor.behavior.state === 'ground-wander'
    ? actor.behavior.motion : actor.behavior.groundPoint;
}

function updateGroundGroupCenter(group, actors) {
  const points = actors.map(groundActorPoint).filter(Boolean);
  if (!points.length) return;
  group.center = {
    worldX: Math.round(points.reduce((sum, point) => sum + point.x, 0) / points.length),
    worldY: Math.round(points.reduce((sum, point) => sum + point.y, 0) / points.length)
  };
}

function beginGroundWander(life, actor, flockMate, scene, objects) {
  const from = actor.behavior.groundPoint;
  const matePoint = groundActorPoint(flockMate);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = nextSessionUnit(life) * Math.PI * 2;
    const distance = 8 + Math.round(nextSessionUnit(life) * 22);
    const to = {
      ...from,
      x: Math.round(from.x + (Math.cos(angle) * distance)),
      y: Math.round(from.y + (Math.sin(angle) * distance))
    };
    to.projectedY = to.y;
    const spacing = Math.hypot(to.x - matePoint.x, to.y - matePoint.y);
    if (spacing < 14 || spacing > 64 || !forestTransientGroundSuitability(scene, {
      worldX: to.x, worldY: to.y
    }, objects).valid) continue;
    actor.behavior.wanderElapsedMilliseconds = 0;
    actor.behavior.wanderDurationMilliseconds = 2500
      + Math.round(nextSessionUnit(life) * 5000);
    return beginMotion(
      life,
      actor,
      'ground-wander',
      'session-wander',
      from,
      to,
      {
        state: 'ground-forage', routeIndex: actor.behavior.routeIndex,
        anchorOffset: actor.behavior.anchorOffset
      },
      380 + Math.round(nextSessionUnit(life) * 340)
    );
  }
  life.diagnostics.selectionExhaustions += 1;
  actor.behavior.wanderElapsedMilliseconds = 0;
  actor.behavior.wanderDurationMilliseconds = 1800 + Math.round(nextSessionUnit(life) * 1800);
  return false;
}

function assignNearestRetreatRoutes(actors, placements, seed) {
  const suitable = placements.filter(placementIsBirdSuitable);
  const reserved = new Set();
  actors.forEach((actor) => {
    const point = actor.behavior.groundPoint;
    const nearest = [...suitable].sort((left, right) => (
      Math.hypot(left.worldX - point.x, left.worldY - point.y)
        - Math.hypot(right.worldX - point.x, right.worldY - point.y)
        || stableHash(`${seed}:${actor.id}:retreat:${left.id}`)
          - stableHash(`${seed}:${actor.id}:retreat:${right.id}`)
        || left.id.localeCompare(right.id)
    ));
    const primary = nearest.find(({ id }) => !reserved.has(id)) || nearest[0];
    if (!primary) return;
    reserved.add(primary.id);
    actor.route = [primary, ...nearest.filter(({ id }) => id !== primary.id).slice(0, 2)]
      .map(({ id }) => id);
    actor.behavior.routeIndex = 0;
    actor.behavior.anchorOffset = 0;
    actor.behavior.retreatAttempts = 0;
  });
}

function settleWanderingActor(actor) {
  if (actor.behavior.state !== 'ground-wander') return;
  actor.behavior.groundPoint = {
    ...actor.behavior.groundPoint,
    x: actor.behavior.motion.x,
    y: actor.behavior.motion.y,
    z: actor.behavior.motion.z,
    projectedY: actor.behavior.motion.projectedY
  };
  actor.behavior.state = 'ground-forage';
  actor.behavior.motion = null;
  actor.behavior.elapsedMilliseconds = 0;
}

function updateGroundGroup(life, scene, objects, placements, assetsByKey, player, viewport) {
  const group = life.groundGroup;
  if (!group || !player) return;
  const actors = groundGroupActors(life);
  updateGroundGroupCenter(group, actors);
  if (!pointWithinSimulationMargin({
    x: group.center.worldX,
    projectedY: group.center.worldY
  }, viewport)) return;
  const distance = Math.hypot(
    player.worldX - group.center.worldX, player.worldY - group.center.worldY
  );
  if (!group.startled) {
    if (!group.armed && distance > FOREST_TRANSIENT_STARTLE_RESET_RADIUS) group.armed = true;
    if (group.armed && distance <= FOREST_TRANSIENT_STARTLE_RADIUS) {
      group.armed = false;
      group.startled = true;
      actors.forEach((actor) => {
        settleWanderingActor(actor);
        actor.behavior.elapsedMilliseconds = 0;
        actor.behavior.durationMilliseconds = actor.behavior.startleDelayMilliseconds;
      });
      updateGroundGroupCenter(group, actors);
      assignNearestRetreatRoutes(actors, placements, life.seed);
    }
  }
  if (!group.startled) {
    if (!actors.some(actor => actor.behavior.state === 'ground-wander')) {
      const due = actors.find((actor) => {
        actor.behavior.wanderElapsedMilliseconds += FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
        return actor.behavior.wanderElapsedMilliseconds
          >= actor.behavior.wanderDurationMilliseconds;
      });
      if (due) beginGroundWander(
        life, due, actors.find(actor => actor !== due), scene, objects
      );
    }
    return;
  }

  for (const actor of actors) {
    if (actor.behavior.state === 'ground-forage'
      && group.cooldownElapsedMilliseconds === 0) {
      actor.behavior.elapsedMilliseconds += FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
      if (actor.behavior.retreatAttempts < FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS
        && actor.behavior.elapsedMilliseconds >= actor.behavior.durationMilliseconds) {
        beginStartledFlight(life, actor, placements, assetsByKey);
      }
    }
  }
  if (actors.every(actor => actor.behavior.state === 'perched')) {
    group.cooldownElapsedMilliseconds += FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
  }
  if (group.cooldownElapsedMilliseconds >= 26000
    && distance > FOREST_TRANSIENT_STARTLE_RESET_RADIUS
    && !actors.some(actor => actor.behavior.state === 'flight')) {
    const returning = actors.find(actor => actor.behavior.state === 'perched');
    if (returning) beginReturnFlight(life, returning, placements, assetsByKey);
  }
  const retreatExhausted = actors.some(actor => actor.behavior.state === 'ground-forage'
    && actor.behavior.retreatAttempts >= FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS);
  if (retreatExhausted && !actors.some(actor => actor.behavior.state === 'flight')) {
    const returning = actors.find(actor => actor.behavior.state === 'perched');
    if (returning) beginReturnFlight(life, returning, placements, assetsByKey);
  }
  const retreatPending = actors.some(actor => actor.behavior.state === 'ground-forage'
    && actor.behavior.retreatAttempts > 0
    && actor.behavior.retreatAttempts < FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS);
  if (actors.every(actor => actor.behavior.state === 'ground-forage') && !retreatPending) {
    group.startled = false;
    group.cooldownElapsedMilliseconds = 0;
    actors.forEach((actor) => {
      actor.behavior.wanderElapsedMilliseconds = 0;
      actor.behavior.wanderDurationMilliseconds = 2500
        + Math.round(nextSessionUnit(life) * 5000);
    });
    updateGroundGroupCenter(group, actors);
    group.armed = distance > FOREST_TRANSIENT_STARTLE_RESET_RADIUS;
  }
}

function updateStep(life, scene, objects, placements, assetsByKey, viewport, player) {
  updateGroundGroup(life, scene, objects, placements, assetsByKey, player, viewport);
  let transitionStarted = life.actors.some(actor => (
    ['flight', 'branch-hop', 'ground-wander'].includes(actor.behavior.state)
  ));
  for (const actor of life.actors) {
    const behavior = actor.behavior;
    const point = actorPoint(actor, placements, assetsByKey);
    if (!pointWithinSimulationMargin(point, viewport)) continue;
    if (['flight', 'branch-hop', 'ground-wander'].includes(behavior.state)) {
      updateMotion(life, actor);
      continue;
    }
    if (behavior.state === 'ground-forage') {
      if (!life.groundGroup?.startled) {
        behavior.elapsedMilliseconds = (behavior.elapsedMilliseconds
          + FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS) % 2600;
      }
      continue;
    }
    if (actor.groupId && life.groundGroup?.startled) {
      continue;
    }
    behavior.elapsedMilliseconds += FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
    if (!transitionStarted && behavior.elapsedMilliseconds >= behavior.durationMilliseconds) {
      const shouldHop = behavior.hopsAtTree < 2
        && stableHash(`${actor.id}:${behavior.transitionCount}:hop`) % 100 < 55;
      transitionStarted = shouldHop
        ? beginBranchHop(life, actor, placements, assetsByKey)
          || beginTreeFlight(life, actor, placements, assetsByKey)
        : beginTreeFlight(life, actor, placements, assetsByKey);
    }
  }
}

export function advanceForestTransientLife(life, {
  elapsedMilliseconds = 0,
  scene = null,
  objects = [],
  placements = [],
  assetsByKey = new Map(),
  viewport = null,
  player = null,
  documentHidden = false,
  reducedMotion = false
} = {}) {
  life.diagnostics.suppressedByReducedMotion = reducedMotion;
  life.diagnostics.lastStepCount = 0;
  if (documentHidden || reducedMotion || elapsedMilliseconds <= 0) return life;
  life.remainderMilliseconds += Math.min(
    elapsedMilliseconds,
    FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS * FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE
  );
  while (life.remainderMilliseconds >= FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS
    && life.diagnostics.lastStepCount < FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE) {
    updateStep(life, scene, objects, placements, assetsByKey, viewport, player);
    life.remainderMilliseconds -= FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
    life.elapsedMilliseconds += FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
    life.diagnostics.lastStepCount += 1;
  }
  return life;
}

export function forestTransientBirdsForTree(life, placementId, reducedMotion = false) {
  const limit = reducedMotion ? FOREST_TRANSIENT_VISIBLE_REDUCED_MOTION_LIMIT : life.actors.length;
  return life.actors.slice(0, limit).filter(actor => (
    ['perched', 'branch-hop'].includes(actor.behavior.state)
      && actor.route[actor.behavior.routeIndex] === placementId
  ));
}

export function forestTransientFlights(life, viewport, reducedMotion = false) {
  const limit = reducedMotion ? FOREST_TRANSIENT_VISIBLE_REDUCED_MOTION_LIMIT : life.actors.length;
  return life.actors.slice(0, limit).filter(actor => actor.behavior.state === 'flight'
    && pointWithinSimulationMargin(actor.behavior.motion, viewport));
}

export function forestTransientGroundBirds(life, viewport, reducedMotion = false) {
  if (reducedMotion) return [];
  return life.actors.filter(actor => ['ground-forage', 'ground-wander'].includes(
    actor.behavior.state
  ) && pointWithinSimulationMargin(
    actor.behavior.state === 'ground-wander' ? actor.behavior.motion : actor.behavior.groundPoint,
    viewport
  ));
}

export function forestTransientFlightAboveBridgeRails(actor, crossings = []) {
  if (actor?.behavior?.state !== 'flight' || !actor.behavior.motion) return false;
  const point = actor.behavior.motion;
  return crossings.some(crossing => forestBridgeContains(crossing, {
    worldX: point.x, worldY: point.y
  }, 32) && point.z > crossing.maximumElevationPixels + 34);
}

export function forestTransientDepthItems(life, viewport, reducedMotion = false, crossings = []) {
  const flights = forestTransientFlights(life, viewport, reducedMotion);
  const highBridgeFlights = flights.filter(actor => (
    forestTransientFlightAboveBridgeRails(actor, crossings)
  ));
  const items = [
    ...forestTransientGroundBirds(life, viewport, reducedMotion).map(actor => ({
      kind: 'transient-ground-bird', id: actor.id,
      worldY: actor.behavior.state === 'ground-wander'
        ? actor.behavior.motion.y : actor.behavior.groundPoint.y, actor
    })),
    ...flights.filter(actor => !highBridgeFlights.includes(actor)).map(actor => ({
      kind: 'transient-flight', id: actor.id,
      worldY: actor.behavior.motion.y + actor.behavior.motion.z, actor
    }))
  ];
  return { items, highBridgeFlights };
}

export function forestTransientLifeDiagnostic(life) {
  const counts = Object.fromEntries(BIRD_STATES.map(state => [
    state, life.actors.filter(actor => actor.behavior.state === state).length
  ]));
  return {
    count: life.actors.length,
    counts,
    autonomousTransitions: life.diagnostics.autonomousTransitions,
    playerStartledTransitions: life.diagnostics.playerStartledTransitions,
    branchHops: life.diagnostics.branchHops,
    selectionExhaustions: life.diagnostics.selectionExhaustions,
    suppressedByReducedMotion: life.diagnostics.suppressedByReducedMotion,
    groundGroup: life.groundGroup ? (life.groundGroup.startled ? 'retreating-or-away'
      : life.groundGroup.armed ? 'foraging-armed' : 'foraging-calm') : 'unavailable'
  };
}

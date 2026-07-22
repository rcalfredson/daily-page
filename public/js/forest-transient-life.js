export const FOREST_TRANSIENT_LIFE_VERSION = 1;
export const FOREST_TRANSIENT_ACTOR_SCHEMA_VERSION = 1;
export const FOREST_TRANSIENT_BIRD_LIMIT = 4;
export const FOREST_TRANSIENT_VISIBLE_REDUCED_MOTION_LIMIT = 2;
export const FOREST_TRANSIENT_SIMULATION_MARGIN = 160;
export const FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS = 50;
export const FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE = 4;

export const FOREST_BIRD_VARIANTS = Object.freeze([
  Object.freeze({ id: 'moss-cap', body: '#63714d', wing: '#394b40', breast: '#d7c58f' }),
  Object.freeze({ id: 'rust-breast', body: '#8d6748', wing: '#3f4d45', breast: '#dda66c' }),
  Object.freeze({ id: 'blue-shadow', body: '#647987', wing: '#354957', breast: '#d5cfaa' })
]);

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function routeFor(candidates, actorIndex, seed) {
  if (!candidates.length) return [];
  const source = candidates[actorIndex % candidates.length];
  const neighbors = candidates.filter(({ id }) => id !== source.id).sort((left, right) => (
    Math.hypot(left.worldX - source.worldX, left.worldY - source.worldY)
      - Math.hypot(right.worldX - source.worldX, right.worldY - source.worldY)
      || stableHash(`${seed}:${source.id}:route:${left.id}`)
        - stableHash(`${seed}:${source.id}:route:${right.id}`)
      || left.id.localeCompare(right.id)
  ));
  return [source.id, ...neighbors.slice(0, 2).map(({ id }) => id)];
}

export function createForestTransientLife(scene) {
  const candidates = castCandidates(scene);
  const count = Math.min(FOREST_TRANSIENT_BIRD_LIMIT, candidates.length);
  const actors = Array.from({ length: count }, (_, index) => {
    const identitySeed = stableHash(`${scene.seed}:bird:${index}`);
    return {
      schemaVersion: FOREST_TRANSIENT_ACTOR_SCHEMA_VERSION,
      id: `forest-bird-v1-${String(index + 1).padStart(2, '0')}`,
      kind: 'bird',
      variantId: FOREST_BIRD_VARIANTS[identitySeed % FOREST_BIRD_VARIANTS.length].id,
      route: routeFor(candidates, index, scene.seed),
      anchorChoice: identitySeed,
      behavior: {
        state: 'perched',
        routeIndex: 0,
        elapsedMilliseconds: 0,
        durationMilliseconds: 6500 + (identitySeed % 5500),
        transitionCount: 0,
        flight: null
      }
    };
  });
  return {
    version: FOREST_TRANSIENT_LIFE_VERSION,
    seed: `${scene.seed}:transient-life-v${FOREST_TRANSIENT_LIFE_VERSION}`,
    elapsedMilliseconds: 0,
    remainderMilliseconds: 0,
    actors,
    diagnostics: {
      autonomousTransitions: 0,
      playerStartledTransitions: 0,
      selectionExhaustions: count < FOREST_TRANSIENT_BIRD_LIMIT ? 1 : 0,
      suppressedByReducedMotion: false,
      lastStepCount: 0
    }
  };
}

export function validateForestTransientLife(life) {
  if (!exactKeys(life, [
    'version', 'seed', 'elapsedMilliseconds', 'remainderMilliseconds', 'actors', 'diagnostics'
  ]) || life.version !== FOREST_TRANSIENT_LIFE_VERSION
    || typeof life.seed !== 'string' || life.seed.length > 200
    || !Number.isFinite(life.elapsedMilliseconds)
    || !Number.isFinite(life.remainderMilliseconds)
    || !Array.isArray(life.actors) || life.actors.length > FOREST_TRANSIENT_BIRD_LIMIT
    || !exactKeys(life.diagnostics, [
      'autonomousTransitions', 'playerStartledTransitions', 'selectionExhaustions',
      'suppressedByReducedMotion', 'lastStepCount'
    ])
    || !['autonomousTransitions', 'playerStartledTransitions', 'selectionExhaustions',
      'lastStepCount'].every(key => Number.isInteger(life.diagnostics[key])
        && life.diagnostics[key] >= 0)
    || typeof life.diagnostics.suppressedByReducedMotion !== 'boolean') return false;
  return life.actors.every(actor => exactKeys(actor, [
    'schemaVersion', 'id', 'kind', 'variantId', 'route', 'anchorChoice', 'behavior'
  ]) && actor.schemaVersion === FOREST_TRANSIENT_ACTOR_SCHEMA_VERSION
    && /^forest-bird-v1-\d{2}$/.test(actor.id)
    && actor.kind === 'bird'
    && FOREST_BIRD_VARIANTS.some(({ id }) => id === actor.variantId)
    && Array.isArray(actor.route) && actor.route.length >= 1 && actor.route.length <= 3
    && actor.route.every(id => typeof id === 'string' && id.length <= 200)
    && new Set(actor.route).size === actor.route.length
    && Number.isInteger(actor.anchorChoice)
    && exactKeys(actor.behavior, [
      'state', 'routeIndex', 'elapsedMilliseconds', 'durationMilliseconds',
      'transitionCount', 'flight'
    ]) && ['perched', 'flight'].includes(actor.behavior.state)
    && Number.isInteger(actor.behavior.routeIndex)
    && actor.behavior.routeIndex >= 0 && actor.behavior.routeIndex < actor.route.length
    && Number.isFinite(actor.behavior.elapsedMilliseconds)
    && actor.behavior.elapsedMilliseconds >= 0
    && Number.isFinite(actor.behavior.durationMilliseconds)
    && actor.behavior.durationMilliseconds >= 0
    && Number.isInteger(actor.behavior.transitionCount)
    && actor.behavior.transitionCount >= 0
    && (actor.behavior.state === 'perched' ? actor.behavior.flight === null
      : validFlight(actor.behavior.flight)));
}

function validFlightPoint(point) {
  return exactKeys(point, ['placementId', 'anchorId', 'layer', 'x', 'y', 'z', 'projectedY'])
    && typeof point.placementId === 'string' && point.placementId.length <= 200
    && /^perch-\d{3}$/.test(point.anchorId)
    && ['behind-wood', 'front-of-wood'].includes(point.layer)
    && ['x', 'y', 'z', 'projectedY'].every(key => Number.isFinite(point[key]));
}

function validFlight(flight) {
  return exactKeys(flight, ['from', 'to', 'x', 'y', 'z', 'projectedY'])
    && validFlightPoint(flight.from) && validFlightPoint(flight.to)
    && ['x', 'y', 'z', 'projectedY'].every(key => Number.isFinite(flight[key]));
}

function placementById(placements, id) {
  return placements.find(placement => placement.id === id) || null;
}

export function forestBirdPerchPoint(actor, placements, assetsByKey, routeIndex) {
  const placementId = actor.route[routeIndex];
  const placement = placementById(placements, placementId);
  const asset = placement ? assetsByKey.get(placement.assetKey) : null;
  const anchors = Array.isArray(asset?.perchAnchors)
    && asset.perchAnchors.every(validForestPerchAnchor) ? asset.perchAnchors : [];
  if (!placement || !asset || !anchors.length) return null;
  const anchor = anchors[stableHash(`${actor.anchorChoice}:${placementId}`) % anchors.length];
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

function pointWithinSimulationMargin(point, viewport) {
  if (!viewport || !point) return true;
  return point.x >= viewport.x - FOREST_TRANSIENT_SIMULATION_MARGIN
    && point.x <= viewport.x + viewport.width + FOREST_TRANSIENT_SIMULATION_MARGIN
    && point.projectedY >= viewport.y - FOREST_TRANSIENT_SIMULATION_MARGIN
    && point.projectedY <= viewport.y + viewport.height + FOREST_TRANSIENT_SIMULATION_MARGIN;
}

function beginFlight(life, actor, placements, assetsByKey) {
  if (actor.route.length < 2) return false;
  const fromIndex = actor.behavior.routeIndex;
  const toIndex = (fromIndex + 1) % actor.route.length;
  const from = forestBirdPerchPoint(actor, placements, assetsByKey, fromIndex);
  const to = forestBirdPerchPoint(actor, placements, assetsByKey, toIndex);
  if (!from || !to || from.placementId === to.placementId) {
    life.diagnostics.selectionExhaustions += 1;
    actor.behavior.elapsedMilliseconds = 0;
    actor.behavior.durationMilliseconds = 3000;
    return false;
  }
  actor.behavior.state = 'flight';
  actor.behavior.elapsedMilliseconds = 0;
  const distance = Math.hypot(to.x - from.x, to.projectedY - from.projectedY);
  actor.behavior.durationMilliseconds = Math.round(Math.max(1600, Math.min(3200,
    distance / 0.12
  )));
  actor.behavior.flight = { from, to, x: from.x, y: from.y, z: from.z, projectedY: from.projectedY };
  actor.behavior.transitionCount += 1;
  life.diagnostics.autonomousTransitions += 1;
  return true;
}

function updateFlight(life, actor, milliseconds) {
  const behavior = actor.behavior;
  behavior.elapsedMilliseconds = Math.min(
    behavior.durationMilliseconds, behavior.elapsedMilliseconds + milliseconds
  );
  const progress = behavior.elapsedMilliseconds / behavior.durationMilliseconds;
  const { from, to } = behavior.flight;
  const arc = Math.sin(progress * Math.PI) * 34;
  behavior.flight.x = from.x + ((to.x - from.x) * progress);
  behavior.flight.y = from.y + ((to.y - from.y) * progress);
  behavior.flight.z = from.z + ((to.z - from.z) * progress) + arc;
  behavior.flight.projectedY = behavior.flight.y - behavior.flight.z;
  if (progress < 1) return;
  behavior.state = 'perched';
  behavior.routeIndex = (behavior.routeIndex + 1) % actor.route.length;
  behavior.elapsedMilliseconds = 0;
  behavior.durationMilliseconds = 9000 + ((actor.anchorChoice + behavior.transitionCount * 977)
    % 8500);
  behavior.flight = null;
  behavior.transitionCount += 1;
  life.diagnostics.autonomousTransitions += 1;
}

function updateStep(life, placements, assetsByKey, viewport) {
  let transitionStarted = life.actors.some(actor => actor.behavior.state === 'flight');
  for (const actor of life.actors) {
    const behavior = actor.behavior;
    const point = behavior.state === 'flight' ? behavior.flight
      : forestBirdPerchPoint(actor, placements, assetsByKey, behavior.routeIndex);
    if (!pointWithinSimulationMargin(point, viewport)) continue;
    if (behavior.state === 'flight') {
      updateFlight(life, actor, FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS);
      continue;
    }
    behavior.elapsedMilliseconds += FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
    if (!transitionStarted && behavior.elapsedMilliseconds >= behavior.durationMilliseconds) {
      transitionStarted = beginFlight(life, actor, placements, assetsByKey);
    }
  }
}

export function advanceForestTransientLife(life, {
  elapsedMilliseconds = 0,
  placements = [],
  assetsByKey = new Map(),
  viewport = null,
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
    updateStep(life, placements, assetsByKey, viewport);
    life.remainderMilliseconds -= FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
    life.elapsedMilliseconds += FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS;
    life.diagnostics.lastStepCount += 1;
  }
  return life;
}

export function forestTransientBirdsForTree(life, placementId, reducedMotion = false) {
  const limit = reducedMotion ? FOREST_TRANSIENT_VISIBLE_REDUCED_MOTION_LIMIT : life.actors.length;
  return life.actors.slice(0, limit).filter(actor => actor.behavior.state === 'perched'
    && actor.route[actor.behavior.routeIndex] === placementId);
}

export function forestTransientBirdForTree(life, placementId, reducedMotion = false) {
  const limit = reducedMotion ? FOREST_TRANSIENT_VISIBLE_REDUCED_MOTION_LIMIT : life.actors.length;
  for (let index = 0; index < limit; index += 1) {
    const actor = life.actors[index];
    if (actor.behavior.state === 'perched'
      && actor.route[actor.behavior.routeIndex] === placementId) return actor;
  }
  return null;
}

export function forestTransientFlights(life, viewport, reducedMotion = false) {
  const limit = reducedMotion ? FOREST_TRANSIENT_VISIBLE_REDUCED_MOTION_LIMIT : life.actors.length;
  return life.actors.slice(0, limit).filter(actor => actor.behavior.state === 'flight'
    && pointWithinSimulationMargin(actor.behavior.flight, viewport));
}

export function forestTransientFlight(life, viewport, reducedMotion = false) {
  const limit = reducedMotion ? FOREST_TRANSIENT_VISIBLE_REDUCED_MOTION_LIMIT : life.actors.length;
  for (let index = 0; index < limit; index += 1) {
    const actor = life.actors[index];
    if (actor.behavior.state === 'flight'
      && pointWithinSimulationMargin(actor.behavior.flight, viewport)) return actor;
  }
  return null;
}

export function forestTransientLifeDiagnostic(life) {
  const counts = Object.fromEntries(['perched', 'flight'].map(state => [
    state, life.actors.filter(actor => actor.behavior.state === state).length
  ]));
  return {
    count: life.actors.length,
    counts,
    autonomousTransitions: life.diagnostics.autonomousTransitions,
    playerStartledTransitions: life.diagnostics.playerStartledTransitions,
    selectionExhaustions: life.diagnostics.selectionExhaustions,
    suppressedByReducedMotion: life.diagnostics.suppressedByReducedMotion
  };
}

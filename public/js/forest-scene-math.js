import {
  FOREST_MARKER_INTERACTION_RADIUS,
  FOREST_SEED_POD_LANTERN_TYPE,
  FOREST_STONE_BENCH_TYPE,
  FOREST_TRAIL_SIGN_TYPE,
  FOREST_STEPPING_STONE_TYPE
} from './forest-world-overlay.js';
import {
  FOREST_CLEARING_OBJECT_DEFINITIONS,
  FOREST_CLEARING_OBJECT_INTERACTION_RADIUS
} from './forest-clearing-objects.js';
import {
  FOREST_DISCOVERY_PICKUP_RADIUS,
  FOREST_DISCOVERY_TYPE
} from './forest-discoveries.js';
import {
  FOREST_BOULDER_TYPE,
  forestBridgeContains,
  forestBridgeRailCollides,
  forestStreamWaterContains
} from './forest-environment.js';

export function placementVisualRect(placement, asset) {
  const scale = placement.scale;
  return {
    x: placement.worldX + ((asset.bounds.x - asset.anchor.x) * scale),
    y: placement.worldY + ((asset.bounds.y - asset.anchor.y) * scale),
    width: asset.bounds.width * scale,
    height: asset.bounds.height * scale
  };
}

export function visibleForestPlacements(placements, assetsByKey, viewport, margin = 24) {
  return placements.filter((placement) => {
    const asset = assetsByKey.get(placement.assetKey);
    if (!asset) return false;
    const rect = placementVisualRect(placement, asset);
    return rect.x + rect.width >= viewport.x - margin
      && rect.x <= viewport.x + viewport.width + margin
      && rect.y + rect.height >= viewport.y - margin
      && rect.y <= viewport.y + viewport.height + margin;
  }).sort((left, right) => (
    left.worldY - right.worldY || left.id.localeCompare(right.id)
  ));
}

export function visibleForestObjects(objects, viewport, margin = 24) {
  return objects.filter((object) => {
    const horizontalRadius = object.type === FOREST_BOULDER_TYPE ? Math.ceil(object.width / 2)
      : object.type === FOREST_STEPPING_STONE_TYPE ? 14
      : object.type === FOREST_DISCOVERY_TYPE ? 10
        : object.type === FOREST_STONE_BENCH_TYPE ? 24 : 16;
    const upperRadius = object.type === FOREST_BOULDER_TYPE ? object.height
      : object.type === FOREST_STEPPING_STONE_TYPE ? 7
      : object.type === FOREST_DISCOVERY_TYPE ? 10
        : object.type === FOREST_SEED_POD_LANTERN_TYPE ? 48 : 32;
    const lowerRadius = object.type === FOREST_BOULDER_TYPE ? 8
      : object.type === FOREST_STEPPING_STONE_TYPE ? 7
      : object.type === FOREST_DISCOVERY_TYPE ? 8 : 28;
    return (
      object.worldX + horizontalRadius
      >= viewport.x - margin
      && object.worldX - horizontalRadius
        <= viewport.x + viewport.width + margin
      && object.worldY + lowerRadius
        >= viewport.y - margin
      && object.worldY - upperRadius
        <= viewport.y + viewport.height + margin
    );
  }).sort((left, right) => left.worldY - right.worldY || left.id.localeCompare(right.id));
}

export const FOREST_AMBIENT_WIND = Object.freeze({
  maximumDisplacement: 2,
  minimumAmplitude: 0.45,
  maximumAmplitude: 1,
  minimumSpeed: 0.72,
  maximumSpeed: 1.08
});

function placementHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function placementUnit(placement, decision) {
  return placementHash(`${placement.id}:${placement.worldX}:${placement.worldY}:${decision}`)
    / 4294967296;
}

export function forestPlacementWindParameters(placement) {
  const amplitudeRange = FOREST_AMBIENT_WIND.maximumAmplitude
    - FOREST_AMBIENT_WIND.minimumAmplitude;
  const speedRange = FOREST_AMBIENT_WIND.maximumSpeed - FOREST_AMBIENT_WIND.minimumSpeed;
  return Object.freeze({
    phase: placementUnit(placement, 'phase') * Math.PI * 2,
    speed: FOREST_AMBIENT_WIND.minimumSpeed + (placementUnit(placement, 'speed') * speedRange),
    amplitude: FOREST_AMBIENT_WIND.minimumAmplitude
      + (placementUnit(placement, 'amplitude') * amplitudeRange)
  });
}

export function forestAmbientWindSignal(time) {
  return (Math.sin(time * 0.55) * 0.72) + (Math.sin((time * 0.21) + 1.4) * 0.28);
}

export function forestFoliageMotionGroupDisplacement(
  parameters, group, elapsedSeconds, active = true
) {
  if (!active) return 0;
  const phaseOffset = group.windResponse?.phaseOffset || 0;
  const response = group.windResponse?.amplitude ?? 1;
  const signal = forestAmbientWindSignal(
    (elapsedSeconds * parameters.speed) + parameters.phase + phaseOffset
  );
  return Math.round(
    FOREST_AMBIENT_WIND.maximumDisplacement * parameters.amplitude * response * signal
  );
}

export function forestLanternGlowIntensity(lantern, elapsedSeconds, active = true) {
  if (!active) return 0.56;
  const phase = (placementHash(lantern.id) / 4294967296) * Math.PI * 2;
  const slowPulse = Math.sin((elapsedSeconds * 2.4) + phase) * 0.09;
  const flameFlicker = Math.sin((elapsedSeconds * 7.1) + (phase * 1.7)) * 0.04;
  return Math.max(0.4, Math.min(0.72, 0.56 + slowPulse + flameFlicker));
}

export function forestAmbientMotionActive({ documentHidden = false, reducedMotion = false } = {}) {
  return !documentHidden && !reducedMotion;
}

export function createForestVisibilityCache(placements, assetsByKey, margin = 24,
  initialObjects = []) {
  let cached = null;
  let invalidated = true;
  let revision = 0;
  let snapshot = null;
  let objects = initialObjects;

  return {
    invalidate() {
      invalidated = true;
    },
    setObjects(nextObjects) {
      objects = nextObjects;
      invalidated = true;
    },
    read(viewport, player) {
      const changed = invalidated || !snapshot
        || snapshot.x !== viewport.x || snapshot.y !== viewport.y
        || snapshot.width !== viewport.width || snapshot.height !== viewport.height
        || snapshot.playerWorldY !== player.worldY || snapshot.assetCount !== assetsByKey.size;
      if (changed) {
        const visible = visibleForestPlacements(placements, assetsByKey, viewport, margin);
        const visibleObjects = visibleForestObjects(objects, viewport, margin);
        revision += 1;
        cached = {
          visible,
          visibleObjects,
          depthOrder: forestDepthOrder(visible, player, visibleObjects),
          revision
        };
        snapshot = {
          x: viewport.x,
          y: viewport.y,
          width: viewport.width,
          height: viewport.height,
          playerWorldY: player.worldY,
          assetCount: assetsByKey.size
        };
        invalidated = false;
      }
      return cached;
    }
  };
}

export function forestSceneCellId(column, row) {
  return `${column}:${row}`;
}

export function forestScenePlacementCellId(placement, cellSize) {
  return forestSceneCellId(
    Math.floor(placement.worldX / cellSize),
    Math.floor(placement.worldY / cellSize)
  );
}

export function forestSceneCellIdsForViewport(
  viewport, world, cellSize, preloadCellCount = 0
) {
  const maximumColumn = Math.max(0, Math.ceil(world.width / cellSize) - 1);
  const maximumRow = Math.max(0, Math.ceil(world.height / cellSize) - 1);
  const firstColumn = Math.max(0, Math.floor(viewport.x / cellSize) - preloadCellCount);
  const lastColumn = Math.min(maximumColumn,
    Math.floor((viewport.x + Math.max(0, viewport.width - 1)) / cellSize)
      + preloadCellCount);
  const firstRow = Math.max(0, Math.floor(viewport.y / cellSize) - preloadCellCount);
  const lastRow = Math.min(maximumRow,
    Math.floor((viewport.y + Math.max(0, viewport.height - 1)) / cellSize)
      + preloadCellCount);
  const ids = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      ids.push(forestSceneCellId(column, row));
    }
  }
  return ids;
}

export function forestSceneAssetKeysForCells(
  placements, cellIds, cellSize, excludedAssetKeys = []
) {
  const requestedCells = new Set(cellIds);
  const excluded = new Set(excludedAssetKeys);
  return [...new Set(placements.filter((placement) => requestedCells.has(
    forestScenePlacementCellId(placement, cellSize)
  )).map(({ assetKey }) => assetKey).filter((assetKey) => !excluded.has(assetKey)))];
}

export function normalizedMovement(keys) {
  const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

export const FOREST_TOUCH_DEAD_ZONE = 10;
export const FOREST_TOUCH_FULL_SPEED_DISTANCE = 46;

export function touchMovement(deltaX, deltaY, deadZone = FOREST_TOUCH_DEAD_ZONE,
  fullSpeedDistance = FOREST_TOUCH_FULL_SPEED_DISTANCE) {
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= deadZone) return { x: 0, y: 0 };
  const intensity = Math.min(1, (distance - deadZone)
    / Math.max(1, fullSpeedDistance - deadZone));
  return { x: (deltaX / distance) * intensity, y: (deltaY / distance) * intensity };
}

export function forestTouchGestureIntent(maximumDistance,
  deadZone = FOREST_TOUCH_DEAD_ZONE) {
  return Number.isFinite(maximumDistance) && maximumDistance <= deadZone ? 'tap' : 'drag';
}

export function playerCollides(player, placements) {
  return placements.some((placement) => (
    Math.hypot(player.worldX - placement.worldX, player.worldY - placement.worldY)
      < player.radius + placement.collisionRadius
  ));
}

export function forestTerrainTraversableAt(scene, position) {
  if (!scene?.environment) return true;
  const crossings = scene.crossings || (scene.crossing ? [scene.crossing] : []);
  if (crossings.some(crossing => forestBridgeRailCollides(
    crossing, position, position.radius || 0
  ))) return false;
  if (!forestStreamWaterContains(scene.environment, position, position.radius || 0)) return true;
  return crossings.some(crossing => forestBridgeContains(
    crossing, position, -(position.radius || 0)
  ));
}

export function moveForestPlayer(player, direction, elapsedSeconds, world, placements,
  scene = null) {
  const distance = player.movementSpeed * elapsedSeconds;
  const next = { ...player };
  const limits = {
    left: player.radius,
    right: world.width - player.radius,
    top: player.radius,
    bottom: world.height - player.radius
  };
  const candidateX = {
    ...next,
    worldX: Math.max(limits.left, Math.min(limits.right, next.worldX + direction.x * distance))
  };
  if (!playerCollides(candidateX, placements)
    && forestTerrainTraversableAt(scene, candidateX)) next.worldX = candidateX.worldX;
  const candidateY = {
    ...next,
    worldY: Math.max(limits.top, Math.min(limits.bottom, next.worldY + direction.y * distance))
  };
  if (!playerCollides(candidateY, placements)
    && forestTerrainTraversableAt(scene, candidateY)) next.worldY = candidateY.worldY;
  return next;
}

export function cameraFollowingPlayer(player, viewport, world) {
  return {
    ...viewport,
    x: Math.max(0, Math.min(Math.max(0, world.width - viewport.width),
      Math.round(player.worldX - viewport.width / 2))),
    y: Math.max(0, Math.min(Math.max(0, world.height - viewport.height),
      Math.round(player.worldY - viewport.height / 2)))
  };
}

export function focusedForestPlacement(player, placements, interactionRadius) {
  return placements.map((placement) => ({
    placement,
    distance: Math.hypot(player.worldX - placement.worldX, player.worldY - placement.worldY)
  })).filter(({ placement, distance }) => (
    distance <= interactionRadius + placement.collisionRadius
  )).sort((left, right) => (
    left.distance - right.distance || left.placement.id.localeCompare(right.placement.id)
  ))[0]?.placement || null;
}

export function focusedForestSceneItem(
  player, placements, objects, treeInteractionRadius, discoveries = []
) {
  const candidates = [
    ...placements.map((placement) => ({
      kind: 'tree', id: placement.id, value: placement,
      distance: Math.hypot(player.worldX - placement.worldX, player.worldY - placement.worldY),
      reach: treeInteractionRadius + placement.collisionRadius
    })),
    ...objects.filter(({ type }) => type !== FOREST_STEPPING_STONE_TYPE).map((object) => ({
      kind: object.type || 'marker', id: object.id, value: object,
      distance: Math.hypot(player.worldX - object.worldX, player.worldY - object.worldY),
      reach: [FOREST_TRAIL_SIGN_TYPE, FOREST_STONE_BENCH_TYPE,
        FOREST_SEED_POD_LANTERN_TYPE].includes(object.type)
        ? FOREST_CLEARING_OBJECT_INTERACTION_RADIUS : FOREST_MARKER_INTERACTION_RADIUS
    })),
    ...discoveries.map((discovery) => ({
      kind: FOREST_DISCOVERY_TYPE, id: discovery.id, value: discovery,
      distance: Math.hypot(player.worldX - discovery.worldX, player.worldY - discovery.worldY),
      reach: FOREST_DISCOVERY_PICKUP_RADIUS
    }))
  ];
  return candidates.filter(({ distance, reach }) => distance <= reach)
    .sort((left, right) => left.distance - right.distance
      || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))[0] || null;
}

export function forestSolidClearingPlacements(objects) {
  return objects.filter(({ type }) => type === FOREST_STONE_BENCH_TYPE).map((object) => ({
    ...object, collisionRadius: FOREST_CLEARING_OBJECT_DEFINITIONS[object.type].collisionRadius
  }));
}

export function forestDepthOrder(placements, player, objects = []) {
  return [
    ...placements.map((placement) => ({ kind: 'tree', id: placement.id,
      worldY: placement.worldY, placement })),
    ...objects.map((object) => ({ kind: object.type || 'marker', id: object.id,
      worldY: object.worldY, object })),
    { kind: 'player', id: '~player', worldY: player.worldY, player }
  ].sort((left, right) => left.worldY - right.worldY
    || (left.kind === right.kind ? left.id.localeCompare(right.id)
      : left.kind === 'player' ? 1 : right.kind === 'player' ? -1
        : left.kind.localeCompare(right.kind)));
}

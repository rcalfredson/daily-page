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

export function forestAmbientMotionActive({ documentHidden = false, reducedMotion = false } = {}) {
  return !documentHidden && !reducedMotion;
}

export function createForestVisibilityCache(placements, assetsByKey, margin = 24) {
  let cached = null;
  let invalidated = true;
  let revision = 0;
  let snapshot = null;

  return {
    invalidate() {
      invalidated = true;
    },
    read(viewport, player) {
      const changed = invalidated || !snapshot
        || snapshot.x !== viewport.x || snapshot.y !== viewport.y
        || snapshot.width !== viewport.width || snapshot.height !== viewport.height
        || snapshot.playerWorldY !== player.worldY || snapshot.assetCount !== assetsByKey.size;
      if (changed) {
        const visible = visibleForestPlacements(placements, assetsByKey, viewport, margin);
        revision += 1;
        cached = { visible, depthOrder: forestDepthOrder(visible, player), revision };
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

export function touchMovement(deltaX, deltaY, deadZone = 10) {
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= deadZone) return { x: 0, y: 0 };
  return { x: deltaX / distance, y: deltaY / distance };
}

export function playerCollides(player, placements) {
  return placements.some((placement) => (
    Math.hypot(player.worldX - placement.worldX, player.worldY - placement.worldY)
      < player.radius + placement.collisionRadius
  ));
}

export function moveForestPlayer(player, direction, elapsedSeconds, world, placements) {
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
  if (!playerCollides(candidateX, placements)) next.worldX = candidateX.worldX;
  const candidateY = {
    ...next,
    worldY: Math.max(limits.top, Math.min(limits.bottom, next.worldY + direction.y * distance))
  };
  if (!playerCollides(candidateY, placements)) next.worldY = candidateY.worldY;
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

export function forestDepthOrder(placements, player) {
  return [
    ...placements.map((placement) => ({ kind: 'tree', id: placement.id,
      worldY: placement.worldY, placement })),
    { kind: 'player', id: '~player', worldY: player.worldY, player }
  ].sort((left, right) => left.worldY - right.worldY
    || (left.kind === right.kind ? left.id.localeCompare(right.id) : left.kind === 'player' ? 1 : -1));
}

export const OWNER_FOREST_COORDINATE_LIMIT = 1_000_000_000;
export const OWNER_FOREST_MARKER_RADIUS = 9;
export const OWNER_FOREST_MARKER_GAP = 8;
export const OWNER_FOREST_MARKER_MINIMUM_SPACING = 26;
export const OWNER_FOREST_MARKER_CELL_CAP = 128;
export const OWNER_FOREST_MARKER_PREVIEW_DISTANCE = 40;

export function createOwnerForestMarkerObjectId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID().toLowerCase();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${
    hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function ownerForestCellsAround(position, cellSize) {
  const centerX = Math.floor(position.worldX / cellSize);
  const centerY = Math.floor(position.worldY / cellSize);
  const cells = [];
  for (let cellY = centerY - 1; cellY <= centerY + 1; cellY += 1) {
    for (let cellX = centerX - 1; cellX <= centerX + 1; cellX += 1) {
      cells.push({ cellX, cellY });
    }
  }
  return cells;
}

export function ownerForestCellId(cell) {
  return `${cell.cellX}:${cell.cellY}`;
}

export function ownerForestAssetBatches(assetKeys, maximumBatchSize) {
  const unique = [...new Set(assetKeys)];
  const batches = [];
  for (let index = 0; index < unique.length; index += maximumBatchSize) {
    batches.push(unique.slice(index, index + maximumBatchSize));
  }
  return batches;
}

export function ownerForestMovementDirection({
  inspectionOpen,
  keyboardDirection,
  pointerDirection,
}) {
  if (inspectionOpen) return { x: 0, y: 0 };
  return keyboardDirection.x || keyboardDirection.y
    ? keyboardDirection
    : pointerDirection;
}

export function ownerForestJoystickOffset(deltaX, deltaY, maximumDistance = 34) {
  const distance = Math.hypot(deltaX, deltaY);
  if (!Number.isFinite(distance) || distance === 0) return { x: 0, y: 0 };
  const scale = Math.min(maximumDistance, distance) / distance;
  return { x: deltaX * scale, y: deltaY * scale };
}

export async function decodeOwnerForestRaster(source, dependencies = {}) {
  const bitmapDecoder = dependencies.createImageBitmap ?? globalThis.createImageBitmap;
  if (typeof bitmapDecoder === 'function') {
    try {
      return await bitmapDecoder(source);
    } catch {
      // Some browsers expose createImageBitmap but reject otherwise valid PNG blobs.
    }
  }

  const image = dependencies.createImage ? dependencies.createImage() : new Image();
  const urlApi = dependencies.urlApi || URL;
  const url = urlApi.createObjectURL(source);
  return new Promise((resolve, reject) => {
    image.onload = () => {
      urlApi.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      urlApi.revokeObjectURL(url);
      reject(new Error('Owner forest raster decoding failed.'));
    };
    image.src = url;
  });
}

function collides(position, placements) {
  return placements.some(placement => Math.hypot(
    position.worldX - placement.worldX,
    position.worldY - placement.worldY
  ) < position.radius + placement.collisionRadius);
}

export function moveOwnerForestPlayer(player, direction, elapsedSeconds, placements) {
  const distance = player.movementSpeed * Math.max(0, elapsedSeconds);
  const next = { ...player };
  const candidateX = {
    ...next,
    worldX: Math.max(-OWNER_FOREST_COORDINATE_LIMIT, Math.min(
      OWNER_FOREST_COORDINATE_LIMIT, next.worldX + (direction.x * distance)
    ))
  };
  if (!collides(candidateX, placements)) next.worldX = candidateX.worldX;
  const candidateY = {
    ...next,
    worldY: Math.max(-OWNER_FOREST_COORDINATE_LIMIT, Math.min(
      OWNER_FOREST_COORDINATE_LIMIT, next.worldY + (direction.y * distance)
    ))
  };
  if (!collides(candidateY, placements)) next.worldY = candidateY.worldY;
  return next;
}

export function ownerForestCamera(player, viewport) {
  return {
    ...viewport,
    x: Math.round(player.worldX - (viewport.width / 2)),
    y: Math.round(player.worldY - (viewport.height / 2))
  };
}

export function ownerForestPlacementAtPoint({
  point,
  player,
  placements,
  assetsByKey,
  interactionRadius,
}) {
  return placements.map((placement) => {
    const asset = assetsByKey.get(placement.assetKey);
    if (!asset) return null;
    const scale = placement.scale;
    const left = placement.worldX - (asset.anchor.x * scale);
    const top = placement.worldY - (asset.anchor.y * scale);
    const width = asset.dimensions.width * scale;
    const height = asset.dimensions.height * scale;
    const ownerDistance = Math.hypot(
      player.worldX - placement.worldX,
      player.worldY - placement.worldY,
    );
    if (ownerDistance > interactionRadius + placement.collisionRadius
      || point.worldX < left
      || point.worldX > left + width
      || point.worldY < top
      || point.worldY > top + height) {
      return null;
    }
    return {
      placement,
      pointDistance: Math.hypot(
        point.worldX - placement.worldX,
        point.worldY - placement.worldY,
      ),
    };
  }).filter(Boolean).sort((left, right) => (
    left.pointDistance - right.pointDistance
      || right.placement.worldY - left.placement.worldY
      || left.placement.id.localeCompare(right.placement.id)
  ))[0]?.placement || null;
}

export function ownerForestMarkerPreview({
  player,
  facingRadians,
  placements,
  markers,
  cellSize,
  movingObjectId = null
}) {
  const direction = Number.isFinite(facingRadians) ? facingRadians : Math.PI / 2;
  const worldX = Math.round(
    player.worldX + (Math.cos(direction) * OWNER_FOREST_MARKER_PREVIEW_DISTANCE)
  );
  const worldY = Math.round(
    player.worldY + (Math.sin(direction) * OWNER_FOREST_MARKER_PREVIEW_DISTANCE)
  );
  let reason = null;
  if (Math.abs(worldX) > OWNER_FOREST_COORDINATE_LIMIT
    || Math.abs(worldY) > OWNER_FOREST_COORDINATE_LIMIT) {
    reason = 'world-bounds';
  } else if (placements.some(placement => Math.hypot(
    worldX - placement.worldX,
    worldY - placement.worldY
  ) < placement.collisionRadius + OWNER_FOREST_MARKER_RADIUS + OWNER_FOREST_MARKER_GAP)) {
    reason = 'tree-collision';
  } else if (markers.some(marker => marker.objectId !== movingObjectId && Math.hypot(
    worldX - marker.worldX,
    worldY - marker.worldY
  ) < OWNER_FOREST_MARKER_MINIMUM_SPACING)) {
    reason = 'marker-collision';
  } else {
    const cellX = Math.floor(worldX / cellSize);
    const cellY = Math.floor(worldY / cellSize);
    const count = markers.filter(marker => marker.objectId !== movingObjectId
      && Math.floor(marker.worldX / cellSize) === cellX
      && Math.floor(marker.worldY / cellSize) === cellY).length;
    if (count >= OWNER_FOREST_MARKER_CELL_CAP) reason = 'density';
  }
  return { worldX, worldY, valid: reason === null, reason };
}

export function ownerForestFocusedMarker(player, markers, interactionRadius) {
  return markers.map(marker => ({
    marker,
    distance: Math.hypot(player.worldX - marker.worldX, player.worldY - marker.worldY)
  })).filter(({ distance }) => distance <= interactionRadius + OWNER_FOREST_MARKER_RADIUS)
    .sort((left, right) => left.distance - right.distance
      || left.marker.objectId.localeCompare(right.marker.objectId))[0]?.marker || null;
}

export function ownerForestMarkerAtPoint({ point, player, markers, interactionRadius }) {
  return markers.map(marker => {
    const ownerDistance = Math.hypot(
      player.worldX - marker.worldX,
      player.worldY - marker.worldY
    );
    if (ownerDistance > interactionRadius + OWNER_FOREST_MARKER_RADIUS
      || point.worldX < marker.worldX - 10
      || point.worldX > marker.worldX + 10
      || point.worldY < marker.worldY - 29
      || point.worldY > marker.worldY + 4) return null;
    return {
      marker,
      pointDistance: Math.hypot(point.worldX - marker.worldX, point.worldY - marker.worldY)
    };
  }).filter(Boolean).sort((left, right) => left.pointDistance - right.pointDistance
    || left.marker.objectId.localeCompare(right.marker.objectId))[0]?.marker || null;
}

export function replaceOwnerForestAuthoredRegion(markersById, requestedRegionIds, markers) {
  const requested = new Set(requestedRegionIds);
  for (const [objectId, marker] of markersById) {
    if (requested.has(marker.regionId)) markersById.delete(objectId);
  }
  for (const marker of markers) markersById.set(marker.objectId, marker);
  return markersById;
}

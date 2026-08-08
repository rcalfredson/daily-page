export const OWNER_FOREST_COORDINATE_LIMIT = 1_000_000_000;

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

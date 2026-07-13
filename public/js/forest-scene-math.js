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

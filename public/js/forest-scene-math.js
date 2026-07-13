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

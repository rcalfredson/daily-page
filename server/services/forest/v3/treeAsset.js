export const FOREST_TREE_ASSET_SCHEMA_VERSION = 3;
export const FOREST_RENDERER_ID = 'daily-page-forest-v3';
export const FOREST_TREE_MAX_PERCH_ANCHORS = 5;

export function deriveForestTreePerchAnchors(generationResult) {
  const { nodes, segments, wood } = generationResult;
  return segments.filter((segment) => {
    const from = nodes[segment.fromId];
    const to = nodes[segment.toId];
    const horizontal = Math.abs(to.x - from.x);
    const vertical = Math.abs(to.y - from.y);
    return segment.generation >= 1
      && segment.radius >= 0.5
      && horizontal >= 2.25
      && vertical <= horizontal * 0.85
      && Math.min(from.y, to.y) <= wood.groundY - 20;
  }).map((segment) => {
    const from = nodes[segment.fromId];
    const to = nodes[segment.toId];
    const x = Math.round((from.x + to.x) / 2);
    const y = Math.round((from.y + to.y) / 2);
    const depth = Math.round(((from.depth + to.depth) / 2) * 10) / 10;
    return {
      id: `perch-${String(segment.toId).padStart(3, '0')}`,
      x,
      y,
      depth,
      layer: depth < 0 ? 'behind-wood' : 'front-of-wood'
    };
  }).sort((left, right) => (
    left.y - right.y || Math.abs(left.x - generationResult.nodes[0].x)
      - Math.abs(right.x - generationResult.nodes[0].x) || left.id.localeCompare(right.id)
  )).filter((anchor, index, anchors) => (
    anchors.slice(0, index).every(other => Math.hypot(
      anchor.x - other.x, anchor.y - other.y
    ) >= 9)
  )).slice(0, FOREST_TREE_MAX_PERCH_ANCHORS);
}

function visualBounds(layers, width, height) {
  const runs = layers.flatMap(layer => (
    layer.motionGroups?.flatMap(group => group.runs) || layer.runs
  ));
  if (!runs.length) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...runs.map(run => run.x));
  const top = Math.min(...runs.map(run => run.y));
  const right = Math.max(...runs.map(run => run.x + run.width));
  const bottom = Math.min(height, Math.max(...runs.map(run => run.y + 1)));
  return { x: left, y: top, width: Math.min(width, right) - left, height: bottom - top };
}

export function treeAssetCacheKey({
  seed,
  rendererVersion,
  phenotypeId,
  phenotypeAssetVersion,
  schemaVersion = FOREST_TREE_ASSET_SCHEMA_VERSION,
  meaningProjection = null
}) {
  if (!phenotypeId || !Number.isInteger(phenotypeAssetVersion)) {
    throw new Error('Cached tree assets require an explicit phenotype id and asset version.');
  }
  if (meaningProjection && (!Number.isInteger(meaningProjection.version)
    || meaningProjection.version < 1
    || typeof meaningProjection.visualFingerprint !== 'string'
    || meaningProjection.visualFingerprint.length > 200
    || !/^[a-z0-9@._:-]+$/i.test(meaningProjection.visualFingerprint))) {
    throw new Error('Projected tree assets require a bounded meaning-projection identity.');
  }
  return [
    `tree-asset-v${schemaVersion}`,
    `${FOREST_RENDERER_ID}@${rendererVersion}`,
    `${phenotypeId}@${phenotypeAssetVersion}`,
    `seed-${seed >>> 0}`,
    meaningProjection
      ? `meaning-v${meaningProjection.version}-${meaningProjection.visualFingerprint}` : null
  ].filter(Boolean).join(':');
}

export function buildForestTreeAsset(generationResult) {
  const { phenotype, rendererVersion, seed, wood, foliage, architecture } = generationResult;
  const cacheKey = treeAssetCacheKey({
    seed,
    rendererVersion,
    phenotypeId: phenotype.id,
    phenotypeAssetVersion: phenotype.assetVersion,
    meaningProjection: generationResult.meaningProjectionIdentity
  });
  const layers = [
    { id: 'rear-foliage', motionGroups: foliage.backMotionGroups },
    { id: 'wood', runs: wood.runs },
    { id: 'front-foliage', motionGroups: foliage.frontMotionGroups }
  ];
  return {
    schemaVersion: FOREST_TREE_ASSET_SCHEMA_VERSION,
    renderer: { id: FOREST_RENDERER_ID, version: rendererVersion },
    phenotype: { id: phenotype.id, version: phenotype.assetVersion },
    seed,
    cacheKey,
    dimensions: { width: wood.width, height: wood.height },
    anchor: { x: generationResult.nodes[0].x, y: wood.groundY },
    bounds: visualBounds(layers, wood.width, wood.height),
    perchAnchors: deriveForestTreePerchAnchors(generationResult),
    layers,
    identity: {
      architecture: {
        branchStartHeight: architecture.branchStartHeight,
        trunkBaseRadius: architecture.trunkBaseRadius,
        trunkTaper: architecture.trunkTaper,
        trunkLeanAngle: architecture.trunkLeanAngle,
        trunkLeanAzimuth: architecture.trunkLeanAzimuth,
        hasSplitTrunk: architecture.hasSplitTrunk,
        splitTrunkHeight: architecture.splitTrunkHeight,
        splitTrunkAngle: architecture.splitTrunkAngle,
        splitTrunkAzimuth: architecture.splitTrunkAzimuth,
        leaderBalance: architecture.leaderBalance,
        dominantLeaderIndex: architecture.dominantLeaderIndex
      },
      maximumBranchOrder: Math.max(...generationResult.nodes.map(node => node.generation))
    }
  };
}

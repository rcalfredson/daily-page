export const FOREST_TREE_ASSET_SCHEMA_VERSION = 1;
export const FOREST_RENDERER_ID = 'daily-page-forest-v3';

function visualBounds(layers, width, height) {
  const runs = layers.flatMap(layer => layer.runs);
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
  schemaVersion = FOREST_TREE_ASSET_SCHEMA_VERSION
}) {
  if (!phenotypeId || !Number.isInteger(phenotypeAssetVersion)) {
    throw new Error('Cached tree assets require an explicit phenotype id and asset version.');
  }
  return [
    `tree-asset-v${schemaVersion}`,
    `${FOREST_RENDERER_ID}@${rendererVersion}`,
    `${phenotypeId}@${phenotypeAssetVersion}`,
    `seed-${seed >>> 0}`
  ].join(':');
}

export function buildForestTreeAsset(generationResult) {
  const { phenotype, rendererVersion, seed, wood, foliage, architecture } = generationResult;
  const cacheKey = treeAssetCacheKey({
    seed,
    rendererVersion,
    phenotypeId: phenotype.id,
    phenotypeAssetVersion: phenotype.assetVersion
  });
  const layers = [
    { id: 'rear-foliage', runs: foliage.backRuns },
    { id: 'wood', runs: wood.runs },
    { id: 'front-foliage', runs: foliage.frontRuns }
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

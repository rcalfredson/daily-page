import { performance } from 'node:perf_hooks';

import { generateForestTreeAssetV3 } from './forestTreeGeneratorV3.js';
import {
  DECIDUOUS_PHENOTYPE,
  LANTERNWOOD_PHENOTYPE
} from './forest/v3/phenotype.js';

// Scene-owned, process-local runtime assets. No graphs or diagnostics are retained.
const sceneAssetCache = new Map();
const phenotypesById = new Map([
  [DECIDUOUS_PHENOTYPE.id, DECIDUOUS_PHENOTYPE],
  [LANTERNWOOD_PHENOTYPE.id, LANTERNWOOD_PHENOTYPE]
]);

export function clearForestSceneAssetPool() {
  sceneAssetCache.clear();
}

export function forestSceneAssetPoolSize() {
  return sceneAssetCache.size;
}

export function prepareForestSceneAssets(placements) {
  const startedAt = performance.now();
  const assets = [];
  const required = new Map(placements.map((placement) => [placement.assetKey, placement]));
  let generatedAssetCount = 0;

  for (const [assetKey, placement] of required) {
    if (!sceneAssetCache.has(assetKey)) {
      const phenotype = phenotypesById.get(placement.phenotypeId);
      if (!phenotype) throw new Error(`Unknown forest phenotype: ${placement.phenotypeId}`);
      const asset = generateForestTreeAssetV3(
        { id: `forest-scene-specimen-${placement.treeSeed}` },
        { seed: placement.treeSeed, phenotype }
      );
      if (asset.cacheKey !== assetKey) throw new Error('Prepared tree asset identity mismatch.');
      sceneAssetCache.set(assetKey, asset);
      generatedAssetCount += 1;
    }
    assets.push(sceneAssetCache.get(assetKey));
  }

  return {
    assets: JSON.parse(JSON.stringify(assets)),
    diagnostics: {
      durationMilliseconds: performance.now() - startedAt,
      generatedAssetCount,
      reusedAssetCount: required.size - generatedAssetCount,
      preparedAssetCount: required.size
    }
  };
}

export function prepareForestSceneWithDiagnostics(layout) {
  const startedAt = performance.now();
  const { assets, diagnostics } = prepareForestSceneAssets(layout.placements);
  const scene = JSON.parse(JSON.stringify({ ...layout, assets }));
  return {
    scene,
    diagnostics: {
      ...diagnostics,
      durationMilliseconds: performance.now() - startedAt
    }
  };
}

export function prepareForestScene(layout) {
  return prepareForestSceneWithDiagnostics(layout).scene;
}

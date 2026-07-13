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

export function prepareForestScene(layout) {
  const assets = [];
  const required = new Map(layout.placements.map((placement) => [placement.assetKey, placement]));

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
    }
    assets.push(sceneAssetCache.get(assetKey));
  }

  return JSON.parse(JSON.stringify({ ...layout, assets }));
}


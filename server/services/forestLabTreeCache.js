import { generateForestTreeV3 } from './forestTreeGeneratorV3.js';
import { buildForestTreeAsset, treeAssetCacheKey } from './forest/v3/treeAsset.js';
import { DECIDUOUS_PHENOTYPE } from './forest/v3/phenotype.js';
import { hashSeed } from './forest/v3/random.js';
import { FOREST_RENDERER_VERSION_V3 } from './forestTreeGeneratorV3.js';

// Process-local and development-only: entries live until the server restarts or this module is reloaded.
const fixtureCache = new Map();

export function clearForestLabTreeCache() {
  fixtureCache.clear();
}

export function forestLabTreeCacheSize() {
  return fixtureCache.size;
}

export function getForestLabTree(post, options = {}) {
  const phenotype = options.phenotype || DECIDUOUS_PHENOTYPE;
  const seed = (options.seed ?? hashSeed(`${FOREST_RENDERER_VERSION_V3}:${post.id}`)) >>> 0;
  const identity = phenotype === DECIDUOUS_PHENOTYPE
    ? { id: phenotype.id, version: phenotype.assetVersion }
    : options.phenotypeIdentity;
  const cacheable = typeof identity?.id === 'string'
    && Number.isInteger(identity?.version);
  if (!cacheable) {
    const generation = generateForestTreeV3(post, options);
    return { generation, asset: null, cacheHit: false };
  }
  const key = treeAssetCacheKey({
    seed,
    rendererVersion: FOREST_RENDERER_VERSION_V3,
    phenotypeId: identity.id,
    phenotypeAssetVersion: identity.version
  });
  if (fixtureCache.has(key)) return { ...fixtureCache.get(key), cacheHit: true };
  const identifiedPhenotype = phenotype === DECIDUOUS_PHENOTYPE ? phenotype : {
    ...phenotype,
    id: identity.id,
    assetVersion: identity.version
  };
  const generation = generateForestTreeV3(post, { ...options, seed, phenotype: identifiedPhenotype });
  const value = { generation, asset: buildForestTreeAsset(generation) };
  fixtureCache.set(key, value);
  return { ...value, cacheHit: false };
}

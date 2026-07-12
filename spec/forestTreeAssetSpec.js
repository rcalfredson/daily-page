import {
  generateForestTreeAssetV3,
  generateForestTreeV3
} from '../server/services/forestTreeGeneratorV3.js';
import {
  buildForestTreeAsset,
  FOREST_TREE_ASSET_SCHEMA_VERSION,
  treeAssetCacheKey
} from '../server/services/forest/v3/treeAsset.js';
import { DECIDUOUS_PHENOTYPE } from '../server/services/forest/v3/phenotype.js';
import {
  clearForestLabTreeCache,
  forestLabTreeCacheSize,
  getForestLabTree
} from '../server/services/forestLabTreeCache.js';

describe('v3 forest runtime tree assets', () => {
  const post = { id: 'tree-asset-post' };

  beforeEach(() => clearForestLabTreeCache());

  it('is deterministic, versioned, and exactly JSON round-trippable', () => {
    const first = generateForestTreeAssetV3(post, { seed: 101 });
    const repeated = generateForestTreeAssetV3(post, { seed: 101 });
    const roundTrip = JSON.parse(JSON.stringify(first));

    expect(first).toEqual(repeated);
    expect(roundTrip).toEqual(first);
    expect(first.schemaVersion).toBe(FOREST_TREE_ASSET_SCHEMA_VERSION);
    expect(first.layers.map(layer => layer.id)).toEqual([
      'rear-foliage', 'wood', 'front-foliage'
    ]);
    expect(first.dimensions).toEqual({ width: 96, height: 128 });
    expect(first.anchor.y).toBe(120);
    expect(first.bounds.width).toBeGreaterThan(0);
    expect(first.bounds.height).toBeGreaterThan(0);
  });

  it('contains display runs and limited identity but excludes generation diagnostics', () => {
    const asset = generateForestTreeAssetV3(post, { seed: 202 });
    const serialized = JSON.stringify(asset);

    for (const excluded of [
      'nodes', 'segments', 'attractionPoints', 'diagnostics', 'mask', 'pixels',
      'leaves', 'shoots', 'coverageCells'
    ]) expect(serialized).not.toContain(`"${excluded}"`);
    expect(asset.identity.architecture.hasSplitTrunk).toBeDefined();
    expect(asset.layers.every(layer => Array.isArray(layer.runs))).toBeTrue();
  });

  it('varies cache identity with seed, renderer, phenotype, and schema versions', () => {
    const identity = {
      seed: 1,
      rendererVersion: 3,
      phenotypeId: 'deciduous',
      phenotypeAssetVersion: 1,
      schemaVersion: 1
    };
    const key = treeAssetCacheKey(identity);

    for (const change of [
      { seed: 2 }, { rendererVersion: 4 }, { phenotypeId: 'conifer' },
      { phenotypeAssetVersion: 2 }, { schemaVersion: 2 }
    ]) expect(treeAssetCacheKey({ ...identity, ...change })).not.toBe(key);
  });

  it('builds the same visual asset from an existing generation result', () => {
    const generation = generateForestTreeV3(post, { seed: 303 });
    expect(buildForestTreeAsset(generation))
      .toEqual(generateForestTreeAssetV3(post, { seed: 303 }));
  });

  it('reuses development fixtures by visual identity, independent of post identity', () => {
    const first = getForestLabTree(post, { seed: 404 });
    const repeated = getForestLabTree({ id: 'another-post' }, { seed: 404 });

    expect(first.cacheHit).toBeFalse();
    expect(repeated.cacheHit).toBeTrue();
    expect(repeated.asset).toBe(first.asset);
    expect(repeated.generation).toBe(first.generation);
    expect(forestLabTreeCacheSize()).toBe(1);
  });

  it('does not silently cache custom phenotype overrides without a stable identity', () => {
    const custom = { ...DECIDUOUS_PHENOTYPE, maxIterations: 1 };
    const first = getForestLabTree(post, { seed: 505, phenotype: custom });
    const repeated = getForestLabTree(post, { seed: 505, phenotype: custom });

    expect(first.cacheHit).toBeFalse();
    expect(repeated.cacheHit).toBeFalse();
    expect(first.asset).toBeNull();
    expect(forestLabTreeCacheSize()).toBe(0);
  });

  it('caches explicitly identified custom phenotypes without conflating identities', () => {
    const custom = { ...DECIDUOUS_PHENOTYPE, maxIterations: 1 };
    const first = getForestLabTree(post, {
      seed: 606, phenotype: custom, phenotypeIdentity: { id: 'lab-short-growth', version: 1 }
    });
    const second = getForestLabTree(post, {
      seed: 606, phenotype: custom, phenotypeIdentity: { id: 'lab-short-growth', version: 2 }
    });

    expect(first.asset.cacheKey).not.toBe(second.asset.cacheKey);
    expect(forestLabTreeCacheSize()).toBe(2);
  });
});

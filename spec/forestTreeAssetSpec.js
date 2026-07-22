import {
  generateForestTreeAssetV3,
  generateForestTreeGraph,
  generateForestTreeV3
} from '../server/services/forestTreeGeneratorV3.js';
import {
  buildForestTreeAsset,
  FOREST_TREE_MAX_PERCH_ANCHORS,
  FOREST_TREE_ASSET_SCHEMA_VERSION,
  treeAssetCacheKey
} from '../server/services/forest/v3/treeAsset.js';
import {
  DECIDUOUS_PHENOTYPE,
  FOREST_PHENOTYPES,
  HIGHLAND_CONIFER_PHENOTYPE,
  LANTERNWOOD_PHENOTYPE,
  resolveForestPhenotype
} from '../server/services/forest/v3/phenotype.js';
import {
  FOREST_FOLIAGE_STYLES,
  selectFoliagePalette
} from '../server/services/forest/v3/rasterizeFoliage.js';
import {
  clearForestLabTreeCache,
  forestLabTreeCacheSize,
  getForestLabTree
} from '../server/services/forestLabTreeCache.js';
import { forestFixtures } from '../server/routes/devViews.js';

describe('v3 forest runtime tree assets', () => {
  const post = { id: 'tree-asset-post' };
  const layerRuns = layer => layer.motionGroups?.flatMap(group => group.runs) || layer.runs;
  const runPixels = runs => new Map(runs.flatMap(run => Array.from(
    { length: run.width }, (_, offset) => [`${run.x + offset}:${run.y}`, run.color]
  )));

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
    expect(first.perchAnchors.length).toBeGreaterThan(0);
    expect(first.perchAnchors.length).toBeLessThanOrEqual(FOREST_TREE_MAX_PERCH_ANCHORS);
  });

  it('exposes only bounded anchors that meet real generated branch pixels', () => {
    const generation = generateForestTreeV3(post, { seed: 202 });
    const asset = buildForestTreeAsset(generation);

    for (const anchor of asset.perchAnchors) {
      expect(Object.keys(anchor).sort()).toEqual(['depth', 'id', 'layer', 'x', 'y']);
      expect(anchor.layer).toBe(anchor.depth < 0 ? 'behind-wood' : 'front-of-wood');
      expect(generation.wood.mask.slice(anchor.y - 2, anchor.y + 3).some(row => (
        row.slice(anchor.x - 2, anchor.x + 3).some(Boolean)
      ))).toBeTrue();
    }
  });

  it('contains display runs and limited identity but excludes generation diagnostics', () => {
    const asset = generateForestTreeAssetV3(post, { seed: 202 });
    const serialized = JSON.stringify(asset);

    for (const excluded of [
      'nodes', 'segments', 'attractionPoints', 'diagnostics', 'mask', 'pixels',
      'leaves', 'shoots', 'coverageCells'
    ]) expect(serialized).not.toContain(`"${excluded}"`);
    expect(asset.identity.architecture.hasSplitTrunk).toBeDefined();
    expect(asset.layers.find(layer => layer.id === 'wood').runs.length).toBeGreaterThan(0);
    for (const layer of asset.layers.filter(layer => layer.id.includes('foliage'))) {
      expect(layer.runs).toBeUndefined();
      expect(layer.motionGroups.length).toBeGreaterThan(1);
      expect(layer.motionGroups.length).toBeLessThanOrEqual(3);
      for (const group of layer.motionGroups) {
        expect(group.runs.length).toBeGreaterThan(0);
        expect(group.attachment.x).toEqual(jasmine.any(Number));
        expect(group.attachment.y).toEqual(jasmine.any(Number));
        expect(group.windResponse.phaseOffset).toEqual(jasmine.any(Number));
        expect(group.windResponse.amplitude).toBeGreaterThan(0);
      }
    }
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
    const asset = buildForestTreeAsset(generation);
    expect(asset).toEqual(generateForestTreeAssetV3(post, { seed: 303 }));
    expect(runPixels(layerRuns(asset.layers[0]))).toEqual(runPixels(generation.foliage.backRuns));
    expect(runPixels(layerRuns(asset.layers[2]))).toEqual(runPixels(generation.foliage.frontRuns));
  });

  it('emits the same contract for a distinct registered phenotype', () => {
    const deciduous = generateForestTreeAssetV3(post, {
      seed: 303, phenotype: DECIDUOUS_PHENOTYPE
    });
    const lanternwood = generateForestTreeAssetV3(post, {
      seed: 303, phenotype: LANTERNWOOD_PHENOTYPE
    });

    expect(lanternwood.layers.map(layer => layer.id)).toEqual(
      deciduous.layers.map(layer => layer.id)
    );
    expect(lanternwood.dimensions).toEqual({ width: 112, height: 120 });
    expect(lanternwood.phenotype).toEqual({ id: 'sunset-lanternwood', version: 2 });
    expect(lanternwood.cacheKey).not.toBe(deciduous.cacheKey);
    const lanternColors = new Set(LANTERNWOOD_PHENOTYPE.foliagePalettes
      .flatMap(variant => Object.values(variant.colors)));
    expect(lanternwood.layers.filter(layer => layer.id.includes('foliage'))
      .flatMap(layerRuns).every(run => lanternColors.has(run.color))).toBeTrue();
  });

  it('registers and resolves every immutable phenotype once', () => {
    expect(FOREST_PHENOTYPES.map(({ id }) => id)).toEqual([
      'open-crown-deciduous',
      'sunset-lanternwood',
      'wind-shaped-highland-conifer'
    ]);
    expect(new Set(FOREST_PHENOTYPES.map(({ id }) => id)).size).toBe(FOREST_PHENOTYPES.length);
    expect(HIGHLAND_CONIFER_PHENOTYPE.assetVersion).toBe(1);
    expect(Object.isFrozen(FOREST_PHENOTYPES)).toBeTrue();
    for (const phenotype of FOREST_PHENOTYPES) {
      expect(resolveForestPhenotype(phenotype.id)).toBe(phenotype);
      expect(FOREST_FOLIAGE_STYLES).toContain(phenotype.foliageStyle);
    }
    expect(resolveForestPhenotype('unknown-tree')).toBeNull();
  });

  it('gives Forest Lab eight deterministic fixtures for every registered phenotype', () => {
    const fixtures = forestFixtures();
    const counts = Object.fromEntries(FOREST_PHENOTYPES.map(phenotype => [
      phenotype.id,
      fixtures.filter(item => item.tree.phenotype.id === phenotype.id).length
    ]));

    expect(fixtures.length).toBe(FOREST_PHENOTYPES.length * 8);
    expect(Object.values(counts).every(count => count === 8)).toBeTrue();
    expect(fixtures.every(item => item.tree.seed === item.asset.seed)).toBeTrue();
  });

  it('selects deterministic whole-tree foliage palettes with weighted rarity', () => {
    for (const phenotype of FOREST_PHENOTYPES) {
      const selections = Array.from({ length: 1000 }, (_, seed) => (
        selectFoliagePalette(phenotype, seed).id
      ));
      const repeated = Array.from({ length: 1000 }, (_, seed) => (
        selectFoliagePalette(phenotype, seed).id
      ));
      const common = phenotype.foliagePalettes[0].id;

      expect(repeated).toEqual(selections);
      expect(selections.filter(id => id === common).length).toBeGreaterThan(700);
      expect(new Set(selections)).toEqual(new Set(
        phenotype.foliagePalettes.map(variant => variant.id)
      ));
    }
  });

  it('normally completes lanternwood growth before reaching its safety cap', () => {
    const graphs = Array.from({ length: 24 }, (_, seed) => generateForestTreeGraph(post, {
      seed, phenotype: LANTERNWOOD_PHENOTYPE
    }));

    expect(graphs.filter(graph => graph.stats.terminationReason === 'node-limit').length)
      .toBeLessThan(4);
    expect(graphs.filter(graph => graph.stats.terminationReason === 'growth-exhausted').length)
      .toBeGreaterThan(18);
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

  it('caches each registered phenotype under its own identity', () => {
    const first = getForestLabTree(post, { seed: 404, phenotype: LANTERNWOOD_PHENOTYPE });
    const repeated = getForestLabTree(post, { seed: 404, phenotype: LANTERNWOOD_PHENOTYPE });
    const deciduous = getForestLabTree(post, { seed: 404, phenotype: DECIDUOUS_PHENOTYPE });
    const conifer = getForestLabTree(post, { seed: 404, phenotype: HIGHLAND_CONIFER_PHENOTYPE });

    expect(first.cacheHit).toBeFalse();
    expect(repeated.cacheHit).toBeTrue();
    expect(deciduous.cacheHit).toBeFalse();
    expect(conifer.cacheHit).toBeFalse();
    expect(forestLabTreeCacheSize()).toBe(3);
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

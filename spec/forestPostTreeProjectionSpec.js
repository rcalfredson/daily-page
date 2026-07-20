import {
  FOREST_POST_TREE_MAPPING_VERSION,
  FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION,
  projectPostToForestTree,
  selectForestPostTreePhenotype
} from '../server/services/forestPostTreeProjection.js';
import {
  generateProjectedForestTreeAssetV3,
  generateProjectedForestTreeV3
} from '../server/services/forestTreeGeneratorV3.js';
import { FOREST_PHENOTYPES } from '../server/services/forest/v3/phenotype.js';
import {
  FOREST_TREE_ASSET_SCHEMA_VERSION,
  treeAssetCacheKey
} from '../server/services/forest/v3/treeAsset.js';
import {
  clearForestLabTreeCache,
  getForestLabProjectedTree
} from '../server/services/forestLabTreeCache.js';
import {
  encodeForestSceneAssets,
  FOREST_ASSET_TRANSPORT_RASTER,
  FOREST_ASSET_TRANSPORT_RUNS
} from '../server/services/forestSceneAssetTransport.js';
import { forestFixtures, projectForestLabFixture } from '../server/routes/devViews.js';

describe('forest post-to-tree meaning projection', () => {
  const post = Object.freeze({
    id: 'meaning-contract-post',
    roomId: 'physics',
    createdAt: '2025-10-12T00:00:00.000Z',
    wordCount: 1200,
    collaboratorCount: 2,
    translationCount: 1,
    commentCount: 6,
    reactionCount: 8,
    questApproved: true
  });
  const context = Object.freeze({ habitat: 'neutral-grove' });

  beforeEach(() => clearForestLabTreeCache());

  it('is explicit, deterministic, bounded, and exactly JSON serializable', () => {
    const first = projectPostToForestTree(post, context);
    const repeated = projectPostToForestTree({ ...post }, { ...context });

    expect(first).toEqual(repeated);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first.schemaVersion).toBe(FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION);
    expect(first.mappingVersion).toBe(FOREST_POST_TREE_MAPPING_VERSION);
    expect(first.specimen.seed).toEqual(jasmine.any(Number));
    expect(first.phenotype).toEqual(jasmine.objectContaining({
      id: jasmine.any(String), version: jasmine.any(Number)
    }));
    expect(first.permanentTraits).toEqual({
      creationSeason: 'autumn', foliagePaletteId: jasmine.any(String)
    });
    expect(first.explanations.map(({ token }) => token)).toEqual([
      'stable-writing-identity', 'habitat-soft-bias', 'creation-season-tint'
    ]);
    expect(JSON.stringify(first)).not.toContain(post.id);
    expect(JSON.stringify(first)).not.toContain(post.roomId);
    expect(JSON.stringify(first)).not.toContain('1200');
  });

  it('uses a deterministic documented fallback when creation metadata is missing', () => {
    const projection = projectPostToForestTree({ id: post.id }, context);
    const tree = generateProjectedForestTreeV3(projection);

    expect(projection.permanentTraits).toEqual({
      creationSeason: 'unknown', foliagePaletteId: null
    });
    expect(tree.foliage.paletteId).toEqual(jasmine.any(String));
    expect(projection.explanations.at(-1).text).toContain('seed-selected natural tint');
  });

  it('rejects unknown fields, malformed values, unsafe numbers, and unknown context', () => {
    for (const invalid of [
      { ...post, title: 'Raw post content' },
      { ...post, id: 'x'.repeat(129) },
      { ...post, createdAt: 'October 12, 2025' },
      { ...post, commentCount: -1 },
      { ...post, reactionCount: Number.MAX_SAFE_INTEGER },
      { ...post, questApproved: 1 }
    ]) expect(() => projectPostToForestTree(invalid, context)).toThrow();
    expect(() => projectPostToForestTree(post, { habitat: 'alpine-biome' })).toThrow();
    expect(() => projectPostToForestTree(post, { habitat: 'neutral-grove', weather: 'rain' }))
      .toThrow();
    expect(() => projectPostToForestTree(post, {
      habitat: 'neutral-grove', overlay: { marker: true }
    })).toThrow();
  });

  it('derives specimen identity only from stable post identity and mapping version', () => {
    const base = projectPostToForestTree(post, context);
    const changedMetadata = projectPostToForestTree({
      ...post,
      roomId: 'history',
      wordCount: 900000,
      collaboratorCount: 100,
      translationCount: 100,
      commentCount: 1000000,
      reactionCount: 1000000,
      questApproved: false
    }, context);
    const otherPost = projectPostToForestTree({ ...post, id: 'meaning-contract-post-2' }, context);

    expect(changedMetadata).toEqual(base);
    expect(otherPost.specimen.seed).not.toBe(base.specimen.seed);
    expect(generateProjectedForestTreeAssetV3(changedMetadata))
      .toEqual(generateProjectedForestTreeAssetV3(base));
  });

  it('selects through the canonical registry independently of registry order', () => {
    const selected = selectForestPostTreePhenotype(post.id, context.habitat);
    const reversed = selectForestPostTreePhenotype(
      post.id, context.habitat, FOREST_PHENOTYPES.slice().reverse()
    );

    expect(reversed).toBe(selected);
    expect(FOREST_PHENOTYPES).toContain(selected);
  });

  it('softly biases habitats while retaining every registered phenotype', () => {
    const ids = Array.from({ length: 1200 }, (_, index) => `distribution-post-${index}`);
    const count = habitat => Object.fromEntries(FOREST_PHENOTYPES.map(phenotype => [
      phenotype.id,
      ids.filter(id => selectForestPostTreePhenotype(id, habitat).id === phenotype.id).length
    ]));
    const neutral = count('neutral-grove');
    const rocky = count('rocky-edge');

    expect(Object.values(neutral).every(value => value > 100)).toBeTrue();
    expect(Object.values(rocky).every(value => value > 100)).toBeTrue();
    expect(rocky['wind-shaped-highland-conifer'])
      .toBeGreaterThan(neutral['wind-shaped-highland-conifer']);
    expect(neutral['open-crown-deciduous']).toBeGreaterThan(rocky['open-crown-deciduous']);
  });

  it('keeps one controlled creation-season change inside phenotype-owned palette bounds', () => {
    const spring = projectPostToForestTree({
      ...post, createdAt: '2025-04-12T00:00:00.000Z'
    }, context);
    const autumn = projectPostToForestTree({
      ...post, createdAt: '2025-10-12T00:00:00.000Z'
    }, context);
    const springTree = generateProjectedForestTreeV3(spring);
    const autumnTree = generateProjectedForestTreeV3(autumn);
    const phenotype = FOREST_PHENOTYPES.find(({ id }) => id === spring.phenotype.id);

    expect(autumn.specimen).toEqual(spring.specimen);
    expect(autumn.phenotype).toEqual(spring.phenotype);
    expect(autumnTree.nodes).toEqual(springTree.nodes);
    expect(autumnTree.architecture).toEqual(springTree.architecture);
    expect(autumnTree.foliage.paletteId).not.toBe(springTree.foliage.paletteId);
    expect(phenotype.foliagePalettes.map(({ id }) => id)).toContain(springTree.foliage.paletteId);
    expect(phenotype.foliagePalettes.map(({ id }) => id)).toContain(autumnTree.foliage.paletteId);
    expect(generateProjectedForestTreeAssetV3(autumn).cacheKey)
      .not.toBe(generateProjectedForestTreeAssetV3(spring).cacheKey);
  });

  it('separates cache identity for visual decisions but not explanation-only differences', () => {
    const neutral = projectPostToForestTree({
      ...post, id: 'forest-pair-habitat'
    }, { habitat: 'neutral-grove' });
    const rocky = projectPostToForestTree({
      ...post, id: 'forest-pair-habitat'
    }, { habitat: 'rocky-edge' });
    expect(rocky.phenotype).toEqual(neutral.phenotype);
    expect(rocky.identity.projectionFingerprint).not.toBe(
      neutral.identity.projectionFingerprint
    );
    expect(generateProjectedForestTreeAssetV3(rocky).cacheKey)
      .toBe(generateProjectedForestTreeAssetV3(neutral).cacheKey);

    const identity = {
      seed: neutral.specimen.seed,
      rendererVersion: 4,
      phenotypeId: neutral.phenotype.id,
      phenotypeAssetVersion: neutral.phenotype.version,
      meaningProjection: { version: 1, visualFingerprint: 'mapping-v1:foliage-test' }
    };
    expect(treeAssetCacheKey({ ...identity, meaningProjection: {
      ...identity.meaningProjection, version: 2
    } })).not.toBe(treeAssetCacheKey(identity));
  });

  it('rejects a projected visual decision that does not match its fingerprint', () => {
    const projection = projectPostToForestTree(post, context);
    const phenotype = FOREST_PHENOTYPES.find(({ id }) => id === projection.phenotype.id);
    const otherPalette = phenotype.foliagePalettes.find(
      ({ id }) => id !== projection.permanentTraits.foliagePaletteId
    ).id;
    const tampered = {
      ...projection,
      permanentTraits: { ...projection.permanentTraits, foliagePaletteId: otherPalette }
    };

    expect(() => generateProjectedForestTreeAssetV3(tampered))
      .toThrowError('Forest post-tree projection has an invalid visual identity.');
  });

  it('keeps projection details and raw post metadata out of runtime assets', () => {
    const projection = projectPostToForestTree(post, context);
    const asset = generateProjectedForestTreeAssetV3(projection);
    const serialized = JSON.stringify(asset);

    expect(asset.schemaVersion).toBe(FOREST_TREE_ASSET_SCHEMA_VERSION);
    expect(asset.layers.map(({ id }) => id)).toEqual([
      'rear-foliage', 'wood', 'front-foliage'
    ]);
    expect(serialized).not.toContain('explanations');
    expect(serialized).not.toContain('roomId');
    expect(serialized).not.toContain(post.id);
    expect(serialized).not.toContain(post.roomId);
    expect(asset.layers.filter(layer => layer.motionGroups)
      .every(layer => layer.motionGroups.length <= 3)).toBeTrue();
  });

  it('reuses projected Lab assets by complete visual identity', () => {
    const firstProjection = projectPostToForestTree(post, context);
    const repeatedProjection = projectPostToForestTree({ ...post, reactionCount: 999 }, context);
    const first = getForestLabProjectedTree(firstProjection);
    const repeated = getForestLabProjectedTree(repeatedProjection);

    expect(first.cacheHit).toBeFalse();
    expect(repeated.cacheHit).toBeTrue();
    expect(repeated.asset).toBe(first.asset);
  });

  it('preserves projected runtime identity through both transports', async () => {
    const asset = generateProjectedForestTreeAssetV3(
      projectPostToForestTree(post, context)
    );
    const runs = await encodeForestSceneAssets([asset], FOREST_ASSET_TRANSPORT_RUNS);
    const raster = await encodeForestSceneAssets([asset], FOREST_ASSET_TRANSPORT_RASTER);

    expect(runs.assets[0]).toEqual(asset);
    expect(raster.assets[0].cacheKey).toBe(asset.cacheKey);
    expect(raster.assets[0].phenotype).toEqual(asset.phenotype);
    expect(raster.assets[0].layers.map(({ id }) => id)).toEqual(
      asset.layers.map(({ id }) => id)
    );
  });

  it('provides balanced explainable Lab fixtures and three controlled pairs', () => {
    const fixtures = forestFixtures();
    const counts = Object.fromEntries(FOREST_PHENOTYPES.map(phenotype => [
      phenotype.id, fixtures.filter(item => item.projection.phenotype.id === phenotype.id).length
    ]));
    const paired = label => fixtures.filter(({ pair }) => pair?.startsWith(label));
    const habitat = paired('Habitat pair');
    const season = paired('Creation-season pair');
    const activity = paired('Mutable-activity pair');

    expect(counts).toEqual({
      'open-crown-deciduous': 8,
      'sunset-lanternwood': 8,
      'wind-shaped-highland-conifer': 8
    });
    expect(fixtures.every(item => item.projection.explanations.length === 3)).toBeTrue();
    expect(habitat[0].projection.specimen).toEqual(habitat[1].projection.specimen);
    expect(habitat[0].projection.phenotype).not.toEqual(habitat[1].projection.phenotype);
    expect(season[0].tree.nodes).toEqual(season[1].tree.nodes);
    expect(season[0].tree.foliage.paletteId).not.toBe(season[1].tree.foliage.paletteId);
    expect(activity[0].projection).toEqual(activity[1].projection);
    expect(activity[0].asset).toBe(activity[1].asset);
  });

  it('retains bounded diagnostics for an invalid Lab fixture', () => {
    const invalid = projectForestLabFixture(post, { habitat: 'unknown-habitat' });

    expect(invalid.projection).toBeNull();
    expect(invalid.tree).toBeNull();
    expect(invalid.asset).toBeNull();
    expect(invalid.projectionError).toContain('habitat must be one of');
    expect(invalid.projectionError).not.toContain(post.id);
  });
});

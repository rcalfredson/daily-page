import { forestPostTreeFixtures } from '../server/services/forestPostTreeFixtures.js';
import { composeProjectedForestScene } from '../server/services/forestProjectedScene.js';
import {
  clearForestSceneAssetPool,
  forestSceneAssetPoolSize,
  prepareForestSceneAssets
} from '../server/services/forestSceneAssetPool.js';
import { createForestExploration } from '../server/services/forestSceneExploration.js';
import { generateForestSceneLayout } from '../server/services/forestSceneLayout.js';
import {
  encodeForestSceneAssets,
  FOREST_ASSET_TRANSPORT_RASTER,
  FOREST_ASSET_TRANSPORT_RUNS
} from '../server/services/forestSceneAssetTransport.js';
import { resolveForestPressureProfile } from '../server/services/forestScenePressure.js';

describe('projected-writing Activity Forest scene', () => {
  function projectedScene() {
    const profile = resolveForestPressureProfile('post-tree-meaning');
    const projected = composeProjectedForestScene(generateForestSceneLayout(profile.layout));
    return {
      ...projected,
      scene: createForestExploration(projected.layout, { fixtures: projected.fixtures })
    };
  }

  beforeEach(() => clearForestSceneAssetPool());

  it('defines an explicit semantic profile without changing default scene generation', () => {
    const before = generateForestSceneLayout();
    const profile = resolveForestPressureProfile('post-tree-meaning');
    const projected = projectedScene();
    const after = generateForestSceneLayout();

    expect(profile.projectedWriting).toBeTrue();
    expect(profile.pressure).toBeFalse();
    expect(projected.scene.placements.length).toBe(180);
    expect(after).toEqual(before);
    expect(before.placements.some(({ assetKey }) => assetKey.includes('meaning-v'))).toBeFalse();
  });

  it('cycles 24 inspectable fixtures through a bounded 23-asset semantic pool', () => {
    const { scene, assetProjections } = projectedScene();
    const fixtureCounts = Object.fromEntries(scene.exploration.fixtures.map(({ id }) => [
      id, scene.placements.filter(({ fixtureId }) => fixtureId === id).length
    ]));

    expect(scene.exploration.fixtures.length).toBe(24);
    expect(assetProjections.size).toBe(23);
    expect(new Set(scene.placements.map(({ assetKey }) => assetKey)).size).toBe(23);
    expect(Math.min(...Object.values(fixtureCounts))).toBe(7);
    expect(Math.max(...Object.values(fixtureCounts))).toBe(8);
    expect(new Set(scene.placements.map(({ phenotypeId }) => phenotypeId))).toEqual(new Set([
      'open-crown-deciduous',
      'sunset-lanternwood',
      'wind-shaped-highland-conifer'
    ]));
  });

  it('keeps semantic fixture assignment aligned with projected asset identity', () => {
    const fixtures = forestPostTreeFixtures();
    const byId = new Map(fixtures.map(fixture => [fixture.fixtureId, fixture]));
    const { scene } = projectedScene();

    for (const placement of scene.placements) {
      const projection = byId.get(placement.fixtureId).projection;
      expect(placement.treeSeed).toBe(projection.specimen.seed);
      expect(placement.phenotypeId).toBe(projection.phenotype.id);
      expect(placement.assetKey).toContain(
        `meaning-v${projection.mappingVersion}-${projection.identity.visualFingerprint}`
      );
    }
  });

  it('sends only placement identity and bounded inspection meaning, never projection inputs', () => {
    const { scene } = projectedScene();
    const serializedPlacements = JSON.stringify(scene.placements);
    const serializedFixtures = JSON.stringify(scene.exploration.fixtures);
    const meaning = scene.exploration.fixtures[0].treeMeaning;

    for (const excluded of [
      'habitat', 'createdAt', 'wordCount', 'collaboratorCount', 'translationCount',
      'commentCount', 'reactionCount', 'questApproved', 'explanations'
    ]) expect(serializedPlacements).not.toContain(`"${excluded}"`);
    for (const excluded of [
      'wordCount', 'collaboratorCount', 'translationCount', 'commentCount',
      'reactionCount', 'questApproved', 'projectionFingerprint', 'visualFingerprint'
    ]) expect(serializedFixtures).not.toContain(`"${excluded}"`);
    expect(meaning).toEqual(jasmine.objectContaining({
      mappingVersion: 1,
      specimenSeed: jasmine.any(Number),
      phenotypeId: jasmine.any(String),
      habitat: jasmine.any(String),
      creationSeason: jasmine.any(String),
      explanations: jasmine.any(Array)
    }));
    expect(meaning.explanations.every(({ token, text }) => token && text)).toBeTrue();
  });

  it('prepares and reuses projected assets through the normal bounded scene pool', () => {
    const { scene, assetProjections } = projectedScene();
    const cold = prepareForestSceneAssets(scene.placements, assetProjections);
    const warm = prepareForestSceneAssets(scene.placements, assetProjections);

    expect(cold.assets.length).toBe(23);
    expect(cold.diagnostics.generatedAssetCount).toBe(23);
    expect(warm.diagnostics.generatedAssetCount).toBe(0);
    expect(warm.diagnostics.reusedAssetCount).toBe(23);
    expect(forestSceneAssetPoolSize()).toBe(23);
    expect(cold.assets.every(asset => asset.cacheKey.includes('meaning-v1'))).toBeTrue();
    expect(cold.assets.every(asset => asset.layers.map(({ id }) => id).join(',')
      === 'rear-foliage,wood,front-foliage')).toBeTrue();
    expect(cold.assets.every(asset => asset.layers.filter(layer => layer.motionGroups)
      .every(layer => layer.motionGroups.length <= 3))).toBeTrue();
  });

  it('preserves projected identity through both scene transports', async () => {
    const { scene, assetProjections } = projectedScene();
    const assets = prepareForestSceneAssets(scene.placements.slice(0, 2), assetProjections).assets;
    const runs = await encodeForestSceneAssets(assets, FOREST_ASSET_TRANSPORT_RUNS);
    const rasters = await encodeForestSceneAssets(assets, FOREST_ASSET_TRANSPORT_RASTER);

    expect(runs.assets).toEqual(assets);
    expect(rasters.assets.map(({ cacheKey }) => cacheKey))
      .toEqual(assets.map(({ cacheKey }) => cacheKey));
    expect(rasters.assets.every(asset => asset.layers.map(({ id }) => id).join(',')
      === 'rear-foliage,wood,front-foliage')).toBeTrue();
  });

  it('provides a bounded accessible inspection surface for tree meaning', () => {
    const viewPath = 'views/dev/activity-forest.pug';
    const view = fs.readFileSync(viewPath, 'utf8');
    const script = fs.readFileSync('public/js/activity-forest.js', 'utf8');

    expect(() => pug.compileFile(viewPath)).not.toThrow();
    for (const field of [
      'data-forest-tree-meaning', 'data-forest-meaning-phenotype',
      'data-forest-meaning-seed', 'data-forest-meaning-habitat',
      'data-forest-meaning-tint', 'data-forest-meaning-reasons'
    ]) expect(view).toContain(field);
    expect(script).toContain('meaningSurface.hidden = !meaning');
    expect(script).toContain("meaning.habitat.replaceAll('-', ' ')");
    expect(script).not.toContain("`${meaning.habitat} · soft bias`");
    expect(script).toContain('item.textContent = explanation.text');
    expect(script).not.toContain('explanation.innerHTML');
  });

  it('rejects custom exploration fixtures when placements do not reference them', () => {
    const layout = generateForestSceneLayout({ placementCount: 1 });
    expect(() => createForestExploration(layout, { fixtures: [{
      id: 'semantic-only', title: 'Tree', roomName: 'Room',
      createdAt: '2025-01-01', excerpt: 'Writing.'
    }] })).toThrowError('Forest exploration placements require known fixture identities.');
  });
});
import fs from 'node:fs';

import pug from 'pug';

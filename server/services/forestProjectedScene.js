import { FOREST_RENDERER_VERSION_V3 } from './forestTreeGeneratorV3.js';
import { forestPostTreeFixtures } from './forestPostTreeFixtures.js';
import { treeAssetCacheKey } from './forest/v3/treeAsset.js';

function assetKeyForProjection(projection) {
  return treeAssetCacheKey({
    seed: projection.specimen.seed,
    rendererVersion: FOREST_RENDERER_VERSION_V3,
    phenotypeId: projection.phenotype.id,
    phenotypeAssetVersion: projection.phenotype.version,
    meaningProjection: {
      version: projection.mappingVersion,
      visualFingerprint: projection.identity.visualFingerprint
    }
  });
}

function writingFixture(fixture) {
  const { projection } = fixture;
  return {
    id: fixture.fixtureId,
    title: fixture.title,
    roomName: fixture.roomName,
    createdAt: fixture.post.createdAt.slice(0, 10),
    excerpt: fixture.excerpt,
    treeMeaning: {
      mappingVersion: projection.mappingVersion,
      specimenSeed: projection.specimen.seed,
      phenotypeId: projection.phenotype.id,
      habitat: projection.habitat.id,
      creationSeason: projection.permanentTraits.creationSeason,
      foliagePaletteId: projection.permanentTraits.foliagePaletteId,
      explanations: projection.explanations.map(({ token, text }) => ({ token, text }))
    }
  };
}

export function composeProjectedForestScene(
  baseLayout,
  fixtures = forestPostTreeFixtures()
) {
  if (!baseLayout?.placements?.length || !Array.isArray(fixtures) || !fixtures.length) {
    throw new Error('Projected forest scenes require placements and semantic fixtures.');
  }
  const assetProjections = new Map();
  const placements = baseLayout.placements.map((placement, index) => {
    const fixture = fixtures[index % fixtures.length];
    const { projection } = fixture;
    const assetKey = assetKeyForProjection(projection);
    if (!assetProjections.has(assetKey)) assetProjections.set(assetKey, projection);
    return {
      ...placement,
      phenotypeId: projection.phenotype.id,
      treeSeed: projection.specimen.seed,
      assetKey,
      fixtureId: fixture.fixtureId
    };
  });

  return {
    layout: { ...baseLayout, placements },
    assetProjections,
    fixtures: fixtures.map(writingFixture)
  };
}

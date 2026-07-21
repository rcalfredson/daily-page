import { FOREST_RENDERER_VERSION_V3 } from './forestTreeGeneratorV3.js';
import { forestPostTreeFixtures } from './forestPostTreeFixtures.js';
import { treeAssetCacheKey } from './forest/v3/treeAsset.js';
import { projectPostToForestTree } from './forestPostTreeProjection.js';
import { forestEnvironmentAt } from '../../public/js/forest-environment.js';

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

function environmentWritingFixture(placement, index, source) {
  const environment = forestEnvironmentAt(source.environment, {
    worldX: placement.worldX,
    worldY: placement.worldY
  });
  if (environment.habitatId !== placement.originatingHabitatId) {
    throw new Error('Writing placement habitat must come from its stable world position.');
  }
  const ordinal = String(index + 1).padStart(2, '0');
  const post = {
    id: `forest-region-writing-${ordinal}`,
    roomId: ['daily-inspiration', 'history', 'physics'][index % 3],
    createdAt: new Date(Date.UTC(2024 + (index % 3), index % 12, 4 + (index % 20)))
      .toISOString(),
    wordCount: 180 + (index * 37),
    collaboratorCount: index % 4,
    translationCount: index % 3,
    commentCount: index % 7,
    reactionCount: index % 9,
    questApproved: index % 5 === 0
  };
  const projection = projectPostToForestTree(post, { habitat: environment.habitatId });
  return {
    fixtureId: `forest-region-fixture-${ordinal}`,
    title: `Field Note from ${environment.dominantRegionId === 'rocky-rise'
      ? 'the Rocky Rise' : 'the Calm Grove'} ${ordinal}`,
    roomName: post.roomId.split('-').map(word => `${word[0].toUpperCase()}${word.slice(1)}`)
      .join(' '),
    excerpt: 'A bounded fixture showing that this writing tree inherited habitat from its position.',
    post,
    context: { habitat: environment.habitatId },
    environment,
    projection
  };
}

export function composeEnvironmentProjectedForestScene(baseLayout) {
  if (!baseLayout?.environment || !baseLayout?.placements?.length) {
    throw new Error('Environment-projected scenes require an environment-aware base layout.');
  }
  const fixtures = baseLayout.placements.map((placement, index) => (
    environmentWritingFixture(placement, index, baseLayout)
  ));
  const assetProjections = new Map();
  const placements = baseLayout.placements.map((placement, index) => {
    const fixture = fixtures[index];
    const assetKey = assetKeyForProjection(fixture.projection);
    assetProjections.set(assetKey, fixture.projection);
    return {
      ...placement,
      phenotypeId: fixture.projection.phenotype.id,
      treeSeed: fixture.projection.specimen.seed,
      assetKey,
      fixtureId: fixture.fixtureId
    };
  });
  return {
    layout: { ...baseLayout, placements },
    assetProjections,
    fixtures: fixtures.map((fixture) => {
      const writing = writingFixture(fixture);
      return {
        ...writing,
        treeMeaning: {
          ...writing.treeMeaning,
          originatingRegionId: fixture.environment.dominantRegionId,
          groundSurfaceId: fixture.environment.groundSurfaceId,
          transitionState: fixture.environment.transition.state
        }
      };
    })
  };
}

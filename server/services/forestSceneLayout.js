import { FOREST_RENDERER_VERSION_V3 } from './forestTreeGeneratorV3.js';
import {
  FOREST_PHENOTYPES,
  FOREST_PHENOTYPE_SCENE_TRAITS
} from './forest/v3/phenotype.js';
import { createRandom, hashSeed } from './forest/v3/random.js';
import { treeAssetCacheKey } from './forest/v3/treeAsset.js';
import { forestEnvironmentAt } from '../../public/js/forest-environment.js';
import {
  FOREST_TERRAIN_FEATURE_GENERATION_VERSION,
  FOREST_CROSSING_GENERATION_VERSION,
  generateForestStreamCrossings,
  generateForestTerrainFeatures
} from './forestTerrainFeatures.js';

export const FOREST_SCENE_VERSION = 1;
export const FOREST_BASE_IDENTITY_SCHEMA_VERSION = 1;

export const DEFAULT_FOREST_SCENE_CONFIG = Object.freeze({
  seed: 'first-grove',
  world: Object.freeze({ width: 3000, height: 1800 }),
  placementCount: 180,
  minimumSpacing: 76,
  edgeMargin: 90,
  corridorHalfWidth: 145,
  scale: Object.freeze({ minimum: 1, maximum: 2 }),
  specimenPoolSize: 8,
  phenotypeWeights: Object.freeze({
    ...Object.fromEntries(FOREST_PHENOTYPES.map(phenotype => [
      phenotype.id, FOREST_PHENOTYPE_SCENE_TRAITS[phenotype.id].defaultWeight
    ]).filter(([, weight]) => weight > 0))
  })
});

function decisionRandom(sceneSeed, candidateIndex, decision) {
  return createRandom(hashSeed([
    `forest-scene-v${FOREST_SCENE_VERSION}`, sceneSeed, candidateIndex, decision
  ].join(':')))();
}

export function forestCorridorCenter(worldY, worldWidth) {
  return (worldWidth / 2) + (Math.sin((worldY / 330) + 0.7) * 155);
}

export function forestBaseIdentity(config) {
  const layoutKey = hashSeed(JSON.stringify({
    world: config.world,
    placementCount: config.placementCount,
    minimumSpacing: config.minimumSpacing,
    edgeMargin: config.edgeMargin,
    corridorHalfWidth: config.corridorHalfWidth,
    scale: config.scale,
    specimenPoolSize: config.specimenPoolSize,
    assetPoolSize: config.assetPoolSize || null,
    phenotypeWeights: config.phenotypeWeights,
    environmentManifest: config.environmentManifest || null,
    terrainFeatureGenerationVersion: config.environmentManifest
      ? FOREST_TERRAIN_FEATURE_GENERATION_VERSION : null,
    crossingGenerationVersion: config.environmentManifest
      ? FOREST_CROSSING_GENERATION_VERSION : null
  })).toString(16).padStart(8, '0');
  return Object.freeze({
    schemaVersion: FOREST_BASE_IDENTITY_SCHEMA_VERSION,
    sceneVersion: FOREST_SCENE_VERSION,
    seed: config.seed,
    layoutKey
  });
}

function selectPhenotype(config, sceneSeed, candidateIndex, habitatId = null) {
  const total = FOREST_PHENOTYPES.reduce((sum, phenotype) => (
    sum + (habitatId
      ? phenotype.postTreeMeaning.habitatWeights[habitatId]
      : (config.phenotypeWeights[phenotype.id] || 0))
  ), 0);
  let selection = decisionRandom(sceneSeed, candidateIndex, 'phenotype') * total;
  return FOREST_PHENOTYPES.find((phenotype) => {
    selection -= habitatId
      ? phenotype.postTreeMeaning.habitatWeights[habitatId]
      : (config.phenotypeWeights[phenotype.id] || 0);
    return selection < 0;
  }) || FOREST_PHENOTYPES[0];
}

function specimenIdentity(config, sceneSeed, phenotype, specimenIndex) {
  const treeSeed = hashSeed([
    `forest-scene-v${FOREST_SCENE_VERSION}`, sceneSeed, phenotype.id, specimenIndex
  ].join(':'));
  return {
    treeSeed,
    assetKey: treeAssetCacheKey({
      seed: treeSeed,
      rendererVersion: FOREST_RENDERER_VERSION_V3,
      phenotypeId: phenotype.id,
      phenotypeAssetVersion: phenotype.assetVersion
    })
  };
}

function normalizeConfig(options) {
  return {
    ...DEFAULT_FOREST_SCENE_CONFIG,
    ...options,
    world: { ...DEFAULT_FOREST_SCENE_CONFIG.world, ...options.world },
    scale: { ...DEFAULT_FOREST_SCENE_CONFIG.scale, ...options.scale },
    phenotypeWeights: {
      ...DEFAULT_FOREST_SCENE_CONFIG.phenotypeWeights,
      ...options.phenotypeWeights
    }
  };
}

export function generateForestSceneLayout(options = {}) {
  const config = normalizeConfig(options);
  if (config.environmentManifest && (
    config.environmentManifest.world.width !== config.world.width
      || config.environmentManifest.world.height !== config.world.height
  )) throw new Error('Forest environment and scene world bounds must match.');
  const placements = [];
  const maximumCandidates = config.placementCount * 100;
  let densityRejectionCount = 0;
  let corridorRejectionCount = 0;
  let spacingRejectionCount = 0;
  let attemptedCandidateCount = 0;

  for (let candidateIndex = 0;
    candidateIndex < maximumCandidates && placements.length < config.placementCount;
    candidateIndex += 1) {
    const usableWidth = config.world.width - (config.edgeMargin * 2);
    const usableHeight = config.world.height - (config.edgeMargin * 2);
    const worldX = Math.round(config.edgeMargin
      + (decisionRandom(config.seed, candidateIndex, 'x') * usableWidth));
    const worldY = Math.round(config.edgeMargin
      + (decisionRandom(config.seed, candidateIndex, 'y') * usableHeight));
    const pathDistance = Math.abs(worldX - forestCorridorCenter(worldY, config.world.width));
    const environment = config.environmentManifest
      ? forestEnvironmentAt(config.environmentManifest, { worldX, worldY }) : null;
    attemptedCandidateCount += 1;
    if (environment && decisionRandom(config.seed, candidateIndex, 'environment-density') * 1000
      >= environment.suitability.treeDensityPermille) {
      densityRejectionCount += 1;
      continue;
    }
    const overlapsTrunk = placements.some((placement) => (
      Math.hypot(placement.worldX - worldX, placement.worldY - worldY)
        < config.minimumSpacing
    ));
    if (pathDistance < config.corridorHalfWidth) {
      corridorRejectionCount += 1;
      continue;
    }
    if (overlapsTrunk) {
      spacingRejectionCount += 1;
      continue;
    }

    const specimenIndex = config.assetPoolSize
      ? placements.length % config.assetPoolSize
      : Math.floor(
        decisionRandom(config.seed, candidateIndex, 'specimen') * config.specimenPoolSize
      );
    const phenotype = selectPhenotype(
      config,
      config.seed,
      config.assetPoolSize && !environment ? specimenIndex : candidateIndex,
      environment?.habitatId
    );
    const { treeSeed, assetKey } = specimenIdentity(
      config, config.seed, phenotype, specimenIndex
    );
    const scaleRange = config.scale.maximum - config.scale.minimum + 1;
    const scale = config.scale.minimum + Math.floor(
      decisionRandom(config.seed, candidateIndex, 'scale') * scaleRange
    );
    const placement = {
      id: `forest-scene-v${FOREST_SCENE_VERSION}-${config.seed}-${candidateIndex}`,
      worldX,
      worldY,
      scale,
      phenotypeId: phenotype.id,
      treeSeed,
      assetKey
    };
    if (environment) {
      Object.assign(placement, {
        originatingRegionId: environment.dominantRegionId,
        originatingHabitatId: environment.habitatId,
        groundSurfaceId: environment.groundSurfaceId,
        transitionState: environment.transition.state,
        rockyBlendPermille: environment.transition.rockyBlendPermille,
        treeDensityPermille: environment.suitability.treeDensityPermille
      });
    }
    placements.push(placement);
  }

  if (placements.length !== config.placementCount) {
    throw new Error(`Could only place ${placements.length} of ${config.placementCount} trees.`);
  }

  const scene = {
    version: FOREST_SCENE_VERSION,
    seed: config.seed,
    baseIdentity: forestBaseIdentity(config),
    world: config.world,
    corridor: { halfWidth: config.corridorHalfWidth },
    placements
  };
  if (config.environmentManifest) {
    scene.environment = JSON.parse(JSON.stringify(config.environmentManifest));
    scene.environmentPlacementDiagnostics = {
      attemptedCandidateCount,
      acceptedPlacementCount: placements.length,
      densityRejectionCount,
      corridorRejectionCount,
      spacingRejectionCount,
      termination: 'requested-count-reached'
    };
    scene.terrainFeatureGenerationVersion = FOREST_TERRAIN_FEATURE_GENERATION_VERSION;
    scene.crossingGenerationVersion = FOREST_CROSSING_GENERATION_VERSION;
    scene.crossings = generateForestStreamCrossings(
      scene, worldY => forestCorridorCenter(worldY, scene.world.width)
    );
    [scene.crossing] = scene.crossings;
    scene.terrainFeatures = generateForestTerrainFeatures(
      scene, worldY => forestCorridorCenter(worldY, scene.world.width)
    );
  }
  return scene;
}

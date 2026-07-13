import { FOREST_RENDERER_VERSION_V3 } from './forestTreeGeneratorV3.js';
import {
  DECIDUOUS_PHENOTYPE,
  LANTERNWOOD_PHENOTYPE
} from './forest/v3/phenotype.js';
import { createRandom, hashSeed } from './forest/v3/random.js';
import { treeAssetCacheKey } from './forest/v3/treeAsset.js';

export const FOREST_SCENE_VERSION = 1;

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
    [DECIDUOUS_PHENOTYPE.id]: 68,
    [LANTERNWOOD_PHENOTYPE.id]: 32
  })
});

const PHENOTYPES = [DECIDUOUS_PHENOTYPE, LANTERNWOOD_PHENOTYPE];

function decisionRandom(sceneSeed, candidateIndex, decision) {
  return createRandom(hashSeed([
    `forest-scene-v${FOREST_SCENE_VERSION}`, sceneSeed, candidateIndex, decision
  ].join(':')))();
}

export function forestCorridorCenter(worldY, worldWidth) {
  return (worldWidth / 2) + (Math.sin((worldY / 330) + 0.7) * 155);
}

function selectPhenotype(config, sceneSeed, candidateIndex) {
  const total = PHENOTYPES.reduce((sum, phenotype) => (
    sum + (config.phenotypeWeights[phenotype.id] || 0)
  ), 0);
  let selection = decisionRandom(sceneSeed, candidateIndex, 'phenotype') * total;
  return PHENOTYPES.find((phenotype) => {
    selection -= config.phenotypeWeights[phenotype.id] || 0;
    return selection < 0;
  }) || PHENOTYPES[0];
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
  const placements = [];
  const maximumCandidates = config.placementCount * 100;

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
    const overlapsTrunk = placements.some((placement) => (
      Math.hypot(placement.worldX - worldX, placement.worldY - worldY)
        < config.minimumSpacing
    ));
    if (pathDistance < config.corridorHalfWidth || overlapsTrunk) continue;

    const phenotype = selectPhenotype(config, config.seed, candidateIndex);
    const specimenIndex = Math.floor(
      decisionRandom(config.seed, candidateIndex, 'specimen') * config.specimenPoolSize
    );
    const { treeSeed, assetKey } = specimenIdentity(
      config, config.seed, phenotype, specimenIndex
    );
    const scaleRange = config.scale.maximum - config.scale.minimum + 1;
    const scale = config.scale.minimum + Math.floor(
      decisionRandom(config.seed, candidateIndex, 'scale') * scaleRange
    );
    placements.push({
      id: `forest-scene-v${FOREST_SCENE_VERSION}-${config.seed}-${candidateIndex}`,
      worldX,
      worldY,
      scale,
      phenotypeId: phenotype.id,
      treeSeed,
      assetKey
    });
  }

  if (placements.length !== config.placementCount) {
    throw new Error(`Could only place ${placements.length} of ${config.placementCount} trees.`);
  }

  return {
    version: FOREST_SCENE_VERSION,
    seed: config.seed,
    world: config.world,
    corridor: { halfWidth: config.corridorHalfWidth },
    placements
  };
}


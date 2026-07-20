import { growBranchGraph } from './forest/v3/growth.js';
import { analyzeBranchGraph } from './forest/v3/graphDiagnostics.js';
import { DECIDUOUS_PHENOTYPE, resolveForestPhenotype } from './forest/v3/phenotype.js';
import { hashSeed } from './forest/v3/random.js';
import { rasterizeFoliage } from './forest/v3/rasterizeFoliage.js';
import { rasterizeWood } from './forest/v3/rasterizeWood.js';
import { buildForestTreeAsset } from './forest/v3/treeAsset.js';
import {
  FOREST_POST_TREE_MAPPING_VERSION,
  FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
} from './forestPostTreeProjection.js';

// Version 4 adds bounded height-density and foliage-shape vocabulary. Asset schema remains v2.
export const FOREST_RENDERER_VERSION_V3 = 4;

export function generateForestTreeGraph(post, options = {}) {
  if (!post?.id) throw new Error('V3 forest trees require a post id.');
  const seed = options.seed ?? hashSeed(`${FOREST_RENDERER_VERSION_V3}:${post.id}`);
  const phenotype = options.phenotype || DECIDUOUS_PHENOTYPE;
  const graph = growBranchGraph(seed >>> 0, phenotype);
  return {
    rendererVersion: FOREST_RENDERER_VERSION_V3,
    seed: seed >>> 0,
    phenotype,
    meaningProjectionIdentity: options.meaningProjectionIdentity || null,
    ...graph,
    diagnostics: analyzeBranchGraph(graph, phenotype)
  };
}

export function generateForestTreeV3(post, options = {}) {
  const graph = generateForestTreeGraph(post, options);
  return {
    ...graph,
    wood: rasterizeWood(graph, graph.phenotype, graph.seed),
    foliage: rasterizeFoliage(graph, graph.phenotype, graph.seed, {
      paletteId: options.foliagePaletteId
    })
  };
}

export function generateForestTreeAssetV3(post, options = {}) {
  return buildForestTreeAsset(generateForestTreeV3(post, options));
}

function optionsForProjection(projection) {
  if (projection?.schemaVersion !== FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
    || projection?.mappingVersion !== FOREST_POST_TREE_MAPPING_VERSION) {
    throw new Error('Unsupported forest post-tree projection version.');
  }
  const phenotype = resolveForestPhenotype(projection.phenotype?.id);
  if (!phenotype || phenotype.assetVersion !== projection.phenotype.version) {
    throw new Error('Forest post-tree projection references an unknown phenotype identity.');
  }
  const paletteId = projection.permanentTraits?.foliagePaletteId;
  if (paletteId !== null && !phenotype.foliagePalettes.some(({ id }) => id === paletteId)) {
    throw new Error('Forest post-tree projection references an unknown foliage palette.');
  }
  const expectedVisualFingerprint = [
    `mapping-v${projection.mappingVersion}`,
    paletteId ? `foliage-${paletteId}` : 'foliage-seed-selected'
  ].join(':');
  if (!Number.isInteger(projection.specimen?.seed) || projection.specimen.seed < 0
    || projection.specimen.seed > 0xFFFFFFFF
    || projection.identity?.visualFingerprint !== expectedVisualFingerprint) {
    throw new Error('Forest post-tree projection has an invalid visual identity.');
  }
  return {
    seed: projection.specimen.seed,
    phenotype,
    foliagePaletteId: paletteId,
    meaningProjectionIdentity: {
      version: projection.mappingVersion,
      visualFingerprint: projection.identity.visualFingerprint
    }
  };
}

export function generateProjectedForestTreeV3(projection) {
  return generateForestTreeV3(
    { id: `projected-specimen-${projection?.specimen?.seed}` },
    optionsForProjection(projection)
  );
}

export function generateProjectedForestTreeAssetV3(projection) {
  return buildForestTreeAsset(generateProjectedForestTreeV3(projection));
}

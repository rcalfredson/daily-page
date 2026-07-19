import { growBranchGraph } from './forest/v3/growth.js';
import { analyzeBranchGraph } from './forest/v3/graphDiagnostics.js';
import { DECIDUOUS_PHENOTYPE } from './forest/v3/phenotype.js';
import { hashSeed } from './forest/v3/random.js';
import { rasterizeFoliage } from './forest/v3/rasterizeFoliage.js';
import { rasterizeWood } from './forest/v3/rasterizeWood.js';
import { buildForestTreeAsset } from './forest/v3/treeAsset.js';

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
    ...graph,
    diagnostics: analyzeBranchGraph(graph, phenotype)
  };
}

export function generateForestTreeV3(post, options = {}) {
  const graph = generateForestTreeGraph(post, options);
  return {
    ...graph,
    wood: rasterizeWood(graph, graph.phenotype, graph.seed),
    foliage: rasterizeFoliage(graph, graph.phenotype, graph.seed)
  };
}

export function generateForestTreeAssetV3(post, options = {}) {
  return buildForestTreeAsset(generateForestTreeV3(post, options));
}

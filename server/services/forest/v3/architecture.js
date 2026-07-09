import { createRandom } from './random.js';

function sampleRange(random, range) {
  return range[0] + ((range[1] - range[0]) * random());
}

export function deriveTreeArchitecture(seed, phenotype) {
  const random = createRandom(seed ^ 0xA2C417EC);
  const branchStartHeight = Math.round(
    sampleRange(random, phenotype.architecture.branchStartHeight) * 2
  ) / 2;

  return Object.freeze({ branchStartHeight });
}

import { createRandom } from './random.js';

function sampleRange(random, range) {
  return range[0] + ((range[1] - range[0]) * random());
}

function roundTo(value, precision) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function deriveTreeArchitecture(seed, phenotype) {
  const random = createRandom(seed ^ 0xA2C417EC);
  const branchStartHeight = Math.round(
    sampleRange(random, phenotype.architecture.branchStartHeight) * 2
  ) / 2;
  const trunkBaseRadius = roundTo(
    sampleRange(random, phenotype.architecture.trunkBaseRadius), 2
  );
  const trunkTaper = roundTo(
    sampleRange(random, phenotype.architecture.trunkTaper), 2
  );

  return Object.freeze({ branchStartHeight, trunkBaseRadius, trunkTaper });
}

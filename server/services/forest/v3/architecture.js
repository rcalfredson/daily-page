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
  const trunkLeanAngle = roundTo(
    sampleRange(random, phenotype.architecture.trunkLeanAngle), 3
  );
  const trunkLeanAzimuth = roundTo(
    sampleRange(random, phenotype.architecture.trunkLeanAzimuth), 3
  );
  const hasSplitTrunk = random() < phenotype.architecture.splitTrunkProbability;
  const splitTrunkHeight = Math.round(
    sampleRange(random, phenotype.architecture.splitTrunkHeight) * 2
  ) / 2;
  const splitTrunkAngle = roundTo(
    sampleRange(random, phenotype.architecture.splitTrunkAngle), 3
  );
  const splitTrunkAzimuth = roundTo(
    sampleRange(random, phenotype.architecture.splitTrunkAzimuth), 3
  );

  return Object.freeze({
    branchStartHeight,
    trunkBaseRadius,
    trunkTaper,
    trunkLeanAngle,
    trunkLeanAzimuth,
    hasSplitTrunk,
    splitTrunkHeight,
    splitTrunkAngle,
    splitTrunkAzimuth
  });
}

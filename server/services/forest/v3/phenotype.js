export const DECIDUOUS_PHENOTYPE_ID = 'open-crown-deciduous';
export const DECIDUOUS_PHENOTYPE_ASSET_VERSION = 2;
export const LANTERNWOOD_PHENOTYPE_ID = 'sunset-lanternwood';
export const LANTERNWOOD_PHENOTYPE_ASSET_VERSION = 2;
export const HIGHLAND_CONIFER_PHENOTYPE_ID = 'wind-shaped-highland-conifer';
export const HIGHLAND_CONIFER_PHENOTYPE_ASSET_VERSION = 1;

export const DECIDUOUS_PHENOTYPE = Object.freeze({
  id: DECIDUOUS_PHENOTYPE_ID,
  assetVersion: DECIDUOUS_PHENOTYPE_ASSET_VERSION,
  name: 'open-crown deciduous',
  width: 96,
  height: 128,
  groundY: 120,
  crown: Object.freeze({
    centerX: 48,
    centerY: 58,
    radiusX: 38,
    radiusY: 48,
    radiusZ: 32
  }),
  cameraYaw: 0.2,
  perspectiveStrength: 0.07,
  growthEnvelopeOverscan: 1.04,
  attractionPointCount: 180,
  attractionGap: 0.1,
  architecture: Object.freeze({
    branchStartHeight: Object.freeze([22, 38]),
    trunkBaseRadius: Object.freeze([3.1, 4.1]),
    trunkTaper: Object.freeze([0.72, 1.32]),
    trunkLeanAngle: Object.freeze([0.025, 0.085]),
    trunkLeanAzimuth: Object.freeze([0, Math.PI * 2]),
    splitTrunkProbability: 0.65,
    splitTrunkHeight: Object.freeze([32, 46]),
    splitTrunkAngle: Object.freeze([0.3, 0.4]),
    splitTrunkAzimuth: Object.freeze([0, Math.PI * 2]),
    leaderBalance: Object.freeze([0.78, 1])
  }),
  trunkTopY: 43,
  primaryBranchCount: 5,
  primaryBranchAngle: 0.88,
  internodeLength: 3.4,
  influenceRadius: 25,
  killRadius: 4.2,
  maxIterations: 72,
  maxNodes: 420,
  maxGeneration: 4,
  apicalDominance: 0.23,
  parentDirectionWeight: 0.34,
  maximumTurnAngle: 0.3,
  maximumAxisDeviation: 0.82,
  lowerBranchFloorY: 66,
  lowerBranchTransitionHeight: 14,
  lowerBranchMaximumDroop: 0.12,
  phototropism: 0.18,
  forkProbability: 0.3,
  minimumForkPoints: 7,
  forkSeparation: 0.28,
  minimumVigor: 0.08,
  vigorDecay: 0.965,
  terminalRadius: 0.55,
  pipeExponent: 2.15,
  foliageStyle: 'broadleaf',
  foliageMinimumOrder: 2,
  foliageTerminalCoverage: 1,
  foliageCoverageColumns: 6,
  foliageCoverageRows: 7,
  foliageCoverageSamples: 3,
  foliageMinimumCellCoverage: 0.34,
  foliageMaximumTopUpCells: 10,
  foliageTopUpSupportsPerCell: 3,
  foliageSupplementalLeafCount: Object.freeze([8, 12]),
  foliageSupportRadius: 18,
  foliageMinimumLeafSpacing: 1.2,
  terminalLeafCount: Object.freeze([10, 16]),
  highOrderLeafCount: Object.freeze([5, 9]),
  secondaryLeafCount: Object.freeze([2, 5]),
  secondaryShootProbability: 0.42,
  leafRadiusX: Object.freeze([1.75, 2.6]),
  leafRadiusY: Object.freeze([2.65, 4]),
  leafShootSpread: Object.freeze([4, 8.5]),
  foliagePalettes: Object.freeze([
    Object.freeze({
      id: 'summer-green', weight: 78,
      colors: Object.freeze({
        highlight: '#9fbe59', light: '#73a34a', mid: '#4f843f',
        dark: '#2e6339', deep: '#214a35'
      })
    }),
    Object.freeze({
      id: 'meadow-green', weight: 14,
      colors: Object.freeze({
        highlight: '#d1d96b', light: '#9fbd55', mid: '#669545',
        dark: '#3d6f40', deep: '#28513b'
      })
    }),
    Object.freeze({
      id: 'blue-grove', weight: 6,
      colors: Object.freeze({
        highlight: '#9acb9b', light: '#65aa83', mid: '#428575',
        dark: '#326369', deep: '#294858'
      })
    }),
    Object.freeze({
      id: 'early-gold', weight: 2,
      colors: Object.freeze({
        highlight: '#f4dc78', light: '#d8b958', mid: '#ad8842',
        dark: '#795d3e', deep: '#51443a'
      })
    })
  ]),
  rootFlareHeight: 11,
  rootFlareStrength: 3.8
});

export const LANTERNWOOD_PHENOTYPE = Object.freeze({
  id: LANTERNWOOD_PHENOTYPE_ID,
  assetVersion: LANTERNWOOD_PHENOTYPE_ASSET_VERSION,
  name: 'sunset lanternwood',
  width: 112,
  height: 120,
  groundY: 112,
  crown: Object.freeze({ centerX: 56, centerY: 52, radiusX: 48, radiusY: 34, radiusZ: 36 }),
  cameraYaw: -0.32,
  perspectiveStrength: 0.09,
  growthEnvelopeOverscan: 1.06,
  attractionPointCount: 210,
  attractionGap: 0.06,
  architecture: Object.freeze({
    branchStartHeight: Object.freeze([28, 40]),
    trunkBaseRadius: Object.freeze([3.8, 5]),
    trunkTaper: Object.freeze([0.62, 1.05]),
    trunkLeanAngle: Object.freeze([0.07, 0.15]),
    trunkLeanAzimuth: Object.freeze([0, Math.PI * 2]),
    splitTrunkProbability: 0.12,
    splitTrunkHeight: Object.freeze([38, 48]),
    splitTrunkAngle: Object.freeze([0.22, 0.32]),
    splitTrunkAzimuth: Object.freeze([0, Math.PI * 2]),
    leaderBalance: Object.freeze([0.86, 1])
  }),
  trunkTopY: 44,
  primaryBranchCount: 7,
  primaryBranchAngle: 1.16,
  internodeLength: 3.2,
  influenceRadius: 27,
  killRadius: 4,
  maxIterations: 68,
  maxNodes: 460,
  maxGeneration: 4,
  apicalDominance: 0.08,
  parentDirectionWeight: 0.42,
  maximumTurnAngle: 0.34,
  maximumAxisDeviation: 0.94,
  lowerBranchFloorY: 70,
  lowerBranchTransitionHeight: 18,
  lowerBranchMaximumDroop: 0.24,
  phototropism: 0.1,
  forkProbability: 0.2,
  minimumForkPoints: 6,
  forkSeparation: 0.25,
  minimumVigor: 0.07,
  vigorDecay: 0.97,
  terminalRadius: 0.58,
  pipeExponent: 2.1,
  foliageStyle: 'broadleaf',
  foliageMinimumOrder: 2,
  foliageTerminalCoverage: 1,
  foliageCoverageColumns: 7,
  foliageCoverageRows: 5,
  foliageCoverageSamples: 3,
  foliageMinimumCellCoverage: 0.42,
  foliageMaximumTopUpCells: 12,
  foliageTopUpSupportsPerCell: 3,
  foliageSupplementalLeafCount: Object.freeze([10, 15]),
  foliageSupportRadius: 19,
  foliageMinimumLeafSpacing: 1.05,
  terminalLeafCount: Object.freeze([13, 19]),
  highOrderLeafCount: Object.freeze([7, 11]),
  secondaryLeafCount: Object.freeze([3, 6]),
  secondaryShootProbability: 0.58,
  leafRadiusX: Object.freeze([2.15, 3.25]),
  leafRadiusY: Object.freeze([2.3, 3.45]),
  leafShootSpread: Object.freeze([4.8, 9.5]),
  foliagePalettes: Object.freeze([
    Object.freeze({
      id: 'sunset', weight: 76,
      colors: Object.freeze({
        highlight: '#ffe38a', light: '#f6bd60', mid: '#e88b5b',
        dark: '#b95756', deep: '#743f52'
      })
    }),
    Object.freeze({
      id: 'harvest', weight: 14,
      colors: Object.freeze({
        highlight: '#fff0a0', light: '#efcb68', mid: '#cf9849',
        dark: '#986044', deep: '#603f43'
      })
    }),
    Object.freeze({
      id: 'enchanted-plum', weight: 7,
      colors: Object.freeze({
        highlight: '#efb4cf', light: '#d988b6', mid: '#a85c9a',
        dark: '#713f79', deep: '#472f5e'
      })
    }),
    Object.freeze({
      id: 'spring-bloom', weight: 3,
      colors: Object.freeze({
        highlight: '#fff0c4', light: '#f0bfa7', mid: '#cf8494',
        dark: '#925b79', deep: '#593f60'
      })
    })
  ]),
  woodPalette: Object.freeze({
    light: '#d8b987', mid: '#aa795d', dark: '#704b4b', deep: '#49333f'
  }),
  rootFlareHeight: 13,
  rootFlareStrength: 5.2
});

export const HIGHLAND_CONIFER_PHENOTYPE = Object.freeze({
  id: HIGHLAND_CONIFER_PHENOTYPE_ID,
  assetVersion: HIGHLAND_CONIFER_PHENOTYPE_ASSET_VERSION,
  name: 'wind-shaped highland conifer',
  width: 82,
  height: 142,
  groundY: 134,
  crown: Object.freeze({ centerX: 41, centerY: 68, radiusX: 29, radiusY: 61, radiusZ: 24 }),
  cameraYaw: 0.26,
  perspectiveStrength: 0.055,
  growthEnvelopeOverscan: 1.03,
  attractionPointCount: 168,
  attractionGap: 0.18,
  attractionDensityByHeight: Object.freeze([0.72, 0.96, 0.42, 0.9, 0.5, 0.82, 0.62]),
  directionalGrowthBias: Object.freeze({ x: 0.075, y: 0, z: -0.018 }),
  architecture: Object.freeze({
    branchStartHeight: Object.freeze([18, 27]),
    trunkBaseRadius: Object.freeze([4.2, 5.2]),
    trunkTaper: Object.freeze([0.78, 1.12]),
    trunkLeanAngle: Object.freeze([0.035, 0.09]),
    trunkLeanAzimuth: Object.freeze([-0.35, 0.55]),
    splitTrunkProbability: 0.035,
    splitTrunkHeight: Object.freeze([52, 64]),
    splitTrunkAngle: Object.freeze([0.16, 0.24]),
    splitTrunkAzimuth: Object.freeze([0, Math.PI * 2]),
    leaderBalance: Object.freeze([0.9, 1])
  }),
  trunkTopY: 13,
  primaryBranchCount: 12,
  primaryBranchAngle: 1.48,
  internodeLength: 3.25,
  influenceRadius: 20,
  killRadius: 3.8,
  maxIterations: 78,
  maxNodes: 430,
  maxGeneration: 4,
  apicalDominance: 0.38,
  parentDirectionWeight: 0.5,
  maximumTurnAngle: 0.24,
  maximumAxisDeviation: 0.7,
  lowerBranchFloorY: 92,
  lowerBranchTransitionHeight: 30,
  lowerBranchMaximumDroop: 0.34,
  phototropism: 0.2,
  forkProbability: 0.13,
  minimumForkPoints: 8,
  forkSeparation: 0.3,
  minimumVigor: 0.085,
  vigorDecay: 0.955,
  terminalRadius: 0.5,
  pipeExponent: 2.2,
  foliageStyle: 'needle-spray',
  foliageMinimumOrder: 1,
  foliageTerminalCoverage: 1,
  foliageCoverageColumns: 5,
  foliageCoverageRows: 9,
  foliageCoverageSamples: 3,
  foliageMinimumCellCoverage: 0.18,
  foliageMaximumTopUpCells: 5,
  foliageTopUpSupportsPerCell: 2,
  foliageSupplementalLeafCount: Object.freeze([5, 8]),
  foliageSupportRadius: 13,
  foliageMinimumLeafSpacing: 0.7,
  terminalLeafCount: Object.freeze([7, 11]),
  highOrderLeafCount: Object.freeze([4, 7]),
  secondaryLeafCount: Object.freeze([2, 4]),
  secondaryShootProbability: 0.56,
  leafRadiusX: Object.freeze([0.7, 1.15]),
  leafRadiusY: Object.freeze([2.1, 3.7]),
  leafShootSpread: Object.freeze([3.2, 6.4]),
  foliagePalettes: Object.freeze([
    Object.freeze({
      id: 'highland-evergreen', weight: 82,
      colors: Object.freeze({
        highlight: '#8faf75', light: '#668f68', mid: '#416f59',
        dark: '#2d554c', deep: '#213f3d'
      })
    }),
    Object.freeze({
      id: 'blue-ridge', weight: 13,
      colors: Object.freeze({
        highlight: '#91aaa0', light: '#668b82', mid: '#456c69',
        dark: '#345459', deep: '#293f49'
      })
    }),
    Object.freeze({
      id: 'lichen-tips', weight: 5,
      colors: Object.freeze({
        highlight: '#b0ba7b', light: '#798f68', mid: '#526f58',
        dark: '#38554c', deep: '#293f3d'
      })
    })
  ]),
  woodPalette: Object.freeze({
    light: '#b49268', mid: '#826348', dark: '#594737', deep: '#3c342e'
  }),
  rootFlareHeight: 14,
  rootFlareStrength: 5.8
});

export const FOREST_PHENOTYPES = Object.freeze([
  DECIDUOUS_PHENOTYPE,
  LANTERNWOOD_PHENOTYPE,
  HIGHLAND_CONIFER_PHENOTYPE
]);

const FOREST_PHENOTYPES_BY_ID = new Map(FOREST_PHENOTYPES.map(phenotype => [
  phenotype.id, phenotype
]));

export const FOREST_PHENOTYPE_SCENE_TRAITS = Object.freeze({
  [DECIDUOUS_PHENOTYPE_ID]: Object.freeze({ defaultWeight: 68, collisionRadius: 11 }),
  [LANTERNWOOD_PHENOTYPE_ID]: Object.freeze({ defaultWeight: 32, collisionRadius: 13 }),
  [HIGHLAND_CONIFER_PHENOTYPE_ID]: Object.freeze({ defaultWeight: 0, collisionRadius: 12 })
});

export function resolveForestPhenotype(phenotypeId) {
  return FOREST_PHENOTYPES_BY_ID.get(phenotypeId) || null;
}

export function isRegisteredForestPhenotype(phenotype) {
  return FOREST_PHENOTYPES.includes(phenotype);
}

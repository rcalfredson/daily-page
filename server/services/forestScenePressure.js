export const DEFAULT_FOREST_PRESSURE_PROFILE_ID = 'representative';
export const FOREST_SCENE_CELL_SIZE = 480;
export const FOREST_SCENE_PRELOAD_CELL_COUNT = 1;
export const FOREST_SCENE_MAX_CELL_REQUEST = 64;
export const FOREST_SCENE_MAX_ASSET_REQUEST = 256;

export const FOREST_PRESSURE_PROFILES = Object.freeze([
  Object.freeze({
    id: DEFAULT_FOREST_PRESSURE_PROFILE_ID,
    label: 'Representative grove',
    description: 'The calm default: 180 placements sharing up to 16 assets.',
    pressure: false,
    layout: Object.freeze({})
  }),
  Object.freeze({
    id: 'botanical-range',
    label: 'Botanical range',
    description: '180 placements balancing all registered phenotypes across 24 shared assets.',
    pressure: true,
    layout: Object.freeze({
      seed: 'pressure-botanical-range',
      assetPoolSize: 24,
      phenotypeWeights: Object.freeze({
        'open-crown-deciduous': 1,
        'sunset-lanternwood': 0.8,
        'wind-shaped-highland-conifer': 1.4
      })
    })
  }),
  Object.freeze({
    id: 'post-tree-meaning',
    label: 'Projected writing grove',
    description: '180 placements cycle through the 24 meaning-contract fixtures and 23 assets.',
    pressure: false,
    projectedWriting: true,
    layout: Object.freeze({ seed: 'projected-writing-grove', assetPoolSize: 24 })
  }),
  Object.freeze({
    id: 'asset-variety',
    label: 'Asset variety',
    description: '180 placements sharing 60 assets.',
    pressure: true,
    layout: Object.freeze({ seed: 'pressure-asset-variety', assetPoolSize: 60 })
  }),
  Object.freeze({
    id: 'unique-assets',
    label: 'Unique assets',
    description: '180 placements with one unique asset per tree.',
    pressure: true,
    layout: Object.freeze({ seed: 'pressure-unique-assets', assetPoolSize: 180 })
  }),
  Object.freeze({
    id: 'large-world',
    label: 'Large world',
    description: '600 placements sharing 60 assets across a 6000 × 3600 world.',
    pressure: true,
    layout: Object.freeze({
      seed: 'pressure-large-world',
      world: Object.freeze({ width: 6000, height: 3600 }),
      placementCount: 600,
      assetPoolSize: 60
    })
  })
]);

export function resolveForestPressureProfile(profileId) {
  return FOREST_PRESSURE_PROFILES.find(({ id }) => id === profileId)
    || FOREST_PRESSURE_PROFILES.find(({ id }) => id === DEFAULT_FOREST_PRESSURE_PROFILE_ID);
}

export function serializedForestSceneBytes(scene) {
  return Buffer.byteLength(JSON.stringify(scene), 'utf8');
}

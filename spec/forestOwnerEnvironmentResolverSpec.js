import {
  buildForestOwnerEnvironmentPlacementExclusion,
  FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION,
  ForestOwnerEnvironmentResolverError,
  forestOwnerEnvironmentExcludesTree,
  resolveForestOwnerEnvironment,
} from '../server/services/forestOwnerEnvironmentResolver.js';
import {
  allocateForestOwnerGrovePlacements,
} from '../server/services/forestOwnerGrovePlacement.js';

const WORLD_SEED = 'owner-environment-spec';

function resolve(worldX, worldY, overrides = {}) {
  return resolveForestOwnerEnvironment({
    worldSeed: WORLD_SEED,
    worldX,
    worldY,
    ...overrides,
  });
}

function occupied(placements) {
  return placements.map(({ placementSlot, worldX, worldY }) => ({
    placementSlot,
    worldX,
    worldY,
  }));
}

describe('forest owner signed-coordinate environment resolver', () => {
  it('returns identical immutable evidence for identical inputs', () => {
    const first = resolve(-2_400, 1_800);
    const second = resolve(-2_400, 1_800);

    expect(second).toEqual(first);
    expect(first).toEqual(jasmine.objectContaining({
      policyVersion: FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
      schemaVersion: FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
      worldGenerationVersion: FOREST_OWNER_WORLD_GENERATION_VERSION,
      grammarId: FOREST_OWNER_ENVIRONMENT_GRAMMAR_ID,
    }));
    expect(Object.isFrozen(first)).toBeTrue();
    expect(Object.isFrozen(first.originatingEnvironment)).toBeTrue();
    expect(Object.isFrozen(first.ecology)).toBeTrue();
    expect(Object.isFrozen(first.suitability)).toBeTrue();
  });

  it('accepts signed coordinates in every quadrant without world dimensions', () => {
    const coordinates = [
      [-800, -600],
      [800, -600],
      [-800, 600],
      [800, 600],
      [-1_000_000_000, 1_000_000_000],
    ];

    for (const [worldX, worldY] of coordinates) {
      const environment = resolve(worldX, worldY);
      expect(environment.ecology.rockinessPermille)
        .toBeGreaterThanOrEqual(0);
      expect(environment.ecology.rockinessPermille)
        .toBeLessThanOrEqual(1_000);
    }
  });

  it('returns only the compact seven-field durable environment snapshot', () => {
    const { originatingEnvironment } = resolve(0, 0);

    expect(Object.keys(originatingEnvironment).sort()).toEqual([
      'groundSurfaceId',
      'habitatId',
      'policyVersion',
      'regionId',
      'schemaVersion',
      'transitionState',
      'worldGenerationVersion',
    ]);
    expect(originatingEnvironment).toEqual({
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1,
      regionId: 'calm-grove',
      habitatId: 'neutral-grove',
      groundSurfaceId: 'grove-moss',
      transitionState: 'grove-core',
    });
  });

  it('uses coherent patches while producing multiple honest habitats', () => {
    const environments = [];
    for (let worldX = -4_800; worldX <= 4_800; worldX += 480) {
      for (let worldY = -4_800; worldY <= 4_800; worldY += 480) {
        environments.push(resolve(worldX, worldY));
      }
    }
    const regions = new Set(environments.map(
      environment => environment.originatingEnvironment.regionId,
    ));
    const transitions = new Set(environments.map(
      environment => environment.originatingEnvironment.transitionState,
    ));
    const surfaces = new Set(environments.map(
      environment => environment.originatingEnvironment.groundSurfaceId,
    ));

    expect(regions).toEqual(new Set(['calm-grove', 'rocky-rise']));
    expect(transitions).toEqual(new Set([
      'grove-core',
      'intergrade',
      'rocky-core',
    ]));
    expect(surfaces).toEqual(new Set([
      'grove-moss',
      'weathered-rock-grass',
    ]));
    expect(Math.abs(
      resolve(1_000, 1_000).ecology.rockinessPermille
      - resolve(1_020, 1_020).ecology.rockinessPermille,
    )).toBeLessThan(40);
  });

  it('changes the generated ecology when the owner world seed changes', () => {
    const before = resolve(2_400, -1_800);
    const after = resolveForestOwnerEnvironment({
      worldSeed: 'another-owner-world',
      worldX: 2_400,
      worldY: -1_800,
    });

    expect(after.ecology).not.toEqual(before.ecology);
  });

  it('supplies a deterministic exclusion adapter to signed placement', () => {
    const worldSeed = 'owner-environment-placement-spec';
    const isExcluded = buildForestOwnerEnvironmentPlacementExclusion({
      worldSeed,
    });
    const allocation = allocateForestOwnerGrovePlacements({
      worldSeed,
      count: 600,
      isExcluded,
    });

    expect(allocation.diagnostics.exclusionRejectionCount).toBeGreaterThan(0);
    expect(allocation.placements.every(({ worldX, worldY }) => (
      resolveForestOwnerEnvironment({
        worldSeed,
        worldX,
        worldY,
      }).suitability.treeAllowed
    ))).toBeTrue();
  });

  it('preserves one-shot placement when environment-aware allocation resumes', () => {
    const worldSeed = 'owner-environment-continuation-spec';
    const isExcluded = buildForestOwnerEnvironmentPlacementExclusion({
      worldSeed,
    });
    const first = allocateForestOwnerGrovePlacements({
      worldSeed,
      count: 100,
      isExcluded,
    });
    const second = allocateForestOwnerGrovePlacements({
      worldSeed,
      count: 100,
      nextCandidateSlot: first.nextCandidateSlot,
      occupiedPlacements: occupied(first.placements),
      isExcluded,
    });
    const oneShot = allocateForestOwnerGrovePlacements({
      worldSeed,
      count: 200,
      isExcluded,
    });

    expect([...first.placements, ...second.placements])
      .toEqual(oneShot.placements);
    expect(second.nextCandidateSlot).toBe(oneShot.nextCandidateSlot);
  });

  it('exposes only a strict boolean exclusion decision', () => {
    const allowed = resolve(0, 0);
    const excluded = resolve(-4_800, -4_320);

    expect(forestOwnerEnvironmentExcludesTree(allowed)).toBeFalse();
    expect(typeof forestOwnerEnvironmentExcludesTree(excluded))
      .toBe('boolean');
    expect(() => forestOwnerEnvironmentExcludesTree({}))
      .toThrowError(
        ForestOwnerEnvironmentResolverError,
        /owner environment resolution/,
      );
  });

  it('rejects unsupported versions, malformed coordinates, and hidden inputs', () => {
    for (const versions of [
      { policyVersion: 2 },
      { schemaVersion: 2 },
      { worldGenerationVersion: 2 },
    ]) {
      expect(() => resolve(0, 0, versions)).toThrowError(
        ForestOwnerEnvironmentResolverError,
        /not supported/,
      );
    }
    expect(() => resolve(0.5, 0)).toThrowError(
      ForestOwnerEnvironmentResolverError,
      /signed safe integer/,
    );
    expect(() => resolveForestOwnerEnvironment({
      worldSeed: WORLD_SEED,
      worldX: 0,
      worldY: 0,
      world: { width: 3_200, height: 2_000 },
    })).toThrowError(
      ForestOwnerEnvironmentResolverError,
      /unsupported field/,
    );
  });
});

import {
  allocateForestOwnerGrovePlacements,
  FOREST_OWNER_GROVE_PLACEMENT_CONFIG,
  ForestOwnerGrovePlacementError,
  inspectForestOwnerGrovePlacementCandidate,
} from '../server/services/forestOwnerGrovePlacement.js';

const WORLD_SEED = 'owner-grove-placement-spec';

function allocate(count, overrides = {}) {
  return allocateForestOwnerGrovePlacements({
    worldSeed: WORLD_SEED,
    count,
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

function nearestDistance(placement, placements) {
  return Math.min(...placements
    .filter(candidate => candidate !== placement)
    .map(candidate => Math.hypot(
      candidate.worldX - placement.worldX,
      candidate.worldY - placement.worldY,
    )));
}

function nearestDirectionPeakRatio(placements, binCount = 12) {
  const bins = Array(binCount).fill(0);
  for (const placement of placements) {
    let nearest = null;
    let nearestDistanceValue = Number.POSITIVE_INFINITY;
    for (const candidate of placements) {
      if (candidate === placement) continue;
      const worldX = candidate.worldX - placement.worldX;
      const worldY = candidate.worldY - placement.worldY;
      const distance = Math.hypot(worldX, worldY);
      if (distance < nearestDistanceValue) {
        nearestDistanceValue = distance;
        nearest = { worldX, worldY };
      }
    }
    let angle = Math.atan2(nearest.worldY, nearest.worldX);
    if (angle < 0) angle += Math.PI;
    if (angle >= Math.PI) angle -= Math.PI;
    bins[Math.min(
      binCount - 1,
      Math.floor((angle / Math.PI) * binCount),
    )] += 1;
  }

  return Math.max(...bins) / (placements.length / binCount);
}

describe('forest owner grove placement', () => {
  it('produces identical bounded output for identical inputs', () => {
    const first = allocate(40);
    const second = allocate(40);

    expect(second).toEqual(first);
    expect(first.placements.length).toBe(40);
    expect(first.diagnostics).toEqual(jasmine.objectContaining({
      acceptedPlacementCount: 40,
      termination: 'requested-count-reached',
    }));
    expect(first.placements.every(placement => (
      Object.keys(placement).sort().join(',')
      === 'placementSlot,placementVersion,worldX,worldY'
    ))).toBeTrue();
  });

  it('keeps a permanent central clearing in a signed coordinate plane', () => {
    const { placements } = allocate(400);
    const config = FOREST_OWNER_GROVE_PLACEMENT_CONFIG;

    expect(placements.every(({ worldX, worldY }) => (
      Math.hypot(worldX, worldY) >= config.centralClearingRadius
    ))).toBeTrue();
    expect(placements.some(({ worldX }) => worldX < 0)).toBeTrue();
    expect(placements.some(({ worldX }) => worldX > 0)).toBeTrue();
    expect(placements.some(({ worldY }) => worldY < 0)).toBeTrue();
    expect(placements.some(({ worldY }) => worldY > 0)).toBeTrue();
  });

  it('preserves every earlier placement when the grove grows', () => {
    const firstHundred = allocate(100);
    const firstTwoHundred = allocate(200);

    expect(firstTwoHundred.placements.slice(0, 100))
      .toEqual(firstHundred.placements);
    expect(firstTwoHundred.nextCandidateSlot)
      .toBeGreaterThan(firstHundred.nextCandidateSlot);
  });

  it('advances through overlapping candidate shells in outward order', () => {
    const { placements } = allocate(300);
    const shells = placements.map(placement => (
      inspectForestOwnerGrovePlacementCandidate({
        worldSeed: WORLD_SEED,
        placementSlot: placement.placementSlot,
      }).shell
    ));

    expect(shells.every((shell, index) => (
      index === 0 || shell >= shells[index - 1]
    ))).toBeTrue();
  });

  it('supports incremental continuation without changing one-shot output', () => {
    const first = allocate(120);
    const second = allocate(80, {
      nextCandidateSlot: first.nextCandidateSlot,
      occupiedPlacements: occupied(first.placements),
    });
    const oneShot = allocate(200);

    expect([...first.placements, ...second.placements])
      .toEqual(oneShot.placements);
    expect(second.nextCandidateSlot).toBe(oneShot.nextCandidateSlot);
  });

  it('maintains minimum spacing through a large placement history', () => {
    const { placements } = allocate(1_000);
    const minimumSpacing = FOREST_OWNER_GROVE_PLACEMENT_CONFIG
      .minimumTreeSpacing;

    expect(placements.every(placement => (
      nearestDistance(placement, placements) >= minimumSpacing
    ))).toBeTrue();
  });

  it('creates both bounded micro-groves and open breathing room', () => {
    const { placements } = allocate(600);
    const groupingRadius = FOREST_OWNER_GROVE_PLACEMENT_CONFIG
      .microGroveGroupingRadius;
    const neighborCounts = placements.map(placement => placements.filter(
      candidate => candidate !== placement && Math.hypot(
        candidate.worldX - placement.worldX,
        candidate.worldY - placement.worldY,
      ) < groupingRadius,
    ).length);
    const classes = placements.map(placement => (
      inspectForestOwnerGrovePlacementCandidate({
        worldSeed: WORLD_SEED,
        placementSlot: placement.placementSlot,
      }).candidateClass
    ));

    expect(classes.filter(value => value === 'core').length)
      .toBeGreaterThan(30);
    expect(classes.filter(value => value === 'halo').length)
      .toBeGreaterThan(5);
    expect(neighborCounts.filter(value => value >= 3).length)
      .toBeGreaterThan(80);
    expect(neighborCounts.filter(value => value <= 1).length)
      .toBeGreaterThan(200);
  });

  it('bounds each continuous micro-grove node to core and halo limits', () => {
    const nodes = new Map();
    for (let placementSlot = 0; placementSlot < 5_000; placementSlot += 1) {
      const candidate = inspectForestOwnerGrovePlacementCandidate({
        worldSeed: WORLD_SEED,
        placementSlot,
      });
      if (!candidate.microGroveNodeKey || !candidate.enabled) continue;
      if (!nodes.has(candidate.microGroveNodeKey)) {
        nodes.set(candidate.microGroveNodeKey, { core: 0, halo: 0 });
      }
      nodes.get(candidate.microGroveNodeKey)[candidate.candidateClass] += 1;
    }

    expect(nodes.size).toBeGreaterThan(20);
    for (const node of nodes.values()) {
      expect(node.core).toBeGreaterThanOrEqual(2);
      expect(node.core).toBeLessThanOrEqual(5);
      expect(node.halo).toBeLessThanOrEqual(2);
      expect(node.core + node.halo).toBeLessThanOrEqual(6);
    }
  });

  it('keeps accepted micro-grove anchors from merging', () => {
    const { placements } = allocate(600);
    const anchors = new Map();
    for (const placement of placements) {
      const candidate = inspectForestOwnerGrovePlacementCandidate({
        worldSeed: WORLD_SEED,
        placementSlot: placement.placementSlot,
      });
      if (candidate.microGroveNodeKey) {
        anchors.set(candidate.microGroveNodeKey, candidate.microGroveAnchor);
      }
    }
    const values = [...anchors.values()];

    for (let left = 0; left < values.length; left += 1) {
      for (let right = left + 1; right < values.length; right += 1) {
        expect(Math.hypot(
          values[left].worldX - values[right].worldX,
          values[left].worldY - values[right].worldY,
        )).toBeGreaterThanOrEqual(
          FOREST_OWNER_GROVE_PLACEMENT_CONFIG
            .minimumMicroGroveAnchorSpacing,
        );
      }
    }
  });

  it('uses continuous directions without a loud nearest-neighbor axis', () => {
    const { placements } = allocate(600);

    expect(nearestDirectionPeakRatio(placements)).toBeLessThan(1.45);
  });

  it('distributes open candidates across shell area rather than ring tracks', () => {
    const config = FOREST_OWNER_GROVE_PLACEMENT_CONFIG;
    const shell = 4;
    const firstSlot = config.baseCandidatesPerShell * (shell ** 2);
    const lastSlot = config.baseCandidatesPerShell * ((shell + 1) ** 2);
    const innerRadius = config.centralClearingRadius
      + (shell * config.shellWidth) - config.shellOverlap;
    const outerRadius = config.centralClearingRadius
      + ((shell + 1) * config.shellWidth) + config.shellOverlap;
    const areaRange = (outerRadius ** 2) - (innerRadius ** 2);
    const bins = Array(10).fill(0);

    for (let placementSlot = firstSlot; placementSlot < lastSlot; placementSlot += 1) {
      const candidate = inspectForestOwnerGrovePlacementCandidate({
        worldSeed: WORLD_SEED,
        placementSlot,
      });
      if (candidate.candidateClass !== 'open') continue;
      const radialArea = ((candidate.distanceFromOrigin ** 2) - (innerRadius ** 2))
        / areaRange;
      bins[Math.min(9, Math.max(0, Math.floor(radialArea * 10)))] += 1;
    }

    expect(Math.min(...bins)).toBeGreaterThan(20);
    expect(Math.max(...bins) / (bins.reduce((sum, value) => sum + value, 0) / 10))
      .toBeLessThan(1.35);
  });

  it('skips stable exclusions without changing earlier accepted placements', () => {
    const baseline = allocate(30);
    const excluded = allocate(30, {
      isExcluded: candidate => candidate.worldX > 0 && candidate.worldY > 0,
    });

    expect(excluded.placements.every(placement => !(
      placement.worldX > 0 && placement.worldY > 0
    ))).toBeTrue();
    expect(excluded.diagnostics.exclusionRejectionCount).toBeGreaterThan(0);
    expect(allocate(10).placements).toEqual(baseline.placements.slice(0, 10));
  });

  it('rejects occupied positions and continues through the candidate stream', () => {
    const initial = allocate(1);
    const retryFromStart = allocate(1, {
      occupiedPlacements: occupied(initial.placements),
    });

    expect(retryFromStart.placements[0]).not.toEqual(initial.placements[0]);
    expect(retryFromStart.diagnostics.spacingRejectionCount).toBe(1);
  });

  it('fails closed on malformed, unbounded, or exhausted requests', () => {
    expect(() => allocate(0)).toThrowError(ForestOwnerGrovePlacementError);
    expect(() => allocate(1, { worldSeed: '' }))
      .toThrowError(/worldSeed/);
    expect(() => allocate(1, {
      occupiedPlacements: [{
        placementSlot: 1,
        worldX: 0,
        worldY: 0,
        treeId: 'private',
      }],
    })).toThrowError(/only placementSlot, worldX, and worldY/);
    expect(() => allocate(1, {
      isExcluded: () => true,
      maximumCandidateChecks: 1,
    })).toThrowError(/Could place only 0 of 1/);
  });
});

import {
  FOREST_OWNER_GROVE_PLACEMENT_CONFIG,
  allocateForestOwnerGrovePlacements,
  inspectForestOwnerGrovePlacementCandidate,
} from '../server/services/forestOwnerGrovePlacement.js';
import {
  deriveForestOwnerPlacementIndex,
  FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE,
  FOREST_OWNER_PLACEMENT_INDEX_VERSION,
  ForestOwnerPlacementNeighborhoodError,
  readForestOwnerPlacementNeighborhood,
} from '../server/services/forestOwnerPlacementNeighborhood.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const OTHER_OWNER_USER_ID = '507f1f77bcf86cd799439012';
const WORLD_SEED = 'owner-placement-neighborhood-spec';

function storedTree(placement, overrides = {}) {
  return {
    schemaVersion: 1,
    writingTreeId: `tree-${String(placement.placementSlot).padStart(8, '0')}`,
    ownerUserId: OWNER_USER_ID,
    sourceState: 'active',
    hiddenFromForest: false,
    placement: {
      policyVersion: 1,
      slot: placement.placementSlot,
      worldX: placement.worldX,
      worldY: placement.worldY,
    },
    placementIndex: deriveForestOwnerPlacementIndex(placement),
    ...overrides,
  };
}

function queryModel(allRecords) {
  const model = {
    find: jasmine.createSpy('ForestWritingTree.find').and.callFake((filter) => {
      const cellXs = new Set(filter['placementIndex.cellX'].$in);
      const cellYs = new Set(filter['placementIndex.cellY'].$in);
      const matching = allRecords.filter(record => (
        record.ownerUserId === filter.ownerUserId
        && cellXs.has(record.placementIndex.cellX)
        && cellYs.has(record.placementIndex.cellY)
      ));
      let limited = matching;
      const query = {
        sort: jasmine.createSpy('sort').and.callFake(() => query),
        limit: jasmine.createSpy('limit').and.callFake((limit) => {
          limited = matching.slice(0, limit);
          return query;
        }),
        session: jasmine.createSpy('session').and.callFake(() => query),
        lean: jasmine.createSpy('lean').and.callFake(async () => limited),
      };
      return query;
    }),
  };
  return model;
}

function firstCandidate(predicate) {
  for (let placementSlot = 0; placementSlot < 10_000; placementSlot += 1) {
    const candidate = inspectForestOwnerGrovePlacementCandidate({
      worldSeed: WORLD_SEED,
      placementSlot,
    });
    if (predicate(candidate)) return candidate;
  }
  throw new Error('Expected placement candidate was not found.');
}

function singleCandidateOutcome(occupiedPlacements, placementSlot) {
  try {
    const allocation = allocateForestOwnerGrovePlacements({
      worldSeed: WORLD_SEED,
      nextCandidateSlot: placementSlot,
      count: 1,
      occupiedPlacements,
      maximumCandidateChecks: 1,
    });
    return { status: 'accepted', placement: allocation.placements[0] };
  } catch (error) {
    return { status: 'rejected', code: error.code };
  }
}

describe('forest owner placement neighborhood adapter', () => {
  it('derives stable signed spatial cells from immutable coordinates', () => {
    expect(FOREST_OWNER_PLACEMENT_INDEX_CELL_SIZE).toBe(720);
    expect(deriveForestOwnerPlacementIndex({ worldX: 0, worldY: 719 }))
      .toEqual({ version: 1, cellX: 0, cellY: 0 });
    expect(deriveForestOwnerPlacementIndex({ worldX: 720, worldY: 1_440 }))
      .toEqual({ version: 1, cellX: 1, cellY: 2 });
    expect(deriveForestOwnerPlacementIndex({ worldX: -1, worldY: -721 }))
      .toEqual({ version: 1, cellX: -1, cellY: -2 });
  });

  it('queries a bounded owner-only neighborhood for an open candidate', async () => {
    const candidate = firstCandidate(value => (
      value.enabled && !value.microGroveNodeKey
    ));
    const localTree = storedTree({
      placementSlot: candidate.placementSlot + 20_000,
      worldX: candidate.worldX + 20,
      worldY: candidate.worldY + 20,
    }, { sourceState: 'inactive', hiddenFromForest: true });
    const foreignTree = {
      ...localTree,
      writingTreeId: 'foreign-tree',
      ownerUserId: OTHER_OWNER_USER_ID,
    };
    const ForestWritingTreeModel = queryModel([localTree, foreignTree]);

    const result = await readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: WORLD_SEED,
      placementSlot: candidate.placementSlot,
      session: 'transaction-session',
      ForestWritingTreeModel,
    });

    expect(result.indexVersion).toBe(FOREST_OWNER_PLACEMENT_INDEX_VERSION);
    expect(result.queriedCellCount).toBe(9);
    expect(result.conflictRadius).toBe(700);
    expect(result.occupiedPlacements).toEqual([{
      placementSlot: localTree.placement.slot,
      worldX: localTree.placement.worldX,
      worldY: localTree.placement.worldY,
    }]);
    const [filter, projection] = ForestWritingTreeModel.find.calls.first().args;
    expect(filter.ownerUserId).toBe(OWNER_USER_ID);
    expect(filter.sourceState).toBeUndefined();
    expect(filter.hiddenFromForest).toBeUndefined();
    expect(ForestWritingTreeModel.find.calls.first().returnValue.session)
      .toHaveBeenCalledOnceWith('transaction-session');
    expect(projection).toEqual(jasmine.objectContaining({
      _id: 0,
      placement: 1,
      placementIndex: 1,
    }));
  });

  it('widens micro-grove queries enough to reconstruct nearby anchors', async () => {
    const candidate = firstCandidate(value => (
      value.enabled && value.microGroveNodeKey
    ));
    const ForestWritingTreeModel = queryModel([]);

    const result = await readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: WORLD_SEED,
      placementSlot: candidate.placementSlot,
      ForestWritingTreeModel,
    });

    expect(result.focus).toEqual(candidate.microGroveAnchor);
    expect(result.conflictRadius).toBe(
      FOREST_OWNER_GROVE_PLACEMENT_CONFIG.minimumMicroGroveAnchorSpacing
      + FOREST_OWNER_GROVE_PLACEMENT_CONFIG.microGroveHaloRadius.maximum,
    );
    expect(result.queriedCellCount).toBe(25);
  });

  it('matches whole-history conflict decisions using only local records', async () => {
    const existing = allocateForestOwnerGrovePlacements({
      worldSeed: WORLD_SEED,
      count: 300,
    });
    const records = existing.placements.map(storedTree);
    const ForestWritingTreeModel = queryModel(records);
    const fullHistory = existing.placements.map(({
      placementSlot,
      worldX,
      worldY,
    }) => ({ placementSlot, worldX, worldY }));

    for (
      let placementSlot = existing.nextCandidateSlot;
      placementSlot < existing.nextCandidateSlot + 80;
      placementSlot += 1
    ) {
      const neighborhood = await readForestOwnerPlacementNeighborhood({
        ownerUserId: OWNER_USER_ID,
        worldSeed: WORLD_SEED,
        placementSlot,
        ForestWritingTreeModel,
      });
      expect(singleCandidateOutcome(
        neighborhood.occupiedPlacements,
        placementSlot,
      )).toEqual(singleCandidateOutcome(fullHistory, placementSlot));
    }
  });

  it('fails instead of silently truncating an overfull local neighborhood', async () => {
    const candidate = firstCandidate(value => value.enabled);
    const records = [0, 1, 2].map((offset) => storedTree({
      placementSlot: candidate.placementSlot + 20_000 + offset,
      worldX: candidate.worldX + offset,
      worldY: candidate.worldY + offset,
    }));

    await expectAsync(readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: WORLD_SEED,
      placementSlot: candidate.placementSlot,
      maximumPlacements: 2,
      ForestWritingTreeModel: queryModel(records),
    })).toBeRejectedWithError(
      ForestOwnerPlacementNeighborhoodError,
      /safe per-candidate bound/,
    );
  });

  it('fails closed on unsupported or stale neighboring records', async () => {
    const candidate = firstCandidate(value => value.enabled);
    const placement = {
      placementSlot: candidate.placementSlot + 20_000,
      worldX: candidate.worldX,
      worldY: candidate.worldY,
    };
    const unsupported = storedTree(placement, { schemaVersion: 2 });
    const stale = storedTree(placement, {
      placementIndex: { version: 1, cellX: 99, cellY: 99 },
    });

    await expectAsync(readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: WORLD_SEED,
      placementSlot: candidate.placementSlot,
      ForestWritingTreeModel: queryModel([unsupported]),
    })).toBeRejectedWithError(
      ForestOwnerPlacementNeighborhoodError,
      /unsupported tree record/,
    );
    const staleIndex = deriveForestOwnerPlacementIndex(placement);
    stale.placementIndex = {
      ...staleIndex,
      cellX: staleIndex.cellX + 1,
    };
    await expectAsync(readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: WORLD_SEED,
      placementSlot: candidate.placementSlot,
      ForestWritingTreeModel: queryModel([stale]),
    })).toBeRejectedWithError(
      ForestOwnerPlacementNeighborhoodError,
      /stale spatial index/,
    );
  });

  it('rejects malformed authority, versions, limits, and dependencies', async () => {
    expect(() => deriveForestOwnerPlacementIndex({
      worldX: 0,
      worldY: 0,
      version: 2,
    })).toThrowError(/not supported/);
    await expectAsync(readForestOwnerPlacementNeighborhood({
      ownerUserId: 'owner',
      worldSeed: WORLD_SEED,
      placementSlot: 0,
      ForestWritingTreeModel: queryModel([]),
    })).toBeRejectedWithError(/canonical ObjectId/);
    await expectAsync(readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: '',
      placementSlot: 0,
      ForestWritingTreeModel: queryModel([]),
    })).toBeRejectedWithError(/worldSeed/);
    await expectAsync(readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: WORLD_SEED,
      placementSlot: -1,
      ForestWritingTreeModel: queryModel([]),
    })).toBeRejectedWithError(/candidate stream/);
    await expectAsync(readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: WORLD_SEED,
      placementSlot: 0,
      maximumPlacements: 0,
      ForestWritingTreeModel: queryModel([]),
    })).toBeRejectedWithError(/maximumPlacements/);
    await expectAsync(readForestOwnerPlacementNeighborhood({
      ownerUserId: OWNER_USER_ID,
      worldSeed: WORLD_SEED,
      placementSlot: 0,
      ForestWritingTreeModel: {},
    })).toBeRejectedWithError(/must be available/);
  });
});

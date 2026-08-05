import ForestWritingTree from '../server/db/models/ForestWritingTree.js';
import {
  buildForestWritingTreeCreationService,
  FOREST_WRITING_TREE_CREATION_VERSION,
  ForestWritingTreeCreationError,
} from '../server/services/forestWritingTreeCreation.js';
import {
  ForestOwnerGrovePlacementError,
} from '../server/services/forestOwnerGrovePlacement.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const GROUP_ID = '507f191e810c19729de860ea';
const BLOCK_ID = '507f1f77bcf86cd799439012';
const FOREST_ID = '11111111-1111-4111-8111-111111111111';
const TREE_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-08-04T12:00:00.000Z');
const FOUNDING_DATE = new Date('2024-06-15T10:30:00.000Z');

function query(value) {
  const chain = {
    sort: jasmine.createSpy('sort').and.callFake(() => chain),
    session: jasmine.createSpy('session').and.callFake(() => chain),
    lean: jasmine.createSpy('lean').and.resolveTo(value),
  };
  return chain;
}

function ownerWorld(overrides = {}) {
  return {
    _id: 'owner-world-record',
    schemaVersion: 1,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    worldRole: 'primary',
    status: 'active',
    worldSeed: 'owner_world_seed_0123456789abcdef',
    placementPolicyVersion: 1,
    nextCandidateSlot: 0,
    placementRevision: 1,
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1,
    reconciliation: { epoch: 3 },
    ...overrides,
  };
}

function founder(overrides = {}) {
  return {
    _id: BLOCK_ID,
    userId: OWNER_USER_ID,
    authorshipState: 'live',
    groupId: GROUP_ID,
    lang: 'en',
    status: 'locked',
    visibility: 'public',
    createdAt: FOUNDING_DATE,
    roomId: 'daily',
    ...overrides,
  };
}

function environment(treeAllowed = true) {
  return {
    originatingEnvironment: {
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1,
      regionId: 'calm-grove',
      habitatId: 'neutral-grove',
      groundSurfaceId: 'grove-moss',
      transitionState: 'grove-core',
    },
    suitability: { treeAllowed },
  };
}

function projectedTree() {
  return {
    schemaVersion: 1,
    mappingVersion: 1,
    specimen: { seed: 123 },
    phenotype: { id: 'open-crown-deciduous', version: 1 },
    permanentTraits: {
      creationSeason: 'summer',
      foliagePaletteId: 'summer-green',
    },
    identity: {
      projectionFingerprint:
        'mapping-v1:foliage-summer-green:seed-123:open-crown-deciduous@1',
      visualFingerprint: 'mapping-v1:foliage-summer-green',
    },
  };
}

function groupEvidence(block) {
  if (!block) {
    return {
      classification: 'ineligible',
      reasonCode: 'no-eligible-owner-variant',
      foundingVariant: null,
    };
  }
  if (!(block.createdAt instanceof Date) || Number.isNaN(block.createdAt.getTime())) {
    return {
      classification: 'unresolved',
      reasonCode: 'invalid-creation-date',
      foundingVariant: null,
    };
  }
  return {
    classification: 'eligible',
    reasonCode: 'eligible-owner-variant',
    foundingVariant: {
      blockId: String(block._id),
      ownerUserId: String(block.userId),
      translationGroupId: String(block.groupId),
      authorshipState: block.authorshipState || 'live',
      lang: block.lang,
      status: block.status,
      visibility: block.visibility,
      createdAt: block.createdAt.toISOString(),
      roomId: block.roomId,
    },
  };
}

function harness({
  existingTree = null,
  world = ownerWorld(),
  foundingBlock = founder(),
  transactionRunner = work => work('transaction-session'),
  inspectCandidate = ({ placementSlot }) => ({
    placementSlot,
    candidateClass: 'open',
    enabled: true,
    clearsCenter: true,
    worldX: -720,
    worldY: 1_440,
  }),
  resolveEnvironment = () => environment(),
  allocatePlacements = ({ nextCandidateSlot }) => ({
    placements: [{
      placementVersion: 1,
      placementSlot: nextCandidateSlot,
      worldX: -720,
      worldY: 1_440,
    }],
  }),
  projectTree = () => projectedTree(),
  readGroupEvidence = jasmine.createSpy('readGroupEvidence')
    .and.callFake(async () => groupEvidence(foundingBlock)),
} = {}) {
  const deletionQuery = query(null);
  const existingTreeQuery = query(existingTree);
  const worldQuery = query(world);
  const createdTrees = [];
  const models = {
    AccountDeletionRequest: {
      exists: jasmine.createSpy('AccountDeletionRequest.exists')
        .and.returnValue(deletionQuery),
    },
    Block: {},
    ForestOwnerWorld: {
      findOne: jasmine.createSpy('ForestOwnerWorld.findOne')
        .and.returnValue(worldQuery),
      create: jasmine.createSpy('ForestOwnerWorld.create').and.resolveTo([
        ownerWorld(),
      ]),
      updateOne: jasmine.createSpy('ForestOwnerWorld.updateOne')
        .and.resolveTo({ modifiedCount: 1 }),
    },
    ForestWritingTree: {
      findOne: jasmine.createSpy('ForestWritingTree.findOne')
        .and.returnValue(existingTreeQuery),
      create: jasmine.createSpy('ForestWritingTree.create')
        .and.callFake(async ([value]) => {
          const document = new ForestWritingTree(value);
          await document.validate();
          createdTrees.push(value);
          return [value];
        }),
    },
    User: {},
  };
  const acquireFence = jasmine.createSpy('acquireFence').and.resolveTo({
    ownerUserId: OWNER_USER_ID,
    acquired: true,
  });
  const readNeighborhood = jasmine.createSpy('readNeighborhood').and.resolveTo({
    occupiedPlacements: [],
  });
  const service = buildForestWritingTreeCreationService({
    models,
    transactionRunner,
    acquireFence,
    inspectCandidate,
    resolveEnvironment,
    readNeighborhood,
    allocatePlacements,
    projectTree,
    readGroupEvidence,
    generateUuid: () => TREE_ID,
    generateWorldSeed: () => 'generated_owner_world_seed_0123456789',
  });

  return {
    service,
    models,
    acquireFence,
    readNeighborhood,
    createdTrees,
    readGroupEvidence,
    queries: { deletionQuery, existingTreeQuery, worldQuery },
  };
}

describe('forest writing-tree transactional creation', () => {
  it('captures one complete tree and advances the owner world atomically', async () => {
    const test = harness();

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      now: NOW,
    });

    expect(result.creationVersion).toBe(FOREST_WRITING_TREE_CREATION_VERSION);
    expect(result.outcome).toBe('created');
    expect(result.tree).toEqual(jasmine.objectContaining({
      writingTreeId: TREE_ID,
      forestId: FOREST_ID,
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      lastEligibleReconciliationEpoch: 3,
    }));
    expect(result.tree.foundingSource).toEqual({
      blockId: BLOCK_ID,
      createdAt: FOUNDING_DATE,
    });
    expect(result.tree.sourceStateChangedAt).toBe(NOW);
    expect(result.tree.placement).toEqual({
      policyVersion: 1,
      slot: 0,
      worldX: -720,
      worldY: 1_440,
    });
    expect(result.tree.placementIndex).toEqual({
      version: 1,
      cellX: -1,
      cellY: 2,
    });
    expect(result.tree.originatingEnvironment.habitatId)
      .toBe('neutral-grove');
    expect(result.tree.projection).toEqual(jasmine.objectContaining({
      revision: 1,
      schemaVersion: 1,
      mappingVersion: 1,
      specimenSeed: 123,
      phenotypeId: 'open-crown-deciduous',
    }));
    expect(result.tree.policyEvidence).toEqual({
      ownerWritingPolicyVersion: 2,
      ownerVariantSelectionVersion: 1,
      writingLifecyclePolicyVersion: 1,
    });
    expect(test.acquireFence).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      session: 'transaction-session',
      UserModel: test.models.User,
    });
    expect(test.models.ForestOwnerWorld.updateOne).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        _id: 'owner-world-record',
        nextCandidateSlot: 0,
        placementRevision: 1,
      }),
      {
        $set: { nextCandidateSlot: 1 },
        $inc: { placementRevision: 1 },
      },
      { session: 'transaction-session' },
    );
  });

  it('reselects exact owner/group evidence inside the transaction', async () => {
    const test = harness();

    await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    });

    expect(test.readGroupEvidence).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      session: 'transaction-session',
    });
  });

  it('returns an existing owner/group tree without allocating again', async () => {
    const existingTree = {
      schemaVersion: 1,
      identityVersion: 1,
      writingTreeId: TREE_ID,
      sourceState: 'inactive',
    };
    const test = harness({ existingTree });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    });

    expect(result).toEqual({
      creationVersion: 1,
      outcome: 'existing',
      tree: existingTree,
      diagnostics: null,
    });
    expect(test.models.ForestOwnerWorld.findOne).not.toHaveBeenCalled();
    expect(test.readGroupEvidence).not.toHaveBeenCalled();
    expect(test.models.ForestWritingTree.create).not.toHaveBeenCalled();
  });

  it('creates the primary world once but no tree when the founder disappeared', async () => {
    const test = harness({ world: null, foundingBlock: null });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    });

    expect(result.outcome).toBe('no-eligible-founder');
    expect(result.tree).toBeNull();
    expect(test.models.ForestOwnerWorld.create).toHaveBeenCalled();
    expect(test.models.ForestWritingTree.create).not.toHaveBeenCalled();
    expect(test.models.ForestOwnerWorld.updateOne).not.toHaveBeenCalled();
  });

  it('advances past structural, environmental, and occupied candidates only on success', async () => {
    const occupiedError = new ForestOwnerGrovePlacementError(
      'PLACEMENT_SEARCH_EXHAUSTED',
      'occupied',
    );
    const inspectCandidate = ({ placementSlot }) => ({
      placementSlot,
      candidateClass: 'open',
      enabled: placementSlot !== 0,
      clearsCenter: true,
      worldX: placementSlot * 100,
      worldY: placementSlot * 200,
    });
    const resolveEnvironment = ({ worldX }) => environment(worldX !== 100);
    const allocatePlacements = jasmine.createSpy('allocatePlacements')
      .and.callFake(({ nextCandidateSlot }) => {
        if (nextCandidateSlot === 2) throw occupiedError;
        return {
          placements: [{
            placementVersion: 1,
            placementSlot: nextCandidateSlot,
            worldX: nextCandidateSlot * 100,
            worldY: nextCandidateSlot * 200,
          }],
        };
      });
    const test = harness({
      inspectCandidate,
      resolveEnvironment,
      allocatePlacements,
    });

    const result = await test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    });

    expect(result.tree.placement.slot).toBe(3);
    expect(result.diagnostics).toEqual({
      inspectedCandidateCount: 4,
      structuralRejectionCount: 1,
      environmentRejectionCount: 1,
      occupiedRejectionCount: 1,
      acceptedPlacementCount: 1,
    });
    expect(test.models.ForestOwnerWorld.updateOne.calls.first().args[1])
      .toEqual({
        $set: { nextCandidateSlot: 4 },
        $inc: { placementRevision: 1 },
      });
  });

  it('suppresses creation when deletion evidence exists', async () => {
    const test = harness();
    test.models.AccountDeletionRequest.exists.and.returnValue(query({ _id: 'request' }));

    await expectAsync(test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(
      ForestWritingTreeCreationError,
      /account deletion suppresses/,
    );
    expect(test.models.ForestOwnerWorld.findOne).not.toHaveBeenCalled();
  });

  it('fails before tree insertion when founder or projection evidence is malformed', async () => {
    const malformedFounder = harness({
      foundingBlock: founder({ createdAt: new Date('invalid') }),
    });
    await expectAsync(malformedFounder.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(/invalid-creation-date/);
    expect(malformedFounder.models.ForestWritingTree.create).not.toHaveBeenCalled();

    const malformedProjection = harness({
      projectTree: () => ({ ...projectedTree(), mappingVersion: 2 }),
    });
    await expectAsync(malformedProjection.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(/unsupported versions/);
    expect(malformedProjection.models.ForestWritingTree.create).not.toHaveBeenCalled();
    expect(malformedProjection.models.ForestOwnerWorld.updateOne)
      .not.toHaveBeenCalled();
  });

  it('fails the transaction when owner-world advancement loses its compare-and-set', async () => {
    const test = harness();
    test.models.ForestOwnerWorld.updateOne.and.resolveTo({ modifiedCount: 0 });

    await expectAsync(test.service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(/placement state changed/);
  });

  it('converts a duplicate-key race into the existing owner/group tree', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { code: 11_000 });
    const existingTree = {
      schemaVersion: 1,
      identityVersion: 1,
      writingTreeId: TREE_ID,
    };
    const models = {
      ForestWritingTree: {
        findOne: jasmine.createSpy('ForestWritingTree.findOne')
          .and.returnValue(query(existingTree)),
      },
    };
    const service = buildForestWritingTreeCreationService({
      models,
      transactionRunner: jasmine.createSpy('transactionRunner')
        .and.rejectWith(duplicate),
    });

    const raceResult = await service({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    });

    expect(raceResult.outcome).toBe('existing');
    expect(raceResult.tree).toEqual(existingTree);
  });

  it('rejects malformed identities and invalid configuration', async () => {
    const test = harness();
    await expectAsync(test.service({
      ownerUserId: 'owner',
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(/canonical ObjectId/);
    expect(() => buildForestWritingTreeCreationService({
      maximumCandidateChecks: 0,
    })).toThrowError(/placement-policy bound/);
    expect(() => buildForestWritingTreeCreationService({
      projectTree: null,
    })).toThrowError(/projectTree must be a function/);
  });
});

import Block from '../server/db/models/Block.js';
import ForestOwnerWorld from '../server/db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../server/db/models/ForestWritingTree.js';
import {
  FOREST_OWNER_WORLD_SCHEMA_VERSION
} from '../server/db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION
} from '../server/db/schemas/ForestWritingTreeSchema.js';
import {
  resolveForestOwnerEnvironment
} from '../server/services/forestOwnerEnvironmentResolver.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const GROUP_ID = '507f191e810c19729de860ea';
const BLOCK_ID = '507f1f77bcf86cd799439012';
const FOREST_ID = '11111111-1111-4111-8111-111111111111';
const WRITING_TREE_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-08-02T12:00:00.000Z');

function validOwnerWorld(overrides = {}) {
  return {
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    worldSeed: 'owner_world_seed_0123456789abcdef',
    placementPolicyVersion: 1,
    environmentPolicyVersion: 1,
    environmentSchemaVersion: 1,
    worldGenerationVersion: 1,
    ...overrides
  };
}

function validWritingTree(overrides = {}) {
  return {
    writingTreeId: WRITING_TREE_ID,
    forestId: FOREST_ID,
    ownerUserId: OWNER_USER_ID,
    translationGroupId: GROUP_ID,
    sourceStateChangedAt: NOW,
    foundingSource: {
      blockId: BLOCK_ID,
      createdAt: new Date('2024-03-20T10:30:00.000Z')
    },
    placement: {
      policyVersion: 1,
      slot: 42,
      worldX: -720,
      worldY: 1440
    },
    placementIndex: {
      version: 1,
      cellX: -1,
      cellY: 2
    },
    originatingEnvironment: {
      policyVersion: 1,
      schemaVersion: 1,
      worldGenerationVersion: 1,
      regionId: 'calm-grove',
      habitatId: 'neutral-grove',
      groundSurfaceId: 'grove-moss',
      transitionState: 'grove-core'
    },
    projection: {
      revision: 1,
      schemaVersion: 1,
      mappingVersion: 1,
      specimenSeed: 4_294_967_295,
      phenotypeId: 'open-crown-deciduous',
      phenotypeAssetVersion: 1,
      creationSeason: 'spring',
      foliagePaletteId: 'spring-green',
      projectionFingerprint:
        'mapping-v1:foliage-spring-green:seed-4294967295:open-crown-deciduous@1',
      visualFingerprint: 'mapping-v1:foliage-spring-green'
    },
    policyEvidence: {
      ownerWritingPolicyVersion: 2,
      ownerVariantSelectionVersion: 1,
      writingLifecyclePolicyVersion: 1
    },
    ...overrides
  };
}

function indexesByName(model) {
  return new Map(model.schema.indexes().map(([fields, options]) => (
    [options.name, { fields, options }]
  )));
}

describe('forest durable ledger schemas', () => {
  it('accepts a bounded owner world and applies inert initial state', async () => {
    const world = new ForestOwnerWorld(validOwnerWorld());

    await expectAsync(world.validate()).toBeResolved();
    expect(world.schemaVersion).toBe(FOREST_OWNER_WORLD_SCHEMA_VERSION);
    expect(world.worldRole).toBe('primary');
    expect(world.status).toBe('active');
    expect(world.nextCandidateSlot).toBe(0);
    expect(world.placementRevision).toBe(1);
    expect(world.reconciliation.toObject()).toEqual({
      epoch: 0,
      state: 'idle',
      phase: null,
      blockCursor: null,
      treeCursor: null,
      startedAt: null,
      completedAt: null,
      leaseToken: null,
      leaseExpiresAt: null
    });
  });

  it('accepts each coherent resumable reconciliation phase', async () => {
    const ownerBlocks = new ForestOwnerWorld(validOwnerWorld({
      reconciliation: {
        epoch: 3,
        state: 'running',
        phase: 'owner-blocks',
        blockCursor: 'bounded-block-cursor',
        treeCursor: null,
        startedAt: NOW,
        completedAt: null,
        leaseToken: 'lease_token_0123456789abcdef',
        leaseExpiresAt: new Date('2026-08-02T12:05:00.000Z')
      }
    }));
    const unseenTrees = new ForestOwnerWorld(validOwnerWorld({
      reconciliation: {
        epoch: 3,
        state: 'running',
        phase: 'unseen-trees',
        blockCursor: null,
        treeCursor: 'bounded-tree-cursor',
        startedAt: NOW,
        completedAt: null,
        leaseToken: 'lease_token_0123456789abcdef',
        leaseExpiresAt: new Date('2026-08-02T12:05:00.000Z')
      }
    }));

    await expectAsync(ownerBlocks.validate()).toBeResolved();
    await expectAsync(unseenTrees.validate()).toBeResolved();
  });

  it('rejects incoherent reconciliation and deleting-world state', async () => {
    const idleWithWork = new ForestOwnerWorld(validOwnerWorld({
      reconciliation: { state: 'idle', phase: 'owner-blocks' }
    }));
    await expectAsync(idleWithWork.validate()).toBeRejectedWithError(/active work state/);

    const wrongCursor = new ForestOwnerWorld(validOwnerWorld({
      reconciliation: {
        epoch: 1,
        state: 'running',
        phase: 'unseen-trees',
        blockCursor: 'wrong-phase-cursor',
        startedAt: NOW,
        leaseToken: 'lease_token_0123456789abcdef',
        leaseExpiresAt: new Date('2026-08-02T12:05:00.000Z')
      }
    }));
    await expectAsync(wrongCursor.validate()).toBeRejectedWithError(/Block cursor/);

    const deletingWithWork = new ForestOwnerWorld(validOwnerWorld({
      status: 'deleting',
      reconciliation: {
        epoch: 1,
        state: 'running',
        phase: 'owner-blocks',
        startedAt: NOW,
        leaseToken: 'lease_token_0123456789abcdef',
        leaseExpiresAt: new Date('2026-08-02T12:05:00.000Z')
      }
    }));
    await expectAsync(deletingWithWork.validate()).toBeRejectedWithError(/cannot run reconciliation/);

    const invalidLease = new ForestOwnerWorld(validOwnerWorld({
      reconciliation: {
        epoch: 0,
        state: 'running',
        phase: 'owner-blocks',
        startedAt: NOW,
        leaseToken: 'lease_token_0123456789abcdef',
        leaseExpiresAt: NOW
      }
    }));
    await expectAsync(invalidLease.validate()).toBeRejectedWithError(/positive epoch/);
    expect(invalidLease.errors['reconciliation.leaseExpiresAt']).toBeDefined();
  });

  it('rejects malformed owner-world identity, seed, versions, and counters', async () => {
    const world = new ForestOwnerWorld(validOwnerWorld({
      forestId: 'owner-id',
      ownerUserId: 'owner',
      worldSeed: 'not valid seed!',
      placementPolicyVersion: 0,
      nextCandidateSlot: 1.5
    }));

    await expectAsync(world.validate()).toBeRejectedWithError(/validation failed/i);
    expect(world.errors.forestId).toBeDefined();
    expect(world.errors.ownerUserId).toBeDefined();
    expect(world.errors.worldSeed).toBeDefined();
    expect(world.errors.placementPolicyVersion).toBeDefined();
    expect(world.errors.nextCandidateSlot).toBeDefined();
  });

  it('accepts the complete compact writing-tree continuity record', async () => {
    const tree = new ForestWritingTree(validWritingTree());

    await expectAsync(tree.validate()).toBeResolved();
    expect(tree.schemaVersion).toBe(FOREST_WRITING_TREE_SCHEMA_VERSION);
    expect(tree.identityVersion).toBe(FOREST_WRITING_TREE_IDENTITY_VERSION);
    expect(tree.sourceState).toBe('active');
    expect(tree.hiddenFromForest).toBeFalse();
    expect(tree.inclusionChangedAt).toBeNull();
    expect(tree.lastEligibleReconciliationEpoch).toBe(0);
    expect(tree.recordRevision).toBe(1);
  });

  it('accepts the exact signed-coordinate environment resolver snapshot', async () => {
    const environment = resolveForestOwnerEnvironment({
      worldSeed: 'ledger-environment-snapshot-spec',
      worldX: -720,
      worldY: 1_440
    });
    const tree = new ForestWritingTree(validWritingTree({
      originatingEnvironment: environment.originatingEnvironment
    }));

    await expectAsync(tree.validate()).toBeResolved();
    expect(tree.originatingEnvironment.toObject())
      .toEqual(environment.originatingEnvironment);
  });

  it('keeps source activity and owner hiding as independent valid states', async () => {
    const inactiveHidden = new ForestWritingTree(validWritingTree({
      sourceState: 'inactive',
      hiddenFromForest: true,
      inclusionChangedAt: NOW
    }));
    const inactiveVisiblePreference = new ForestWritingTree(validWritingTree({
      sourceState: 'inactive',
      hiddenFromForest: false,
      inclusionChangedAt: NOW
    }));

    await expectAsync(inactiveHidden.validate()).toBeResolved();
    await expectAsync(inactiveVisiblePreference.validate()).toBeResolved();
  });

  it('requires a hide timestamp without requiring one for initial automatic inclusion', async () => {
    const hiddenWithoutTime = new ForestWritingTree(validWritingTree({
      hiddenFromForest: true,
      inclusionChangedAt: null
    }));

    await expectAsync(hiddenWithoutTime.validate()).toBeRejectedWithError(/inclusion timestamp/);
  });

  it('rejects malformed permanent identity, projection, placement, and policy evidence', async () => {
    const tree = new ForestWritingTree(validWritingTree({
      writingTreeId: 'tree-id',
      translationGroupId: 'group-id',
      placement: {
        policyVersion: 0,
        slot: -1,
        worldX: 0.5,
        worldY: 0
      },
      projection: {
        ...validWritingTree().projection,
        specimenSeed: 4_294_967_296,
        creationSeason: 'monsoon'
      },
      policyEvidence: {
        ownerWritingPolicyVersion: 0,
        ownerVariantSelectionVersion: 1,
        writingLifecyclePolicyVersion: 1
      }
    }));

    await expectAsync(tree.validate()).toBeRejectedWithError(/validation failed/i);
    expect(tree.errors.writingTreeId).toBeDefined();
    expect(tree.errors.translationGroupId).toBeDefined();
    expect(tree.errors['placement.policyVersion']).toBeDefined();
    expect(tree.errors['placement.slot']).toBeDefined();
    expect(tree.errors['placement.worldX']).toBeDefined();
    expect(tree.errors['projection.specimenSeed']).toBeDefined();
    expect(tree.errors['projection.creationSeason']).toBeDefined();
    expect(tree.errors['policyEvidence.ownerWritingPolicyVersion']).toBeDefined();
  });

  it('rejects unknown owner-world, tree, and nested projection fields', async () => {
    expect(() => new ForestOwnerWorld(validOwnerWorld({ title: 'private' })))
      .toThrowError(/not in schema/);
    expect(() => new ForestWritingTree(validWritingTree({ translations: [] })))
      .toThrowError(/not in schema/);
    const nestedExtra = new ForestWritingTree(validWritingTree({
      projection: {
        ...validWritingTree().projection,
        explanation: 'private'
      }
    }));
    await expectAsync(nestedExtra.validate()).toBeRejectedWithError(/StrictModeError/);
  });

  it('declares exact owner-world identity, lease, and deletion indexes', () => {
    const indexes = indexesByName(ForestOwnerWorld);

    expect(indexes.get('unique_forest_owner_world_role')).toEqual({
      fields: { ownerUserId: 1, worldRole: 1 },
      options: jasmine.objectContaining({ unique: true })
    });
    expect(indexes.get('unique_forest_owner_world_id')).toEqual({
      fields: { forestId: 1 },
      options: jasmine.objectContaining({ unique: true })
    });
    expect(indexes.get('forest_owner_world_reconciliation_lease')?.fields).toEqual({
      status: 1,
      'reconciliation.leaseExpiresAt': 1
    });
    expect(indexes.get('forest_owner_world_deletion')?.fields).toEqual({ ownerUserId: 1 });
  });

  it('declares exact writing-tree identity, placement, spatial, and lifecycle indexes', () => {
    const indexes = indexesByName(ForestWritingTree);

    expect(indexes.get('unique_forest_writing_tree_owner_group')).toEqual({
      fields: { ownerUserId: 1, translationGroupId: 1 },
      options: jasmine.objectContaining({ unique: true })
    });
    expect(indexes.get('unique_forest_writing_tree_id')).toEqual({
      fields: { writingTreeId: 1 },
      options: jasmine.objectContaining({ unique: true })
    });
    expect(indexes.get('unique_forest_writing_tree_placement_slot')).toEqual({
      fields: { forestId: 1, 'placement.slot': 1 },
      options: jasmine.objectContaining({ unique: true })
    });
    expect(indexes.get('forest_writing_tree_spatial_read')?.fields).toEqual({
      ownerUserId: 1,
      sourceState: 1,
      hiddenFromForest: 1,
      'placementIndex.cellX': 1,
      'placementIndex.cellY': 1,
      writingTreeId: 1
    });
    expect(indexes.get('forest_writing_tree_placement_neighborhood')?.fields).toEqual({
      ownerUserId: 1,
      'placementIndex.cellX': 1,
      'placementIndex.cellY': 1,
      writingTreeId: 1
    });
    expect(indexes.get('forest_writing_tree_reconciliation_epoch')?.fields).toEqual({
      ownerUserId: 1,
      lastEligibleReconciliationEpoch: 1,
      writingTreeId: 1
    });
    expect(indexes.get('forest_writing_tree_lifecycle')?.fields).toEqual({
      ownerUserId: 1,
      sourceState: 1,
      writingTreeId: 1
    });
    expect(indexes.get('forest_writing_tree_non_canvas_read')?.fields).toEqual({
      ownerUserId: 1,
      forestId: 1,
      sourceState: 1,
      hiddenFromForest: 1,
      'placement.slot': 1,
      writingTreeId: 1
    });
  });

  it('declares the exact-owner deterministic founding-selection Block index', () => {
    const indexes = indexesByName(Block);

    expect(indexes.get('forest_owner_group_founding_selection')?.fields).toEqual({
      userId: 1,
      groupId: 1,
      authorshipState: 1,
      createdAt: 1,
      _id: 1
    });
  });

  it('uses dedicated inert collections without registering any write service', () => {
    expect(ForestOwnerWorld.collection.collectionName).toBe('forest-owner-worlds');
    expect(ForestWritingTree.collection.collectionName).toBe('forest-writing-trees');
  });

  it('makes continuity evidence immutable while leaving derived spatial indexing replaceable', () => {
    const worldPaths = ForestOwnerWorld.schema.paths;
    const treePaths = ForestWritingTree.schema.paths;

    expect(worldPaths.forestId.options.immutable).toBeTrue();
    expect(worldPaths.ownerUserId.options.immutable).toBeTrue();
    expect(worldPaths.worldSeed.options.immutable).toBeTrue();
    expect(treePaths.writingTreeId.options.immutable).toBeTrue();
    expect(treePaths.translationGroupId.options.immutable).toBeTrue();
    expect(treePaths.foundingSource.options.immutable).toBeTrue();
    expect(treePaths.placement.options.immutable).toBeTrue();
    expect(treePaths.originatingEnvironment.options.immutable).toBeTrue();
    expect(treePaths.projection.options.immutable).toBeTrue();
    expect(treePaths.policyEvidence.options.immutable).toBeTrue();
    expect(treePaths.placementIndex.options.immutable).not.toBeTrue();
  });
});

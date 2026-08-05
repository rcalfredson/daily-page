import crypto from 'node:crypto';

import mongoose from 'mongoose';

import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import Block from '../db/models/Block.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import User from '../db/models/User.js';
import {
  FOREST_OWNER_WORLD_SCHEMA_VERSION,
} from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION,
} from '../db/schemas/ForestWritingTreeSchema.js';
import {
  acquireForestLedgerFence,
} from './forestLedgerFence.js';
import {
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION,
  resolveForestOwnerEnvironment,
} from './forestOwnerEnvironmentResolver.js';
import {
  allocateForestOwnerGrovePlacements,
  FOREST_OWNER_GROVE_PLACEMENT_CONFIG,
  FOREST_OWNER_GROVE_PLACEMENT_VERSION,
  ForestOwnerGrovePlacementError,
  inspectForestOwnerGrovePlacementCandidate,
} from './forestOwnerGrovePlacement.js';
import {
  deriveForestOwnerPlacementIndex,
  readForestOwnerPlacementNeighborhood,
} from './forestOwnerPlacementNeighborhood.js';
import {
  buildForestOwnerGroupEvidenceReader,
  FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS,
} from './forestOwnerGroupEvidence.js';
import {
  FOREST_OWNER_VARIANT_SELECTION_VERSION,
  selectForestOwnerVariants,
} from './forestOwnerVariantSelection.js';
import {
  FOREST_OWNER_WRITING_POLICY_VERSION,
} from './forestOwnerWritingPolicy.js';
import {
  FOREST_POST_TREE_MAPPING_VERSION,
  FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION,
  projectPostToForestTree,
} from './forestPostTreeProjection.js';
import {
  FOREST_WRITING_LIFECYCLE_POLICY_VERSION,
} from './forestWritingLifecyclePolicy.js';

export const FOREST_WRITING_TREE_CREATION_VERSION = 1;
export const FOREST_WRITING_TREE_PROJECTION_REVISION = 1;
export const FOREST_WRITING_TREE_DEFAULT_CANDIDATE_CHECKS = 128;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class ForestWritingTreeCreationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestWritingTreeCreationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestWritingTreeCreationError(code, message);
}

function canonicalObjectId(value, fieldName) {
  const normalized = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    fail(
      'INVALID_TREE_CREATION_INPUT',
      `${fieldName} must be a canonical ObjectId string`,
    );
  }
  return normalized;
}

function validateCandidateLimit(value) {
  if (
    !Number.isSafeInteger(value)
    || value < 1
    || value > FOREST_OWNER_GROVE_PLACEMENT_CONFIG.maximumCandidateChecks
  ) {
    fail(
      'INVALID_TREE_CREATION_DEPENDENCY',
      'maximumCandidateChecks is outside the placement-policy bound',
    );
  }
  return value;
}

function validateNow(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('INVALID_TREE_CREATION_INPUT', 'now must be a valid Date');
  }
  return value;
}

function uuid() {
  return crypto.randomUUID();
}

function worldSeed() {
  return crypto.randomBytes(32).toString('base64url');
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function leanObject(value) {
  if (value?.toObject) return value.toObject();
  return value;
}

function result(outcome, tree, diagnostics = null) {
  return Object.freeze({
    creationVersion: FOREST_WRITING_TREE_CREATION_VERSION,
    outcome,
    tree: tree ? Object.freeze(leanObject(tree)) : null,
    diagnostics: diagnostics ? Object.freeze(diagnostics) : null,
  });
}

function selectFoundingVariant(variant, ownerUserId, translationGroupId) {
  const selection = selectForestOwnerVariants({
    ownerUserId,
    translationGroupId,
    preferredContentLang: variant.lang,
    variants: [variant],
  });
  if (!selection.active || !selection.foundingVariant) {
    fail('FOUNDING_SOURCE_UNRESOLVED', 'founding source selection was not active');
  }
  return selection.foundingVariant;
}

function validateWorld(world) {
  if (
    world?.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || world?.placementPolicyVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || world?.environmentPolicyVersion
      !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || world?.environmentSchemaVersion
      !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || world?.worldGenerationVersion
      !== FOREST_OWNER_WORLD_GENERATION_VERSION
  ) {
    fail('UNSUPPORTED_OWNER_WORLD', 'owner world uses unsupported policy versions');
  }
  if (world.status !== 'active') {
    fail('OWNER_WORLD_UNAVAILABLE', 'owner world is not active');
  }
  if (
    !Number.isSafeInteger(world.nextCandidateSlot)
    || world.nextCandidateSlot < 0
    || !Number.isSafeInteger(world.placementRevision)
    || world.placementRevision < 1
  ) {
    fail('MALFORMED_OWNER_WORLD', 'owner world has invalid placement state');
  }
  if (
    typeof world.worldSeed !== 'string'
    || world.worldSeed.length < 32
    || world.worldSeed.length > 80
    || !BASE64URL_PATTERN.test(world.worldSeed)
    || !Number.isSafeInteger(world.reconciliation?.epoch)
    || world.reconciliation.epoch < 0
  ) {
    fail('MALFORMED_OWNER_WORLD', 'owner world has invalid generation state');
  }
  return world;
}

function validateExistingTree(tree) {
  if (
    tree?.schemaVersion !== FOREST_WRITING_TREE_SCHEMA_VERSION
    || tree?.identityVersion !== FOREST_WRITING_TREE_IDENTITY_VERSION
  ) {
    fail('UNSUPPORTED_EXISTING_TREE', 'existing tree uses unsupported identity versions');
  }
  return tree;
}

async function loadOrCreateWorld({
  ownerUserId,
  session,
  ForestOwnerWorldModel,
  generateUuid,
  generateWorldSeed,
}) {
  let world = await ForestOwnerWorldModel.findOne({
    ownerUserId,
    worldRole: 'primary',
  }).session(session).lean();
  if (!world) {
    [world] = await ForestOwnerWorldModel.create([{
      forestId: generateUuid(),
      ownerUserId,
      worldRole: 'primary',
      status: 'active',
      worldSeed: generateWorldSeed(),
      placementPolicyVersion: FOREST_OWNER_GROVE_PLACEMENT_VERSION,
      nextCandidateSlot: 0,
      placementRevision: 1,
      environmentPolicyVersion: FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
      environmentSchemaVersion: FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
      worldGenerationVersion: FOREST_OWNER_WORLD_GENERATION_VERSION,
    }], { session });
  }
  return validateWorld(world);
}

function projectionSnapshot(projected) {
  if (
    projected?.schemaVersion !== FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
    || projected?.mappingVersion !== FOREST_POST_TREE_MAPPING_VERSION
  ) {
    fail('UNSUPPORTED_TREE_PROJECTION', 'projection returned unsupported versions');
  }
  return {
    revision: FOREST_WRITING_TREE_PROJECTION_REVISION,
    schemaVersion: projected.schemaVersion,
    mappingVersion: projected.mappingVersion,
    specimenSeed: projected.specimen?.seed,
    phenotypeId: projected.phenotype?.id,
    phenotypeAssetVersion: projected.phenotype?.version,
    creationSeason: projected.permanentTraits?.creationSeason,
    foliagePaletteId: projected.permanentTraits?.foliagePaletteId ?? null,
    projectionFingerprint: projected.identity?.projectionFingerprint,
    visualFingerprint: projected.identity?.visualFingerprint,
  };
}

async function reservePlacement({
  ownerUserId,
  world,
  session,
  maximumCandidateChecks,
  ForestWritingTreeModel,
  inspectCandidate,
  resolveEnvironment,
  readNeighborhood,
  allocatePlacements,
}) {
  const startingCandidateSlot = world.nextCandidateSlot;
  let candidateSlot = startingCandidateSlot;
  const diagnostics = {
    inspectedCandidateCount: 0,
    structuralRejectionCount: 0,
    environmentRejectionCount: 0,
    occupiedRejectionCount: 0,
  };

  while (
    diagnostics.inspectedCandidateCount < maximumCandidateChecks
    && candidateSlot <= FOREST_OWNER_GROVE_PLACEMENT_CONFIG.maximumPlacementSlot
  ) {
    const slot = candidateSlot;
    const candidate = inspectCandidate({
      worldSeed: world.worldSeed,
      placementSlot: slot,
    });
    candidateSlot += 1;
    diagnostics.inspectedCandidateCount += 1;
    if (!candidate.enabled || !candidate.clearsCenter) {
      diagnostics.structuralRejectionCount += 1;
      continue;
    }
    const environment = resolveEnvironment({
      worldSeed: world.worldSeed,
      worldX: candidate.worldX,
      worldY: candidate.worldY,
      policyVersion: world.environmentPolicyVersion,
      schemaVersion: world.environmentSchemaVersion,
      worldGenerationVersion: world.worldGenerationVersion,
    });
    if (typeof environment?.suitability?.treeAllowed !== 'boolean') {
      fail(
        'INVALID_TREE_CREATION_DEPENDENCY',
        'environment resolver returned invalid suitability',
      );
    }
    if (!environment.suitability.treeAllowed) {
      diagnostics.environmentRejectionCount += 1;
      continue;
    }
    const neighborhood = await readNeighborhood({
      ownerUserId,
      worldSeed: world.worldSeed,
      placementSlot: slot,
      session,
      ForestWritingTreeModel,
    });
    try {
      const allocation = allocatePlacements({
        worldSeed: world.worldSeed,
        nextCandidateSlot: slot,
        count: 1,
        occupiedPlacements: neighborhood.occupiedPlacements,
        isExcluded: () => false,
        maximumCandidateChecks: 1,
      });
      const placement = allocation?.placements?.[0];
      if (
        placement?.placementVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
        || placement?.placementSlot !== slot
        || placement?.worldX !== candidate.worldX
        || placement?.worldY !== candidate.worldY
      ) {
        fail(
          'INVALID_TREE_CREATION_DEPENDENCY',
          'placement allocator returned a different candidate',
        );
      }
      return {
        placement,
        environment,
        nextCandidateSlot: candidateSlot,
        diagnostics: {
          ...diagnostics,
          acceptedPlacementCount: 1,
        },
      };
    } catch (error) {
      if (
        error instanceof ForestOwnerGrovePlacementError
        && error.code === 'PLACEMENT_SEARCH_EXHAUSTED'
      ) {
        diagnostics.occupiedRejectionCount += 1;
        continue;
      }
      throw error;
    }
  }

  fail(
    'PLACEMENT_SEARCH_EXHAUSTED',
    `no placement was accepted within ${maximumCandidateChecks} candidate checks`,
  );
}

function isDuplicateKey(error) {
  return Number(error?.code) === 11_000;
}

export function buildForestWritingTreeCreationService({
  models = {},
  transactionRunner = runInTransaction,
  acquireFence = acquireForestLedgerFence,
  inspectCandidate = inspectForestOwnerGrovePlacementCandidate,
  resolveEnvironment = resolveForestOwnerEnvironment,
  readNeighborhood = readForestOwnerPlacementNeighborhood,
  allocatePlacements = allocateForestOwnerGrovePlacements,
  projectTree = projectPostToForestTree,
  generateUuid = uuid,
  generateWorldSeed = worldSeed,
  readGroupEvidence = null,
  maximumCandidateChecks = FOREST_WRITING_TREE_DEFAULT_CANDIDATE_CHECKS,
} = {}) {
  const db = {
    AccountDeletionRequest,
    Block,
    ForestOwnerWorld,
    ForestWritingTree,
    User,
    ...models,
  };
  const resolveGroupEvidence = readGroupEvidence
    || buildForestOwnerGroupEvidenceReader({ BlockModel: db.Block });
  const candidateLimit = validateCandidateLimit(maximumCandidateChecks);
  for (const [name, dependency] of Object.entries({
    transactionRunner,
    acquireFence,
    inspectCandidate,
    resolveEnvironment,
    readNeighborhood,
    allocatePlacements,
    projectTree,
    generateUuid,
    generateWorldSeed,
    resolveGroupEvidence,
  })) {
    if (typeof dependency !== 'function') {
      fail('INVALID_TREE_CREATION_DEPENDENCY', `${name} must be a function`);
    }
  }

  return async function createForestWritingTree({
    ownerUserId,
    translationGroupId,
    now = new Date(),
  }) {
    const owner = canonicalObjectId(ownerUserId, 'ownerUserId');
    const group = canonicalObjectId(translationGroupId, 'translationGroupId');
    const transitionTime = validateNow(now);
    try {
      return await transactionRunner(async (session) => {
        await acquireFence({
          ownerUserId: owner,
          session,
          UserModel: db.User,
        });
        const deletionRequest = await db.AccountDeletionRequest.exists({
          ownerUserId: owner,
          status: { $in: ['processing', 'completed'] },
        }).session(session).lean();
        if (deletionRequest) {
          fail('FOREST_OWNER_UNAVAILABLE', 'account deletion suppresses tree creation');
        }

        const existingTree = await db.ForestWritingTree.findOne({
          ownerUserId: owner,
          translationGroupId: group,
        }).session(session).lean();
        if (existingTree) {
          return result('existing', validateExistingTree(existingTree));
        }

        const world = await loadOrCreateWorld({
          ownerUserId: owner,
          session,
          ForestOwnerWorldModel: db.ForestOwnerWorld,
          generateUuid,
          generateWorldSeed,
        });
        const evidence = await resolveGroupEvidence({
          ownerUserId: owner,
          translationGroupId: group,
          session,
        });
        if (evidence.classification
          === FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.UNRESOLVED) {
          fail(
            'FOUNDING_SOURCE_UNRESOLVED',
            `founding source is unresolved: ${evidence.reasonCode}`,
          );
        }
        if (evidence.classification
          !== FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.ELIGIBLE) {
          return result('no-eligible-founder', null);
        }
        const founder = selectFoundingVariant(
          evidence.foundingVariant,
          owner,
          group,
        );

        const reservation = await reservePlacement({
          ownerUserId: owner,
          world,
          session,
          maximumCandidateChecks: candidateLimit,
          ForestWritingTreeModel: db.ForestWritingTree,
          inspectCandidate,
          resolveEnvironment,
          readNeighborhood,
          allocatePlacements,
        });
        const writingTreeId = generateUuid();
        const projected = projectTree({
          id: writingTreeId,
          createdAt: founder.createdAt,
          roomId: founder.roomId,
        }, {
          habitat: reservation.environment.originatingEnvironment.habitatId,
        });
        const placementIndex = deriveForestOwnerPlacementIndex({
          worldX: reservation.placement.worldX,
          worldY: reservation.placement.worldY,
        });
        const [createdTree] = await db.ForestWritingTree.create([{
          writingTreeId,
          forestId: world.forestId,
          ownerUserId: owner,
          translationGroupId: group,
          identityVersion: FOREST_WRITING_TREE_IDENTITY_VERSION,
          sourceState: 'active',
          sourceStateChangedAt: transitionTime,
          hiddenFromForest: false,
          inclusionChangedAt: null,
          foundingSource: {
            blockId: founder.blockId,
            createdAt: new Date(founder.createdAt),
          },
          placement: {
            policyVersion: reservation.placement.placementVersion,
            slot: reservation.placement.placementSlot,
            worldX: reservation.placement.worldX,
            worldY: reservation.placement.worldY,
          },
          placementIndex,
          originatingEnvironment:
            reservation.environment.originatingEnvironment,
          projection: projectionSnapshot(projected),
          policyEvidence: {
            ownerWritingPolicyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
            ownerVariantSelectionVersion:
              FOREST_OWNER_VARIANT_SELECTION_VERSION,
            writingLifecyclePolicyVersion:
              FOREST_WRITING_LIFECYCLE_POLICY_VERSION,
          },
          lastEligibleReconciliationEpoch: world.reconciliation?.epoch || 0,
          recordRevision: 1,
        }], { session });
        const advanced = await db.ForestOwnerWorld.updateOne(
          {
            _id: world._id,
            ownerUserId: owner,
            status: 'active',
            nextCandidateSlot: world.nextCandidateSlot,
            placementRevision: world.placementRevision,
          },
          {
            $set: { nextCandidateSlot: reservation.nextCandidateSlot },
            $inc: { placementRevision: 1 },
          },
          { session },
        );
        if (Number(advanced?.modifiedCount || 0) !== 1) {
          fail('OWNER_WORLD_WRITE_CONFLICT', 'owner world placement state changed');
        }

        return result('created', createdTree, reservation.diagnostics);
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const existingTree = await db.ForestWritingTree.findOne({
        ownerUserId: owner,
        translationGroupId: group,
      }).lean();
      if (existingTree) {
        return result('existing', validateExistingTree(existingTree));
      }
      throw error;
    }
  };
}

export const createForestWritingTree = buildForestWritingTreeCreationService();

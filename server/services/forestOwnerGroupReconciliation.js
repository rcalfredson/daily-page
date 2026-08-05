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
} from './forestOwnerEnvironmentResolver.js';
import {
  FOREST_OWNER_GROVE_PLACEMENT_VERSION,
} from './forestOwnerGrovePlacement.js';
import {
  buildForestOwnerGroupEvidenceReader,
  FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS,
} from './forestOwnerGroupEvidence.js';
import {
  FOREST_OWNER_VARIANT_SELECTION_VERSION,
} from './forestOwnerVariantSelection.js';
import {
  FOREST_OWNER_WRITING_POLICY_VERSION,
} from './forestOwnerWritingPolicy.js';
import {
  FOREST_WRITING_LIFECYCLE_POLICY_VERSION,
} from './forestWritingLifecyclePolicy.js';
import {
  createForestWritingTree,
} from './forestWritingTreeCreation.js';

export const FOREST_OWNER_GROUP_RECONCILIATION_VERSION = 1;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export class ForestOwnerGroupReconciliationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerGroupReconciliationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerGroupReconciliationError(code, message);
}

function canonicalObjectId(value, fieldName) {
  const normalized = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    fail(
      'INVALID_OWNER_GROUP_RECONCILIATION_INPUT',
      `${fieldName} must be a canonical ObjectId string`,
    );
  }
  return normalized;
}

function validNow(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('INVALID_OWNER_GROUP_RECONCILIATION_INPUT', 'now must be a valid Date');
  }
  return value;
}

function leanObject(value) {
  if (value?.toObject) return value.toObject();
  return value;
}

function reconciliationResult(outcome, tree, evidence = null) {
  return Object.freeze({
    reconciliationVersion: FOREST_OWNER_GROUP_RECONCILIATION_VERSION,
    outcome,
    tree: tree ? Object.freeze(leanObject(tree)) : null,
    evidence: evidence ? Object.freeze(evidence) : null,
  });
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

function validateTree(tree, ownerUserId, translationGroupId) {
  if (tree?.schemaVersion !== FOREST_WRITING_TREE_SCHEMA_VERSION
    || tree?.identityVersion !== FOREST_WRITING_TREE_IDENTITY_VERSION
    || tree?.policyEvidence?.ownerWritingPolicyVersion
      !== FOREST_OWNER_WRITING_POLICY_VERSION
    || tree?.policyEvidence?.ownerVariantSelectionVersion
      !== FOREST_OWNER_VARIANT_SELECTION_VERSION
    || tree?.policyEvidence?.writingLifecyclePolicyVersion
      !== FOREST_WRITING_LIFECYCLE_POLICY_VERSION) {
    fail('UNSUPPORTED_WRITING_TREE', 'writing tree uses unsupported policy versions');
  }
  if (tree.ownerUserId !== ownerUserId
    || tree.translationGroupId !== translationGroupId
    || !['active', 'inactive'].includes(tree.sourceState)
    || !Number.isSafeInteger(tree.recordRevision)
    || tree.recordRevision < 1) {
    fail('MALFORMED_WRITING_TREE', 'writing tree has invalid lifecycle identity');
  }
  return tree;
}

function validateWorld(world, tree, ownerUserId) {
  if (world?.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || world?.placementPolicyVersion !== FOREST_OWNER_GROVE_PLACEMENT_VERSION
    || world?.environmentPolicyVersion !== FOREST_OWNER_ENVIRONMENT_POLICY_VERSION
    || world?.environmentSchemaVersion !== FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION
    || world?.worldGenerationVersion !== FOREST_OWNER_WORLD_GENERATION_VERSION) {
    fail('UNSUPPORTED_OWNER_WORLD', 'owner world uses unsupported policy versions');
  }
  if (world.ownerUserId !== ownerUserId
    || world.worldRole !== 'primary'
    || world.status !== 'active'
    || world.forestId !== tree.forestId
    || !Number.isSafeInteger(world.reconciliation?.epoch)
    || world.reconciliation.epoch < 0) {
    fail('MALFORMED_OWNER_WORLD', 'owner world cannot reconcile this writing tree');
  }
  return world;
}

function updatedTree(tree, changes) {
  return { ...tree, ...changes };
}

export function buildForestOwnerGroupReconciliationService({
  models = {},
  transactionRunner = runInTransaction,
  acquireFence = acquireForestLedgerFence,
  readGroupEvidence = null,
  createTree = createForestWritingTree,
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
  for (const [name, dependency] of Object.entries({
    transactionRunner,
    acquireFence,
    resolveGroupEvidence,
    createTree,
  })) {
    if (typeof dependency !== 'function') {
      fail('INVALID_OWNER_GROUP_RECONCILIATION_DEPENDENCY', `${name} must be a function`);
    }
  }

  async function createMissingTree({ ownerUserId, translationGroupId, now }) {
    const creation = await createTree({ ownerUserId, translationGroupId, now });
    if (creation.outcome === 'created') {
      return reconciliationResult('created', creation.tree);
    }
    if (creation.outcome === 'no-eligible-founder') {
      return reconciliationResult('absent', null);
    }
    if (creation.outcome !== 'existing') {
      fail('INVALID_TREE_CREATION_RESULT', 'tree creator returned an unsupported outcome');
    }
    return null;
  }

  async function reconcileExisting({ ownerUserId, translationGroupId, now }) {
    return transactionRunner(async (session) => {
      await acquireFence({
        ownerUserId,
        session,
        UserModel: db.User,
      });
      const deletionRequest = await db.AccountDeletionRequest.exists({
        ownerUserId,
        status: { $in: ['processing', 'completed'] },
      }).session(session).lean();
      if (deletionRequest) {
        fail('FOREST_OWNER_UNAVAILABLE', 'account deletion suppresses reconciliation');
      }

      const tree = await db.ForestWritingTree.findOne({
        ownerUserId,
        translationGroupId,
      }).session(session).lean();
      if (!tree) return reconciliationResult('missing-after-fence', null);
      validateTree(tree, ownerUserId, translationGroupId);
      const world = await db.ForestOwnerWorld.findOne({
        ownerUserId,
        worldRole: 'primary',
      }).session(session).lean();
      validateWorld(world, tree, ownerUserId);

      const evidence = await resolveGroupEvidence({
        ownerUserId,
        translationGroupId,
        session,
      });
      if (evidence.classification
        === FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.UNRESOLVED) {
        return reconciliationResult('unresolved', tree, {
          classification: evidence.classification,
          reasonCode: evidence.reasonCode,
        });
      }

      const eligible = evidence.classification
        === FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.ELIGIBLE;
      if (!eligible && evidence.classification
        !== FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.INELIGIBLE) {
        fail('INVALID_OWNER_GROUP_EVIDENCE', 'evidence reader returned an unsupported outcome');
      }

      let outcome;
      let set;
      let incrementRevision = false;
      if (eligible && tree.sourceState === 'inactive') {
        outcome = 'reactivated';
        set = {
          sourceState: 'active',
          sourceStateChangedAt: now,
          lastEligibleReconciliationEpoch: world.reconciliation.epoch,
        };
        incrementRevision = true;
      } else if (eligible) {
        outcome = 'preserved';
        if (tree.lastEligibleReconciliationEpoch !== world.reconciliation.epoch) {
          set = { lastEligibleReconciliationEpoch: world.reconciliation.epoch };
        }
      } else if (tree.sourceState === 'active') {
        outcome = 'deactivated';
        set = { sourceState: 'inactive', sourceStateChangedAt: now };
        incrementRevision = true;
      } else {
        outcome = 'inactive';
      }

      if (!set) {
        return reconciliationResult(outcome, tree, {
          classification: evidence.classification,
          reasonCode: evidence.reasonCode,
        });
      }
      const update = { $set: set };
      if (incrementRevision) update.$inc = { recordRevision: 1 };
      const write = await db.ForestWritingTree.updateOne(
        {
          _id: tree._id,
          ownerUserId,
          translationGroupId,
          sourceState: tree.sourceState,
          recordRevision: tree.recordRevision,
        },
        update,
        { session },
      );
      if (Number(write?.modifiedCount || 0) !== 1) {
        fail('WRITING_TREE_WRITE_CONFLICT', 'writing tree lifecycle state changed');
      }
      return reconciliationResult(
        outcome,
        updatedTree(tree, {
          ...set,
          recordRevision: incrementRevision
            ? tree.recordRevision + 1
            : tree.recordRevision,
        }),
        {
          classification: evidence.classification,
          reasonCode: evidence.reasonCode,
        },
      );
    });
  }

  return async function reconcileForestOwnerGroup({
    ownerUserId,
    translationGroupId,
    now = new Date(),
  }) {
    const owner = canonicalObjectId(ownerUserId, 'ownerUserId');
    const group = canonicalObjectId(translationGroupId, 'translationGroupId');
    const transitionTime = validNow(now);
    const hint = await db.ForestWritingTree.findOne({
      ownerUserId: owner,
      translationGroupId: group,
    }).lean();
    if (!hint) {
      const creation = await createMissingTree({
        ownerUserId: owner,
        translationGroupId: group,
        now: transitionTime,
      });
      if (creation) return creation;
    }

    const existing = await reconcileExisting({
      ownerUserId: owner,
      translationGroupId: group,
      now: transitionTime,
    });
    if (existing.outcome !== 'missing-after-fence') return existing;
    const creation = await createMissingTree({
      ownerUserId: owner,
      translationGroupId: group,
      now: transitionTime,
    });
    if (creation) return creation;
    fail('WRITING_TREE_RECONCILIATION_RACE', 'tree identity changed repeatedly');
  };
}

export const reconcileForestOwnerGroup = buildForestOwnerGroupReconciliationService();

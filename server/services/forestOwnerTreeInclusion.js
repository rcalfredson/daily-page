import mongoose from 'mongoose';

import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import User from '../db/models/User.js';
import { FOREST_OWNER_WORLD_SCHEMA_VERSION } from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION
} from '../db/schemas/ForestWritingTreeSchema.js';
import { acquireForestLedgerFence } from './forestLedgerFence.js';

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export class ForestOwnerTreeInclusionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerTreeInclusionError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerTreeInclusionError(code, message);
}

function canonicalOwner(value) {
  const ownerUserId = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(ownerUserId)) {
    fail('INVALID_TREE_INCLUSION_INPUT', 'ownerUserId must be a canonical ObjectId string.');
  }
  return ownerUserId;
}

function canonicalTreeId(value) {
  const writingTreeId = String(value || '').toLowerCase();
  if (!UUID_V4_PATTERN.test(writingTreeId)) {
    fail('INVALID_TREE_INCLUSION_INPUT', 'writingTreeId must be a canonical UUID.');
  }
  return writingTreeId;
}

function exactDesiredState(value) {
  if (typeof value !== 'boolean') {
    fail('INVALID_TREE_INCLUSION_INPUT', 'hidden must be boolean.');
  }
  return value;
}

function exactRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail('INVALID_TREE_INCLUSION_INPUT', 'expectedRevision must be a positive safe integer.');
  }
  return value;
}

function exactNow(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('INVALID_TREE_INCLUSION_INPUT', 'now must be a valid Date.');
  }
  return value;
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

function queryResult(query) {
  const lean = query.lean();
  return typeof lean.exec === 'function' ? lean.exec() : lean;
}

function result(outcome, tree) {
  return {
    outcome,
    tree: {
      writingTreeId: tree.writingTreeId,
      hiddenFromForest: tree.hiddenFromForest,
      inclusionChangedAt: tree.inclusionChangedAt
        ? tree.inclusionChangedAt.toISOString?.()
          || new Date(tree.inclusionChangedAt).toISOString()
        : null,
      recordRevision: tree.recordRevision
    }
  };
}

export function buildForestOwnerTreeInclusionService({
  models = {},
  transactionRunner = runInTransaction,
  acquireFence = acquireForestLedgerFence
} = {}) {
  const db = {
    AccountDeletionRequest,
    ForestOwnerWorld,
    ForestWritingTree,
    User,
    ...models
  };

  return async function setForestOwnerTreeInclusion({
    ownerUserId: ownerValue,
    writingTreeId: treeValue,
    hidden: hiddenValue,
    expectedRevision: revisionValue,
    now = new Date()
  }) {
    const ownerUserId = canonicalOwner(ownerValue);
    const writingTreeId = canonicalTreeId(treeValue);
    const hidden = exactDesiredState(hiddenValue);
    const expectedRevision = exactRevision(revisionValue);
    const changedAt = exactNow(now);

    return transactionRunner(async (session) => {
      await acquireFence({ ownerUserId, session, UserModel: db.User });
      const deletion = await db.AccountDeletionRequest.exists({
        ownerUserId,
        status: { $in: ['processing', 'completed'] }
      }).session(session).lean();
      if (deletion) fail('TREE_INCLUSION_UNAVAILABLE', 'Account deletion suppresses inclusion.');

      const world = await queryResult(db.ForestOwnerWorld.findOne({
        ownerUserId,
        worldRole: 'primary'
      }).session(session));
      if (!world
        || world.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
        || world.ownerUserId !== ownerUserId
        || world.worldRole !== 'primary'
        || world.status !== 'active'
        || !UUID_V4_PATTERN.test(world.forestId || '')) {
        fail('TREE_INCLUSION_UNAVAILABLE', 'The owner world is unavailable.');
      }

      const tree = await queryResult(db.ForestWritingTree.findOne({
        ownerUserId,
        forestId: world.forestId,
        writingTreeId,
        sourceState: 'active'
      }).session(session));
      if (!tree) fail('TREE_INCLUSION_NOT_FOUND', 'The writing tree is unavailable.');
      if (tree.schemaVersion !== FOREST_WRITING_TREE_SCHEMA_VERSION
        || tree.identityVersion !== FOREST_WRITING_TREE_IDENTITY_VERSION
        || tree.ownerUserId !== ownerUserId
        || tree.forestId !== world.forestId
        || tree.writingTreeId !== writingTreeId
        || typeof tree.hiddenFromForest !== 'boolean'
        || !Number.isSafeInteger(tree.recordRevision)
        || tree.recordRevision < 1) {
        fail('TREE_INCLUSION_UNAVAILABLE', 'The writing tree has unsupported identity.');
      }

      if (tree.hiddenFromForest === hidden) return result('unchanged', tree);
      if (tree.recordRevision !== expectedRevision) {
        fail('TREE_INCLUSION_CONFLICT', 'The writing tree revision changed.');
      }

      const write = await db.ForestWritingTree.updateOne({
        _id: tree._id,
        ownerUserId,
        forestId: world.forestId,
        writingTreeId,
        sourceState: 'active',
        hiddenFromForest: tree.hiddenFromForest,
        recordRevision: expectedRevision
      }, {
        $set: { hiddenFromForest: hidden, inclusionChangedAt: changedAt },
        $inc: { recordRevision: 1 }
      }, { session });
      if (Number(write?.modifiedCount || 0) !== 1) {
        fail('TREE_INCLUSION_CONFLICT', 'The writing tree inclusion changed concurrently.');
      }
      return result(hidden ? 'hidden' : 'unhidden', {
        ...tree,
        hiddenFromForest: hidden,
        inclusionChangedAt: changedAt,
        recordRevision: expectedRevision + 1
      });
    });
  };
}

export const setForestOwnerTreeInclusion = buildForestOwnerTreeInclusionService();

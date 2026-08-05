import crypto from 'node:crypto';

import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  FOREST_OWNER_WORLD_SCHEMA_VERSION,
} from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION,
} from '../db/schemas/ForestWritingTreeSchema.js';
import {
  FOREST_OWNER_BLOCK_ADAPTER_VERSION,
  FOREST_OWNER_BLOCK_MAX_PAGE_SIZE,
  listForestOwnerBlockPage,
} from './forestOwnerBlockAdapter.js';
import {
  FOREST_OWNER_ENVIRONMENT_POLICY_VERSION,
  FOREST_OWNER_ENVIRONMENT_SCHEMA_VERSION,
  FOREST_OWNER_WORLD_GENERATION_VERSION,
} from './forestOwnerEnvironmentResolver.js';
import {
  reconcileForestOwnerGroup,
} from './forestOwnerGroupReconciliation.js';
import {
  FOREST_OWNER_GROVE_PLACEMENT_VERSION,
} from './forestOwnerGrovePlacement.js';
import {
  FOREST_OWNER_WRITING_POLICY_VERSION,
} from './forestOwnerWritingPolicy.js';

export const FOREST_OWNER_CONVERGENCE_SWEEP_VERSION = 1;
export const FOREST_OWNER_CONVERGENCE_DEFAULT_BLOCK_PAGE_SIZE = 25;
export const FOREST_OWNER_CONVERGENCE_DEFAULT_TREE_PAGE_SIZE = 25;
export const FOREST_OWNER_CONVERGENCE_MAX_TREE_PAGE_SIZE = 100;
export const FOREST_OWNER_CONVERGENCE_DEFAULT_LEASE_MS = 300_000;
export const FOREST_OWNER_CONVERGENCE_DEFAULT_OWNER_LIMIT = 5;
export const FOREST_OWNER_CONVERGENCE_MAX_OWNER_LIMIT = 25;
export const FOREST_OWNER_CONVERGENCE_DEFAULT_INTERVAL_MS = 21_600_000;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MINIMUM_LEASE_MS = 30_000;
const MAXIMUM_LEASE_MS = 900_000;
const MAXIMUM_STEPS = 10;
const MAXIMUM_INTERVAL_MS = 604_800_000;

export class ForestOwnerConvergenceSweepError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerConvergenceSweepError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerConvergenceSweepError(code, message);
}

function canonicalObjectId(value, fieldName) {
  const normalized = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    fail('INVALID_CONVERGENCE_SWEEP_INPUT', `${fieldName} must be a canonical ObjectId string`);
  }
  return normalized;
}

function validDate(value, fieldName) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('INVALID_CONVERGENCE_SWEEP_INPUT', `${fieldName} must be a valid Date`);
  }
  return value;
}

function boundedInteger(value, fieldName, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(
      'INVALID_CONVERGENCE_SWEEP_INPUT',
      `${fieldName} must be an integer from ${minimum} through ${maximum}`,
    );
  }
  return value;
}

function token() {
  return crypto.randomBytes(24).toString('base64url');
}

function validateWorld(world, ownerUserId) {
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
    || world.reconciliation?.state !== 'running'
    || !['owner-blocks', 'unseen-trees'].includes(world.reconciliation.phase)
    || !Number.isSafeInteger(world.reconciliation.epoch)
    || world.reconciliation.epoch < 1
    || typeof world.reconciliation.leaseToken !== 'string') {
    fail('MALFORMED_OWNER_WORLD', 'owner world has invalid sweep state');
  }
  return world;
}

function reasonCounts() {
  return Object.create(null);
}

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

function pageDiagnostics() {
  return {
    scannedBlocks: 0,
    scannedTrees: 0,
    reconciledGroups: 0,
    reconciliationOutcomes: reasonCounts(),
    reasonCounts: reasonCounts(),
  };
}

function mergeDiagnostics(total, page) {
  total.scannedBlocks += page.scannedBlocks;
  total.scannedTrees += page.scannedTrees;
  total.reconciledGroups += page.reconciledGroups;
  for (const [key, value] of Object.entries(page.reconciliationOutcomes)) {
    total.reconciliationOutcomes[key] = (total.reconciliationOutcomes[key] || 0) + value;
  }
  for (const [key, value] of Object.entries(page.reasonCounts)) {
    total.reasonCounts[key] = (total.reasonCounts[key] || 0) + value;
  }
}

function sweepResult(outcome, world, diagnostics) {
  return Object.freeze({
    sweepVersion: FOREST_OWNER_CONVERGENCE_SWEEP_VERSION,
    outcome,
    epoch: world?.reconciliation?.epoch ?? null,
    phase: outcome === 'completed' ? null : world?.reconciliation?.phase ?? null,
    diagnostics: Object.freeze({
      ...diagnostics,
      reconciliationOutcomes: Object.freeze({ ...diagnostics.reconciliationOutcomes }),
      reasonCounts: Object.freeze({ ...diagnostics.reasonCounts }),
    }),
  });
}

function validTreeSummary(tree, ownerUserId) {
  return tree?.schemaVersion === FOREST_WRITING_TREE_SCHEMA_VERSION
    && tree?.identityVersion === FOREST_WRITING_TREE_IDENTITY_VERSION
    && tree?.ownerUserId === ownerUserId
    && OBJECT_ID_PATTERN.test(String(tree?.translationGroupId || ''))
    && UUID_V4_PATTERN.test(String(tree?.writingTreeId || ''));
}

export function buildForestOwnerConvergenceSweep({
  ForestOwnerWorldModel = ForestOwnerWorld,
  ForestWritingTreeModel = ForestWritingTree,
  listBlockPage = listForestOwnerBlockPage,
  reconcileGroup = reconcileForestOwnerGroup,
  generateLeaseToken = token,
  clock = () => new Date(),
} = {}) {
  for (const method of ['findOneAndUpdate', 'updateOne']) {
    if (typeof ForestOwnerWorldModel?.[method] !== 'function') {
      fail('INVALID_CONVERGENCE_SWEEP_DEPENDENCY', `ForestOwnerWorldModel.${method} is required`);
    }
  }
  if (!ForestWritingTreeModel?.find
    || typeof listBlockPage !== 'function'
    || typeof reconcileGroup !== 'function'
    || typeof generateLeaseToken !== 'function'
    || typeof clock !== 'function') {
    fail('INVALID_CONVERGENCE_SWEEP_DEPENDENCY', 'sweep dependencies are incomplete');
  }

  async function claimWorld(ownerUserId, now, leaseMs) {
    const leaseToken = generateLeaseToken();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const options = { returnDocument: 'after' };
    let world = await ForestOwnerWorldModel.findOneAndUpdate(
      {
        ownerUserId,
        worldRole: 'primary',
        status: 'active',
        'reconciliation.state': 'running',
        'reconciliation.leaseExpiresAt': { $lte: now },
      },
      {
        $set: {
          'reconciliation.leaseToken': leaseToken,
          'reconciliation.leaseExpiresAt': leaseExpiresAt,
        },
      },
      options,
    ).lean();
    if (!world) {
      world = await ForestOwnerWorldModel.findOneAndUpdate(
        {
          ownerUserId,
          worldRole: 'primary',
          status: 'active',
          'reconciliation.state': 'idle',
          'reconciliation.epoch': { $lt: Number.MAX_SAFE_INTEGER },
        },
        {
          $set: {
            'reconciliation.state': 'running',
            'reconciliation.phase': 'owner-blocks',
            'reconciliation.blockCursor': null,
            'reconciliation.treeCursor': null,
            'reconciliation.startedAt': now,
            'reconciliation.completedAt': null,
            'reconciliation.leaseToken': leaseToken,
            'reconciliation.leaseExpiresAt': leaseExpiresAt,
          },
          $inc: { 'reconciliation.epoch': 1 },
        },
        options,
      ).lean();
    }
    return world ? validateWorld(world, ownerUserId) : null;
  }

  async function reconcileGroups(ownerUserId, groupIds, now, diagnostics) {
    for (const translationGroupId of groupIds) {
      const result = await reconcileGroup({ ownerUserId, translationGroupId, now });
      diagnostics.reconciledGroups += 1;
      increment(diagnostics.reconciliationOutcomes, result.outcome);
      if (result.outcome === 'unresolved') {
        increment(
          diagnostics.reasonCounts,
          result.evidence?.reasonCode || 'unresolved',
        );
      }
    }
  }

  async function writeProgress(world, leaseToken, set) {
    const write = await ForestOwnerWorldModel.updateOne(
      {
        _id: world._id,
        ownerUserId: world.ownerUserId,
        status: 'active',
        'reconciliation.state': 'running',
        'reconciliation.epoch': world.reconciliation.epoch,
        'reconciliation.phase': world.reconciliation.phase,
        'reconciliation.leaseToken': leaseToken,
      },
      { $set: set },
    );
    if (Number(write?.modifiedCount || 0) !== 1) {
      fail('CONVERGENCE_SWEEP_LEASE_LOST', 'owner-world sweep lease changed');
    }
  }

  async function processBlockPage(world, leaseToken, blockPageSize, now, leaseMs) {
    const diagnostics = pageDiagnostics();
    const page = await listBlockPage({
      authenticatedOwnerId: world.ownerUserId,
      cursor: world.reconciliation.blockCursor,
      limit: blockPageSize,
    });
    if (page?.adapterVersion !== FOREST_OWNER_BLOCK_ADAPTER_VERSION
      || page?.ownerWritingPolicyVersion !== FOREST_OWNER_WRITING_POLICY_VERSION
      || !page.page
      || !Array.isArray(page.eligibleBlocks)) {
      fail('INVALID_OWNER_BLOCK_PAGE', 'owner Block adapter returned unsupported evidence');
    }
    diagnostics.scannedBlocks = page.page.scannedBlockCount;
    for (const [key, value] of Object.entries(page.page.reasonCounts || {})) {
      diagnostics.reasonCounts[key] = value;
    }
    const groups = [...new Set(page.eligibleBlocks.map((block) => (
      canonicalObjectId(block.translationGroupId, 'translationGroupId')
    )))];
    await reconcileGroups(world.ownerUserId, groups, now, diagnostics);

    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    if (page.page.nextCursor) {
      await writeProgress(world, leaseToken, {
        'reconciliation.blockCursor': page.page.nextCursor,
        'reconciliation.leaseExpiresAt': leaseExpiresAt,
      });
      world.reconciliation.blockCursor = page.page.nextCursor;
    } else {
      await writeProgress(world, leaseToken, {
        'reconciliation.phase': 'unseen-trees',
        'reconciliation.blockCursor': null,
        'reconciliation.treeCursor': null,
        'reconciliation.leaseExpiresAt': leaseExpiresAt,
      });
      world.reconciliation.phase = 'unseen-trees';
      world.reconciliation.blockCursor = null;
      world.reconciliation.treeCursor = null;
    }
    world.reconciliation.leaseExpiresAt = leaseExpiresAt;
    return diagnostics;
  }

  async function processUnseenTreePage(world, leaseToken, treePageSize, now, leaseMs) {
    const diagnostics = pageDiagnostics();
    const filter = {
      ownerUserId: world.ownerUserId,
      sourceState: 'active',
      lastEligibleReconciliationEpoch: { $ne: world.reconciliation.epoch },
      ...(world.reconciliation.treeCursor
        ? { writingTreeId: { $gt: world.reconciliation.treeCursor } }
        : {}),
    };
    const rows = await ForestWritingTreeModel.find(filter, {
      _id: 1,
      schemaVersion: 1,
      identityVersion: 1,
      ownerUserId: 1,
      translationGroupId: 1,
      writingTreeId: 1,
    }).sort({ writingTreeId: 1 }).limit(treePageSize + 1).lean();
    if (!Array.isArray(rows) || rows.length > treePageSize + 1) {
      fail('INVALID_UNSEEN_TREE_PAGE', 'unseen-tree query returned an invalid bounded page');
    }
    const scanned = rows.slice(0, treePageSize);
    diagnostics.scannedTrees = scanned.length;
    const groups = [];
    for (const tree of scanned) {
      if (!validTreeSummary(tree, world.ownerUserId)) {
        increment(diagnostics.reasonCounts, 'unsupported-or-malformed-tree');
        continue;
      }
      groups.push(String(tree.translationGroupId).toLowerCase());
    }
    await reconcileGroups(world.ownerUserId, [...new Set(groups)], now, diagnostics);

    const hasNextPage = rows.length > treePageSize;
    if (hasNextPage) {
      const nextCursor = String(scanned.at(-1)?.writingTreeId || '');
      if (!UUID_V4_PATTERN.test(nextCursor)) {
        fail('MALFORMED_UNSEEN_TREE_CURSOR', 'unseen-tree page cannot produce a safe cursor');
      }
      const leaseExpiresAt = new Date(now.getTime() + leaseMs);
      await writeProgress(world, leaseToken, {
        'reconciliation.treeCursor': nextCursor,
        'reconciliation.leaseExpiresAt': leaseExpiresAt,
      });
      world.reconciliation.treeCursor = nextCursor;
      world.reconciliation.leaseExpiresAt = leaseExpiresAt;
      return { diagnostics, completed: false };
    }

    await writeProgress(world, leaseToken, {
      'reconciliation.state': 'idle',
      'reconciliation.phase': null,
      'reconciliation.blockCursor': null,
      'reconciliation.treeCursor': null,
      'reconciliation.startedAt': null,
      'reconciliation.completedAt': now,
      'reconciliation.leaseToken': null,
      'reconciliation.leaseExpiresAt': null,
    });
    world.reconciliation.state = 'idle';
    world.reconciliation.phase = null;
    world.reconciliation.treeCursor = null;
    world.reconciliation.startedAt = null;
    world.reconciliation.completedAt = now;
    world.reconciliation.leaseToken = null;
    world.reconciliation.leaseExpiresAt = null;
    return { diagnostics, completed: true };
  }

  return async function runForestOwnerConvergenceSweepStep({
    ownerUserId,
    blockPageSize = FOREST_OWNER_CONVERGENCE_DEFAULT_BLOCK_PAGE_SIZE,
    treePageSize = FOREST_OWNER_CONVERGENCE_DEFAULT_TREE_PAGE_SIZE,
    leaseMs = FOREST_OWNER_CONVERGENCE_DEFAULT_LEASE_MS,
    maxSteps = 1,
    now = null,
  }) {
    const owner = canonicalObjectId(ownerUserId, 'ownerUserId');
    const blocksPerPage = boundedInteger(
      blockPageSize,
      'blockPageSize',
      1,
      FOREST_OWNER_BLOCK_MAX_PAGE_SIZE,
    );
    const treesPerPage = boundedInteger(
      treePageSize,
      'treePageSize',
      1,
      FOREST_OWNER_CONVERGENCE_MAX_TREE_PAGE_SIZE,
    );
    const leaseDuration = boundedInteger(
      leaseMs,
      'leaseMs',
      MINIMUM_LEASE_MS,
      MAXIMUM_LEASE_MS,
    );
    const stepLimit = boundedInteger(maxSteps, 'maxSteps', 1, MAXIMUM_STEPS);
    const fixedTime = now === null ? null : validDate(now, 'now');
    const claimedAt = fixedTime || validDate(clock(), 'clock()');
    const world = await claimWorld(owner, claimedAt, leaseDuration);
    const diagnostics = pageDiagnostics();
    if (!world) return sweepResult('not-claimable', null, diagnostics);
    const leaseToken = world.reconciliation.leaseToken;

    for (let step = 0; step < stepLimit; step += 1) {
      const stepTime = fixedTime || validDate(clock(), 'clock()');
      if (world.reconciliation.phase === 'owner-blocks') {
        const page = await processBlockPage(
          world,
          leaseToken,
          blocksPerPage,
          stepTime,
          leaseDuration,
        );
        mergeDiagnostics(diagnostics, page);
      } else {
        const page = await processUnseenTreePage(
          world,
          leaseToken,
          treesPerPage,
          stepTime,
          leaseDuration,
        );
        mergeDiagnostics(diagnostics, page.diagnostics);
        if (page.completed) return sweepResult('completed', world, diagnostics);
      }
    }

    const releaseTime = new Date(Math.max(
      (fixedTime || validDate(clock(), 'clock()')).getTime(),
      new Date(world.reconciliation.startedAt).getTime() + 1,
    ));
    await writeProgress(world, leaseToken, {
      'reconciliation.leaseExpiresAt': releaseTime,
    });
    world.reconciliation.leaseExpiresAt = releaseTime;
    return sweepResult('progressed', world, diagnostics);
  };
}

export const runForestOwnerConvergenceSweepStep = buildForestOwnerConvergenceSweep();

function expiredRunningWorldFilter(now) {
  return {
    status: 'active',
    worldRole: 'primary',
    'reconciliation.state': 'running',
    'reconciliation.leaseExpiresAt': { $lte: now },
  };
}

function dueIdleWorldFilter(now, intervalMs) {
  const dueBefore = new Date(now.getTime() - intervalMs);
  return {
    status: 'active',
    worldRole: 'primary',
    'reconciliation.state': 'idle',
    $or: [
      { 'reconciliation.completedAt': null },
      { 'reconciliation.completedAt': { $lte: dueBefore } },
    ],
  };
}

export function buildForestOwnerConvergenceSweepWorker({
  ForestOwnerWorldModel = ForestOwnerWorld,
  runSweepStep = runForestOwnerConvergenceSweepStep,
  logger = console,
  clock = () => new Date(),
} = {}) {
  if (!ForestOwnerWorldModel?.find
    || typeof runSweepStep !== 'function'
    || typeof clock !== 'function') {
    fail('INVALID_CONVERGENCE_SWEEP_DEPENDENCY', 'sweep worker dependencies are incomplete');
  }
  return async function processForestOwnerConvergenceSweeps({
    limit = FOREST_OWNER_CONVERGENCE_DEFAULT_OWNER_LIMIT,
    intervalMs = FOREST_OWNER_CONVERGENCE_DEFAULT_INTERVAL_MS,
    now = null,
  } = {}) {
    const ownerLimit = boundedInteger(
      limit,
      'limit',
      1,
      FOREST_OWNER_CONVERGENCE_MAX_OWNER_LIMIT,
    );
    const interval = boundedInteger(intervalMs, 'intervalMs', 0, MAXIMUM_INTERVAL_MS);
    const fixedTime = now === null ? null : validDate(now, 'now');
    const selectedAt = fixedTime || validDate(clock(), 'clock()');
    const running = await ForestOwnerWorldModel.find(
      expiredRunningWorldFilter(selectedAt),
      { _id: 0, ownerUserId: 1 },
    ).sort({ 'reconciliation.leaseExpiresAt': 1, ownerUserId: 1 })
      .limit(ownerLimit).lean();
    if (!Array.isArray(running) || running.length > ownerLimit) {
      fail('INVALID_DUE_OWNER_PAGE', 'running-owner query returned an invalid bounded page');
    }
    const remaining = ownerLimit - running.length;
    let idle = [];
    if (remaining > 0) {
      idle = await ForestOwnerWorldModel.find(
        dueIdleWorldFilter(selectedAt, interval),
        { _id: 0, ownerUserId: 1 },
      ).sort({ 'reconciliation.completedAt': 1, ownerUserId: 1 })
        .limit(remaining).lean();
    }
    const worlds = [...running, ...idle];
    if (!Array.isArray(worlds) || worlds.length > ownerLimit) {
      fail('INVALID_DUE_OWNER_PAGE', 'due-owner query returned an invalid bounded page');
    }
    const totals = {
      selected: worlds.length,
      progressed: 0,
      completed: 0,
      notClaimable: 0,
      failed: 0,
    };
    for (const world of worlds) {
      try {
        const attemptedAt = fixedTime || validDate(clock(), 'clock()');
        const result = await runSweepStep({
          ownerUserId: canonicalObjectId(world.ownerUserId, 'ownerUserId'),
          now: attemptedAt,
        });
        if (result.outcome === 'progressed') totals.progressed += 1;
        else if (result.outcome === 'completed') totals.completed += 1;
        else totals.notClaimable += 1;
      } catch (error) {
        totals.failed += 1;
        logger.error('Failed forest owner convergence sweep:', {
          error: error?.name || 'Error',
        });
      }
    }
    return Object.freeze(totals);
  };
}

export const processForestOwnerConvergenceSweeps =
  buildForestOwnerConvergenceSweepWorker();

export {
  dueIdleWorldFilter as forestOwnerConvergenceDueIdleWorldFilter,
  expiredRunningWorldFilter as forestOwnerConvergenceExpiredRunningWorldFilter,
};

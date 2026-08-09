import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import AccountDeletionRequest from '../../server/db/models/AccountDeletionRequest.js';
import AuthSession from '../../server/db/models/AuthSession.js';
import Backup from '../../server/db/models/Backup.js';
import Block from '../../server/db/models/Block.js';
import BlockComment from '../../server/db/models/BlockComment.js';
import BlockReaction from '../../server/db/models/BlockReaction.js';
import CommentRateEvent from '../../server/db/models/CommentRateEvent.js';
import CommentReport from '../../server/db/models/CommentReport.js';
import Flag from '../../server/db/models/Flag.js';
import ForestOwnerGroupReconciliationJob from '../../server/db/models/ForestOwnerGroupReconciliationJob.js';
import ForestOwnerWorld from '../../server/db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../../server/db/models/ForestWritingTree.js';
import Notification from '../../server/db/models/Notification.js';
import Quest from '../../server/db/models/Quest.js';
import QuestItem from '../../server/db/models/QuestItem.js';
import QuestSubmission from '../../server/db/models/QuestSubmission.js';
import Room from '../../server/db/models/Room.js';
import Session from '../../server/db/models/Session.js';
import User from '../../server/db/models/User.js';
import UsernameReservation from '../../server/db/models/UsernameReservation.js';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import { deleteAccount } from '../../server/services/accountDeletion.js';
import {
  cleanUpAccountDeletionForests
} from '../../server/services/accountDeletionForestCleanup.js';
import {
  acquireForestLedgerFence,
  ForestLedgerFenceError
} from '../../server/services/forestLedgerFence.js';
import {
  readForestOwnerPlacementNeighborhood
} from '../../server/services/forestOwnerPlacementNeighborhood.js';
import {
  buildForestWritingTreeCreationService,
  createForestWritingTree
} from '../../server/services/forestWritingTreeCreation.js';
import {
  reconcileForestOwnerGroup
} from '../../server/services/forestOwnerGroupReconciliation.js';
import {
  buildForestOwnerGroupReconciliationWorker,
  enqueueForestOwnerGroupReconciliation,
  processForestOwnerGroupReconciliationJobs
} from '../../server/services/forestOwnerGroupReconciliationQueue.js';
import {
  runForestOwnerConvergenceSweepStep
} from '../../server/services/forestOwnerConvergenceSweep.js';
import {
  listForestOwnerWritingTrees
} from '../../server/services/forestOwnerNonCanvasRead.js';
import {
  deliverForestOwnerRegionAssets
} from '../../server/services/forestOwnerRegionAssetDelivery.js';
import {
  FOREST_OWNER_REGION_MAX_PAGE_SIZE,
  readForestOwnerRegionManifest
} from '../../server/services/forestOwnerRegionManifest.js';
import {
  FOREST_ASSET_TRANSPORT_RASTER
} from '../../server/services/forestSceneAssetTransport.js';
import {
  ACCOUNT_DELETION_FIXTURE_ROOM_ID,
  ACCOUNT_DELETION_FIXTURE_SCENARIOS,
  ACCOUNT_DELETION_FIXTURE_TAG,
  buildAccountDeletionFixture,
  buildForestReadPaginationPosts,
  DEFAULT_ACCOUNT_DELETION_FIXTURE_PASSWORD,
  expectedRetainedPostKeys,
  parseAccountDeletionFixtureArgs
} from '../lib/accountDeletionFixture.js';
import {
  buildForestOwnerPressurePosts,
  forestPressureNeighborhoods,
  FOREST_OWNER_PRESSURE_TAG,
  FOREST_OWNER_PRESSURE_TREE_COUNT,
  summarizeForestPressureCells,
  summarizeForestPressureTimings
} from '../lib/forestOwnerPressureFixture.js';

function usage() {
  console.log('Usage: npm run account-deletion:fixture -- <command> <scenario> [options]');
  console.log('');
  console.log(`Scenarios: ${ACCOUNT_DELETION_FIXTURE_SCENARIOS.join(', ')}`);
  console.log('');
  console.log('Commands:');
  console.log('  seed <scenario> --write [--active-quest]  Reset and seed one scenario.');
  console.log('  verify-before <scenario>                  Verify the login-ready fixture.');
  console.log('  delete-direct <scenario> --write          Invoke the deletion service directly.');
  console.log('  create-tree-direct <scenario> --write     Verify transactional tree creation.');
  console.log('  seed-forest-pagination <scenario> --write Seed and verify three writing pages.');
  console.log('  seed-forest-pressure <scenario> --write   Seed and measure 600 real trees.');
  console.log('  verify-after <scenario>                   Verify the completed deletion.');
  console.log('  archive-quest <scenario> --write          Remove the active-quest guard.');
  console.log('  reset <scenario> --write                  Remove one fixture scenario.');
  console.log('');
  console.log('This script only connects to daily-page-test. Production access is unsupported.');
}

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === 'production' || envFlag(process.env.USE_PRODUCTION_DB)) {
    throw new Error('Refusing to run account-deletion fixtures in a production environment.');
  }
}

async function repairFixtureTtlIndex(model, field) {
  const indexes = await model.collection.indexes();
  const conflicting = indexes.find((index) => (
    index.key?.[field] === 1 && index.expireAfterSeconds !== 0
  ));
  if (conflicting) {
    await model.collection.dropIndex(conflicting.name);
  }
}

async function connectFixtureDatabase() {
  assertSafeEnvironment();
  await initMongooseConnection({ useProductionDb: false });
  if (mongoose.connection.name !== 'daily-page-test') {
    throw new Error(
      `Refusing fixture operation on unexpected database "${mongoose.connection.name}".`
    );
  }
  for (const model of [
    AccountDeletionRequest,
    AuthSession,
    Backup,
    Block,
    BlockComment,
    BlockReaction,
    CommentRateEvent,
    CommentReport,
    Flag,
    ForestOwnerGroupReconciliationJob,
    ForestOwnerWorld,
    ForestWritingTree,
    Notification,
    Quest,
    QuestItem,
    QuestSubmission,
    Room,
    Session,
    User,
    UsernameReservation
  ]) {
    try {
      await model.createCollection();
    } catch (error) {
      if (error?.codeName !== 'NamespaceExists' && error?.code !== 48) throw error;
    }
  }
  await repairFixtureTtlIndex(UsernameReservation, 'expiresAt');
  await AccountDeletionRequest.createIndexes();
  await ForestOwnerGroupReconciliationJob.createIndexes();
  await ForestOwnerWorld.createIndexes();
  await ForestWritingTree.createIndexes();
  await UsernameReservation.createIndexes();
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}

function scenarioDefinition(scenario) {
  return buildAccountDeletionFixture({
    scenario,
    passwordHash: 'fixture-reset-placeholder'
  });
}

async function resetFixtureScenario(scenario, { session = null } = {}) {
  const fixture = scenarioDefinition(scenario);
  const userIds = fixture.ids.userIds;
  const usernames = Object.values(fixture.users).map((user) => user.username);

  const extraPosts = await Block.find({
    $or: [
      { _id: { $in: fixture.ids.postIds } },
      { userId: { $in: userIds } },
      { creator: { $in: usernames } },
      { tags: { $all: [ACCOUNT_DELETION_FIXTURE_TAG, `account-deletion-${scenario}`] } }
    ]
  }, { _id: 1 }, { session }).lean();
  const postIds = [...new Set([
    ...fixture.ids.postIds,
    ...extraPosts.map((post) => String(post._id))
  ])];

  const comments = await BlockComment.find({
    $or: [
      { _id: { $in: fixture.ids.commentIds } },
      { userId: { $in: userIds } },
      { blockId: { $in: postIds } }
    ]
  }, { _id: 1 }, { session }).lean();
  const commentIds = [...new Set([
    ...fixture.ids.commentIds,
    ...comments.map((comment) => String(comment._id))
  ])];

  const submissions = await QuestSubmission.find({
    $or: [
      { ownerUserId: { $in: userIds } },
      { contributorUserIds: { $in: userIds } },
      { blockId: { $in: postIds } },
      { questId: fixture.ids.questId }
    ]
  }, { _id: 1 }, { session }).lean();
  const submissionIds = submissions.map((submission) => String(submission._id));

  if (submissionIds.length) {
    await QuestItem.updateMany(
      {
        $or: [
          { activeSubmissionId: { $in: submissionIds } },
          { approvedSubmissionId: { $in: submissionIds } }
        ]
      },
      {
        $set: {
          reservedByUserId: null,
          reservedUntil: null,
          activeSubmissionId: null,
          approvedSubmissionId: null
        }
      },
      { session }
    );
  }

  await QuestSubmission.deleteMany({ _id: { $in: submissionIds } }, { session });
  await QuestItem.deleteMany({ questId: fixture.ids.questId }, { session });
  await Quest.deleteMany({
    $or: [
      { _id: fixture.ids.questId },
      { administratorUserId: { $in: userIds } }
    ]
  }, { session });
  await Notification.deleteMany({
    $or: [
      { _id: { $in: fixture.ids.notificationIds } },
      { userId: { $in: userIds } },
      { actorUserId: { $in: userIds } },
      { blockId: { $in: postIds } },
      { commentId: { $in: commentIds } }
    ]
  }, { session });
  await CommentReport.deleteMany({
    $or: [
      { _id: { $in: fixture.ids.commentReportIds } },
      { reporterId: { $in: userIds } },
      { commentId: { $in: commentIds } }
    ]
  }, { session });
  await BlockComment.deleteMany({ _id: { $in: commentIds } }, { session });
  await BlockReaction.deleteMany({
    $or: [
      { _id: { $in: fixture.ids.reactionIds } },
      { userId: { $in: userIds } },
      { blockId: { $in: postIds } }
    ]
  }, { session });
  await CommentRateEvent.deleteMany({
    $or: [
      { _id: { $in: fixture.ids.rateEventIds } },
      { userId: { $in: userIds } }
    ]
  }, { session });
  await Flag.deleteMany({
    $or: [
      { _id: { $in: fixture.ids.flagIds } },
      { blockId: { $in: postIds } },
      { reporter: { $in: usernames } }
    ]
  }, { session });
  await Session.deleteMany({ _id: { $in: postIds } }, { session });
  await Backup.deleteMany({ _id: { $in: postIds } }, { session });
  await Block.deleteMany({ _id: { $in: postIds } }, { session });

  await Block.updateMany(
    { collaborators: { $in: usernames } },
    { $pull: { collaborators: { $in: usernames } } },
    { session }
  );
  await Block.updateMany(
    { originalAuthor: { $in: usernames } },
    { $unset: { originalAuthor: 1 } },
    { session }
  );
  await Block.updateMany(
    { 'votes.userId': { $in: userIds } },
    [
      {
        $set: {
          votes: {
            $filter: {
              input: '$votes',
              as: 'vote',
              cond: { $not: [{ $in: ['$$vote.userId', userIds] }] }
            }
          }
        }
      },
      {
        $set: {
          voteCount: {
            $reduce: {
              input: '$votes',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  { $cond: [{ $eq: ['$$this.type', 'upvote'] }, 1, -1] }
                ]
              }
            }
          }
        }
      }
    ],
    { session, updatePipeline: true }
  );

  await AuthSession.deleteMany({ userId: { $in: userIds } }, { session });
  await ForestWritingTree.deleteMany({ ownerUserId: { $in: userIds } }, { session });
  await ForestOwnerGroupReconciliationJob.deleteMany(
    { ownerUserId: { $in: userIds } },
    { session }
  );
  await ForestOwnerWorld.deleteMany({ ownerUserId: { $in: userIds } }, { session });
  await AccountDeletionRequest.deleteMany({ ownerUserId: { $in: userIds } }, { session });
  await UsernameReservation.deleteMany({ _id: { $in: usernames } }, { session });
  await User.deleteMany({ _id: { $in: userIds } }, { session });
}

async function seedFixtureScenario(scenario, { activeQuest = false } = {}) {
  const password = process.env.ACCOUNT_DELETION_FIXTURE_PASSWORD
    || DEFAULT_ACCOUNT_DELETION_FIXTURE_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);
  const fixture = buildAccountDeletionFixture({
    scenario,
    passwordHash,
    activeQuest
  });

  await withTransaction(async (session) => {
    await resetFixtureScenario(scenario, { session });
    await Room.updateOne(
      { _id: ACCOUNT_DELETION_FIXTURE_ROOM_ID },
      {
        $set: {
          topic: 'Dev fixtures',
          name: 'Account deletion fixture',
          description: 'Disposable room for manual account-deletion integration testing.'
        }
      },
      { upsert: true, session }
    );
    await User.insertMany(Object.values(fixture.users), { session });
    await Block.insertMany(Object.values(fixture.posts), { session });
    await BlockComment.insertMany(Object.values(fixture.comments), { session });
    await BlockReaction.insertMany(fixture.reactions, { session });
    await Notification.insertMany(Object.values(fixture.notifications), { session });
    await Flag.insertMany(fixture.flags, { session });
    await CommentReport.insertMany(fixture.commentReports, { session });
    await CommentRateEvent.insertMany(fixture.rateEvents, { session });
    await AuthSession.insertMany(fixture.authSessions, { session });
    await Session.insertMany(fixture.sessions, { session });
    await Backup.insertMany(fixture.backups, { session });
    await Quest.create([fixture.quest], { session });
    await ForestOwnerWorld.create([fixture.forestOwnerWorld], { session });
    await ForestWritingTree.insertMany(fixture.forestWritingTrees, { session });
  });

  const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/u, '');
  console.log('Seeded account-deletion fixture:', {
    database: mongoose.connection.name,
    scenario,
    activeQuest,
    room: `${baseUrl}/rooms/${ACCOUNT_DELETION_FIXTURE_ROOM_ID}`,
    securityPage: `${baseUrl}/dashboard/security`,
    username: fixture.users.owner.username,
    password,
    retainablePostUrls: [
      fixture.posts.ownerPublicDraft,
      fixture.posts.ownerPublicLocked,
      fixture.posts.ownerUnlistedLocked,
      fixture.posts.ownerLegacyLocked
    ].map((post) => `${baseUrl}/rooms/${post.roomId}/blocks/${post._id}`),
    alwaysDeletedPostUrl: `${baseUrl}/rooms/${fixture.posts.ownerUnlistedDraft.roomId}/blocks/${fixture.posts.ownerUnlistedDraft._id}`,
    peerControlPostUrl: `${baseUrl}/rooms/${fixture.posts.peerPublicLocked.roomId}/blocks/${fixture.posts.peerPublicLocked._id}`
  });
  if (activeQuest) {
    console.log('Deletion should be blocked until this command succeeds:');
    console.log(`npm run account-deletion:fixture -- archive-quest ${scenario} --write`);
  }
}

function makeCheckCollector() {
  const checks = [];
  return {
    expect(label, pass, actual) {
      checks.push({ label, pass: Boolean(pass), actual });
    },
    finish(title) {
      console.log(title);
      for (const check of checks) {
        console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`, check.actual);
      }
      const failures = checks.filter((check) => !check.pass);
      console.log(`Summary: ${checks.length - failures.length}/${checks.length} checks passed.`);
      if (failures.length) process.exitCode = 1;
    }
  };
}

async function verifyBefore(scenario) {
  const fixture = scenarioDefinition(scenario);
  const check = makeCheckCollector();
  const [
    users,
    posts,
    comments,
    notifications,
    activeSessions,
    quest,
    forestOwnerWorld,
    forestWritingTreeCount,
    placementNeighborhood
  ] = await Promise.all([
    User.find({ _id: { $in: fixture.ids.userIds } }).lean(),
    Block.find({ _id: { $in: fixture.ids.postIds } }).lean(),
    BlockComment.find({ _id: { $in: fixture.ids.commentIds } }).lean(),
    Notification.find({ _id: { $in: fixture.ids.notificationIds } }).lean(),
    AuthSession.countDocuments({
      userId: fixture.users.owner._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    }),
    Quest.findById(fixture.ids.questId).lean(),
    ForestOwnerWorld.findOne({ ownerUserId: fixture.users.owner._id }).lean(),
    ForestWritingTree.countDocuments({ ownerUserId: fixture.users.owner._id }),
    readForestOwnerPlacementNeighborhood({
      ownerUserId: fixture.users.owner._id,
      worldSeed: fixture.forestOwnerWorld.worldSeed,
      placementSlot: 0
    })
  ]);

  check.expect('three fixture accounts exist', users.length === 3, users.length);
  check.expect('eight fixture posts exist', posts.length === 8, posts.length);
  check.expect('five interlinked comments exist', comments.length === 5, comments.length);
  check.expect('four notifications exist', notifications.length === 4, notifications.length);
  check.expect('owner has a second active session', activeSessions >= 1, activeSessions);
  check.expect('quest guard record exists', Boolean(quest), quest?.status || null);
  check.expect(
    'active owner forest exists',
    forestOwnerWorld?.status === 'active',
    forestOwnerWorld?.status || null
  );
  check.expect(
    'three owner writing trees exist',
    forestWritingTreeCount === 3,
    forestWritingTreeCount
  );
  check.expect(
    'owner placement neighborhood is queryable',
    [9, 25].includes(placementNeighborhood.queriedCellCount)
      && placementNeighborhood.occupiedPlacements.length <= 3,
    {
      queriedCells: placementNeighborhood.queriedCellCount,
      occupiedPlacements: placementNeighborhood.occupiedPlacements.length
    }
  );
  check.expect(
    'in-progress unlisted post is present before deletion',
    posts.some((post) => String(post._id) === fixture.posts.ownerUnlistedDraft._id),
    posts.length
  );
  check.finish(`Pre-deletion verification (${scenario})`);
}

function requireFixtureCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function createTreeDirect(scenario) {
  const fixture = scenarioDefinition(scenario);
  const ownerUserId = fixture.users.owner._id;
  const firstGroupId = fixture.posts.ownerPublicLocked.groupId;
  const rollbackGroupId = fixture.posts.ownerUnlistedLocked.groupId;
  const concurrentGroupId = fixture.posts.ownerPublicDraft.groupId;
  const transitionTime = new Date('2026-08-04T12:00:00.000Z');

  requireFixtureCondition(
    await User.exists({ _id: ownerUserId }),
    `Seed the ${scenario} fixture before running create-tree-direct.`
  );

  await withTransaction(async (session) => {
    await ForestWritingTree.deleteMany({ ownerUserId }, { session });
    await ForestOwnerWorld.deleteMany({ ownerUserId }, { session });
    await User.updateOne(
      { _id: ownerUserId },
      { $set: { forestLedgerFence: 0 } },
      { session }
    );
  });

  const created = await createForestWritingTree({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  const retried = await createForestWritingTree({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  const [firstWorld, firstTrees, firstOwner] = await Promise.all([
    ForestOwnerWorld.findOne({ ownerUserId, worldRole: 'primary' }).lean(),
    ForestWritingTree.find({ ownerUserId }).lean(),
    User.findById(ownerUserId, { forestLedgerFence: 1 }).lean()
  ]);
  requireFixtureCondition(created.outcome === 'created', 'Initial tree creation did not create.');
  requireFixtureCondition(retried.outcome === 'existing', 'Tree retry was not idempotent.');
  requireFixtureCondition(
    created.tree.writingTreeId === retried.tree.writingTreeId,
    'Tree retry returned a different public identity.'
  );
  requireFixtureCondition(firstTrees.length === 1, 'Initial creation persisted multiple trees.');
  requireFixtureCondition(
    String(firstTrees[0].foundingSource.blockId) === fixture.posts.ownerPublicLocked._id,
    'Initial creation captured the wrong founding source.'
  );
  requireFixtureCondition(
    firstWorld?.nextCandidateSlot > 0 && firstWorld?.placementRevision === 2,
    'Initial creation did not advance the owner-world cursor exactly once.'
  );
  requireFixtureCondition(
    firstOwner?.forestLedgerFence === 2,
    'Create and retry did not both acquire the owner transaction fence.'
  );

  const rollbackSnapshot = {
    nextCandidateSlot: firstWorld.nextCandidateSlot,
    placementRevision: firstWorld.placementRevision,
    treeCount: firstTrees.length,
    forestLedgerFence: firstOwner.forestLedgerFence
  };
  const createWithProjectionFailure = buildForestWritingTreeCreationService({
    projectTree() {
      throw new Error('fixture projection failure');
    }
  });
  let projectionFailed = false;
  try {
    await createWithProjectionFailure({
      ownerUserId,
      translationGroupId: rollbackGroupId,
      now: transitionTime
    });
  } catch (error) {
    projectionFailed = error?.message === 'fixture projection failure';
  }
  requireFixtureCondition(projectionFailed, 'Forced projection failure did not escape.');

  const [worldAfterRollback, treeCountAfterRollback, ownerAfterRollback] = await Promise.all([
    ForestOwnerWorld.findOne({ ownerUserId, worldRole: 'primary' }).lean(),
    ForestWritingTree.countDocuments({ ownerUserId }),
    User.findById(ownerUserId, { forestLedgerFence: 1 }).lean()
  ]);
  requireFixtureCondition(
    worldAfterRollback?.nextCandidateSlot === rollbackSnapshot.nextCandidateSlot
      && worldAfterRollback?.placementRevision === rollbackSnapshot.placementRevision
      && treeCountAfterRollback === rollbackSnapshot.treeCount
      && ownerAfterRollback?.forestLedgerFence === rollbackSnapshot.forestLedgerFence,
    'Projection failure left partial transactional state.'
  );

  const concurrentResults = await Promise.all([
    createForestWritingTree({
      ownerUserId,
      translationGroupId: concurrentGroupId,
      now: transitionTime
    }),
    createForestWritingTree({
      ownerUserId,
      translationGroupId: concurrentGroupId,
      now: transitionTime
    })
  ]);
  const [finalWorld, finalTrees, finalOwner] = await Promise.all([
    ForestOwnerWorld.findOne({ ownerUserId, worldRole: 'primary' }).lean(),
    ForestWritingTree.find({ ownerUserId }).sort({ writingTreeId: 1 }).lean(),
    User.findById(ownerUserId, { forestLedgerFence: 1 }).lean()
  ]);
  const concurrentTrees = finalTrees.filter(
    tree => tree.translationGroupId === concurrentGroupId
  );
  requireFixtureCondition(
    concurrentResults.map(item => item.outcome).sort().join(',') === 'created,existing',
    'Concurrent calls did not converge to one creation and one retry.'
  );
  requireFixtureCondition(
    concurrentTrees.length === 1
      && concurrentResults.every(
        item => item.tree.writingTreeId === concurrentTrees[0].writingTreeId
      ),
    'Concurrent calls did not converge on one durable tree identity.'
  );
  requireFixtureCondition(finalTrees.length === 2, 'Concurrent creation persisted extra trees.');
  requireFixtureCondition(
    finalWorld?.placementRevision === 3
      && finalWorld.nextCandidateSlot > rollbackSnapshot.nextCandidateSlot,
    'Concurrent creation did not advance the owner world exactly once.'
  );
  requireFixtureCondition(
    finalOwner?.forestLedgerFence === 4,
    'Committed create/retry transactions did not leave the expected fence revision.'
  );

  const lifecycleTreeBefore = finalTrees.find(
    tree => tree.translationGroupId === firstGroupId
  );
  const stableLifecycleEvidence = {
    writingTreeId: lifecycleTreeBefore.writingTreeId,
    placement: lifecycleTreeBefore.placement,
    originatingEnvironment: lifecycleTreeBefore.originatingEnvironment,
    projection: lifecycleTreeBefore.projection
  };
  await Block.updateOne(
    { _id: fixture.posts.ownerPublicLocked._id },
    { $set: { authorshipState: 'deleted-author' } }
  );
  const deactivated = await reconcileForestOwnerGroup({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  const inactiveRetry = await reconcileForestOwnerGroup({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  requireFixtureCondition(
    deactivated.outcome === 'deactivated'
      && inactiveRetry.outcome === 'inactive'
      && inactiveRetry.tree.recordRevision === deactivated.tree.recordRevision,
    'Ineligible lifecycle reconciliation did not converge idempotently.'
  );

  await Block.updateOne(
    { _id: fixture.posts.ownerPublicLocked._id },
    { $set: { authorshipState: 'live' } }
  );
  const reactivated = await reconcileForestOwnerGroup({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  requireFixtureCondition(
    reactivated.outcome === 'reactivated'
      && reactivated.tree.writingTreeId === stableLifecycleEvidence.writingTreeId
      && JSON.stringify(reactivated.tree.placement)
        === JSON.stringify(stableLifecycleEvidence.placement)
      && JSON.stringify(reactivated.tree.originatingEnvironment)
        === JSON.stringify(stableLifecycleEvidence.originatingEnvironment)
      && JSON.stringify(reactivated.tree.projection)
        === JSON.stringify(stableLifecycleEvidence.projection),
    'Reactivation did not preserve the established tree snapshot.'
  );

  await Block.updateOne(
    { _id: fixture.posts.ownerPublicLocked._id },
    { $set: { lang: 'malformed language' } }
  );
  const unresolved = await reconcileForestOwnerGroup({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  requireFixtureCondition(
    unresolved.outcome === 'unresolved'
      && unresolved.tree.sourceState === 'active'
      && unresolved.tree.recordRevision === reactivated.tree.recordRevision,
    'Malformed evidence did not preserve the last known-good tree state.'
  );
  await Block.updateOne(
    { _id: fixture.posts.ownerPublicLocked._id },
    { $set: { lang: fixture.posts.ownerPublicLocked.lang } }
  );

  const absent = await reconcileForestOwnerGroup({
    ownerUserId,
    translationGroupId: fixture.posts.ownerLegacyLocked.groupId,
    now: transitionTime
  });
  const [lifecycleTreeAfter, lifecycleOwner, lifecycleTreeCount] = await Promise.all([
    ForestWritingTree.findOne({
      ownerUserId,
      translationGroupId: firstGroupId
    }).lean(),
    User.findById(ownerUserId, { forestLedgerFence: 1 }).lean(),
    ForestWritingTree.countDocuments({ ownerUserId })
  ]);
  requireFixtureCondition(
    absent.outcome === 'absent' && lifecycleTreeCount === 2,
    'Zero-tree, zero-founder reconciliation created unexpected state.'
  );
  requireFixtureCondition(
    lifecycleTreeAfter.sourceState === 'active'
      && lifecycleTreeAfter.writingTreeId === stableLifecycleEvidence.writingTreeId
      && lifecycleTreeAfter.recordRevision === lifecycleTreeBefore.recordRevision + 2,
    'Lifecycle reconciliation did not preserve one stable durable tree.'
  );
  requireFixtureCondition(
    lifecycleOwner?.forestLedgerFence === 9,
    'Lifecycle reconciliation did not leave the expected committed fence revision.'
  );

  const firstQueued = await enqueueForestOwnerGroupReconciliation({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  const secondQueued = await enqueueForestOwnerGroupReconciliation({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  const deduplicatedJobs = await ForestOwnerGroupReconciliationJob.find({
    ownerUserId,
    translationGroupId: firstGroupId
  }).lean();
  requireFixtureCondition(
    firstQueued.requestedRevision === 1
      && secondQueued.requestedRevision === 2
      && deduplicatedJobs.length === 1
      && deduplicatedJobs[0].requestedRevision === 2,
    'Repeated enqueueing did not deduplicate by owner/group revision.'
  );

  await Block.updateOne(
    { _id: fixture.posts.ownerPublicLocked._id },
    { $set: { authorshipState: 'deleted-author' } }
  );
  const asynchronousDeactivation = await processForestOwnerGroupReconciliationJobs({
    limit: 1,
    now: transitionTime
  });
  await Block.updateOne(
    { _id: fixture.posts.ownerPublicLocked._id },
    { $set: { authorshipState: 'live' } }
  );
  await enqueueForestOwnerGroupReconciliation({
    ownerUserId,
    translationGroupId: firstGroupId,
    now: transitionTime
  });
  const asynchronousReactivation = await processForestOwnerGroupReconciliationJobs({
    limit: 1,
    now: transitionTime
  });

  await enqueueForestOwnerGroupReconciliation({
    ownerUserId,
    translationGroupId: concurrentGroupId,
    now: transitionTime
  });
  const processWithFailure = buildForestOwnerGroupReconciliationWorker({
    async reconcile() {
      const error = new Error('fixture transient reconciliation failure');
      error.name = 'FixtureTransientError';
      throw error;
    }
  });
  const failedPass = await processWithFailure({
    limit: 1,
    maxAttempts: 2,
    now: transitionTime
  });
  const failedJob = await ForestOwnerGroupReconciliationJob.findOne({
    ownerUserId,
    translationGroupId: concurrentGroupId
  }).lean();
  requireFixtureCondition(
    failedPass.retried === 1
      && failedJob?.status === 'pending'
      && failedJob?.attempts === 1
      && failedJob?.lastErrorCode === 'FIXTURE_TRANSIENT_ERROR'
      && failedJob?.leaseToken === null,
    'Transient worker failure did not remain durably retryable.'
  );
  const retryTime = new Date(transitionTime.getTime() + 30_000);
  await enqueueForestOwnerGroupReconciliation({
    ownerUserId,
    translationGroupId: concurrentGroupId,
    now: retryTime
  });
  const recoveredPass = await processForestOwnerGroupReconciliationJobs({
    limit: 1,
    now: retryTime
  });
  const [asyncTree, asyncOwner, remainingJobs] = await Promise.all([
    ForestWritingTree.findOne({
      ownerUserId,
      translationGroupId: firstGroupId
    }).lean(),
    User.findById(ownerUserId, { forestLedgerFence: 1 }).lean(),
    ForestOwnerGroupReconciliationJob.countDocuments({ ownerUserId })
  ]);
  requireFixtureCondition(
    asynchronousDeactivation.completed === 1
      && asynchronousReactivation.completed === 1
      && recoveredPass.completed === 1
      && remainingJobs === 0,
    'Asynchronous reconciliation jobs did not complete and drain.'
  );
  requireFixtureCondition(
    asyncTree.sourceState === 'active'
      && asyncTree.writingTreeId === stableLifecycleEvidence.writingTreeId
      && asyncOwner?.forestLedgerFence === 17,
    'Asynchronous lifecycle reconciliation changed durable identity or fence ordering.'
  );

  await Block.deleteOne({ _id: fixture.posts.ownerPublicLocked._id });
  const sweepOutcomes = [];
  const sweepDiagnostics = [];
  for (let step = 0; step < 20; step += 1) {
    const sweep = await runForestOwnerConvergenceSweepStep({
      ownerUserId,
      blockPageSize: 2,
      treePageSize: 1,
      now: new Date(retryTime.getTime() + ((step + 1) * 60_000))
    });
    sweepOutcomes.push(sweep.outcome);
    sweepDiagnostics.push(sweep.diagnostics);
    if (sweep.outcome === 'completed') break;
  }
  const [sweptWorld, sweptTrees, sweptOwner] = await Promise.all([
    ForestOwnerWorld.findOne({ ownerUserId, worldRole: 'primary' }).lean(),
    ForestWritingTree.find({ ownerUserId }).lean(),
    User.findById(ownerUserId, { forestLedgerFence: 1 }).lean()
  ]);
  const sweptActiveTrees = sweptTrees.filter(tree => tree.sourceState === 'active');
  const sweptInactiveTree = sweptTrees.find(
    tree => tree.translationGroupId === firstGroupId
  );
  requireFixtureCondition(
    sweepOutcomes.at(-1) === 'completed'
      && sweepOutcomes.length <= 20
      && sweptWorld?.reconciliation?.state === 'idle'
      && sweptWorld?.reconciliation?.epoch === 1
      && sweptWorld?.reconciliation?.completedAt,
    'Convergence sweep did not finish its resumable epoch.'
  );
  requireFixtureCondition(
    sweptTrees.length === 4
      && sweptActiveTrees.length === 3
      && sweptActiveTrees.every(tree => tree.lastEligibleReconciliationEpoch === 1)
      && sweptInactiveTree?.sourceState === 'inactive'
      && sweptInactiveTree?.writingTreeId === stableLifecycleEvidence.writingTreeId,
    'Convergence sweep did not enroll historical groups and deactivate unseen evidence.'
  );
  requireFixtureCondition(
    sweptWorld.placementRevision === 5
      && sweptOwner?.forestLedgerFence === 21,
    'Convergence sweep did not preserve allocation and fence ordering.'
  );

  console.log('Transactional writing-tree creation integration passes:', {
    initialOutcomes: [created.outcome, retried.outcome],
    rollbackPreservedState: true,
    concurrentOutcomes: concurrentResults.map(item => item.outcome).sort(),
    finalTreeCount: finalTrees.length,
    finalPlacementRevision: finalWorld.placementRevision,
    creationFenceRevision: finalOwner.forestLedgerFence,
    lifecycleOutcomes: [
      deactivated.outcome,
      inactiveRetry.outcome,
      reactivated.outcome,
      unresolved.outcome,
      absent.outcome
    ],
    queueRequestedRevisions: [
      firstQueued.requestedRevision,
      secondQueued.requestedRevision
    ],
    asynchronousPasses: {
      deactivation: asynchronousDeactivation,
      reactivation: asynchronousReactivation,
      failed: failedPass,
      recovered: recoveredPass
    },
    convergenceSweep: {
      outcomes: sweepOutcomes,
      diagnostics: sweepDiagnostics,
      epoch: sweptWorld.reconciliation.epoch,
      totalTrees: sweptTrees.length,
      activeTrees: sweptActiveTrees.length
    },
    finalFenceRevision: sweptOwner.forestLedgerFence
  });
}

async function seedForestPagination(scenario) {
  const fixture = scenarioDefinition(scenario);
  const ownerUserId = fixture.users.owner._id;
  const [owner, world, pressureRecords] = await Promise.all([
    User.findById(ownerUserId).lean(),
    ForestOwnerWorld.findOne({ ownerUserId, worldRole: 'primary' }).lean(),
    Block.countDocuments({
      userId: ownerUserId,
      tags: FOREST_OWNER_PRESSURE_TAG
    })
  ]);
  requireFixtureCondition(
    owner && world?.status === 'active' && world?.reconciliation?.state === 'idle',
    `Seed and verify the ${scenario} fixture before adding forest pagination records.`
  );
  requireFixtureCondition(
    pressureRecords === 0,
    `Reseed the ${scenario} scenario before switching from 600-tree to 55-tree pressure.`
  );

  const posts = buildForestReadPaginationPosts({ scenario, owner });
  await Block.bulkWrite(posts.map(({ _id, ...post }) => ({
    updateOne: {
      filter: { _id },
      update: { $set: post },
      upsert: true
    }
  })), { ordered: true });

  const reconciliationOutcomes = {};
  for (const post of posts) {
    const result = await reconcileForestOwnerGroup({
      ownerUserId,
      translationGroupId: post.groupId,
      now: new Date()
    });
    reconciliationOutcomes[result.outcome] = (reconciliationOutcomes[result.outcome] || 0) + 1;
  }

  const firstPage = await listForestOwnerWritingTrees({
    ownerUserId,
    preferredContentLang: 'en'
  });
  const secondPage = firstPage.page.nextCursor
    ? await listForestOwnerWritingTrees({
      ownerUserId,
      preferredContentLang: 'en',
      cursor: firstPage.page.nextCursor
    })
    : null;
  const thirdPage = secondPage?.page.nextCursor
    ? await listForestOwnerWritingTrees({
      ownerUserId,
      preferredContentLang: 'en',
      cursor: secondPage.page.nextCursor
    })
    : null;
  const returnedToSecondPage = thirdPage?.page.previousCursor
    ? await listForestOwnerWritingTrees({
      ownerUserId,
      preferredContentLang: 'en',
      cursor: thirdPage.page.previousCursor
    })
    : null;
  const paginationGroupIds = posts.map(post => post.groupId);
  const [postCount, treeCount] = await Promise.all([
    Block.countDocuments({ _id: { $in: posts.map(post => post._id) } }),
    ForestWritingTree.countDocuments({
      ownerUserId,
      translationGroupId: { $in: paginationGroupIds },
      sourceState: 'active',
      hiddenFromForest: false
    })
  ]);
  requireFixtureCondition(
    postCount === posts.length && treeCount === posts.length,
    'Pagination fixture did not converge to one active tree per disposable post.'
  );
  requireFixtureCondition(
    firstPage.status === 'ready'
      && firstPage.trees.length === 25
      && firstPage.page.nextCursor
      && secondPage?.status === 'ready'
      && secondPage.trees.length === 25
      && secondPage.page.previousCursor
      && secondPage.page.nextCursor
      && thirdPage?.status === 'ready'
      && thirdPage.trees.length >= 5
      && thirdPage.page.previousCursor
      && thirdPage.page.nextCursor === null
      && returnedToSecondPage?.trees.map(tree => tree.writingTreeId).join(',')
        === secondPage.trees.map(tree => tree.writingTreeId).join(','),
    'The private forest read did not round-trip across three cursor-linked pages.'
  );

  const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/u, '');
  console.log('Seeded and verified private forest pagination fixture:', {
    database: mongoose.connection.name,
    scenario,
    addedPostCount: postCount,
    activePaginationTreeCount: treeCount,
    reconciliationOutcomes,
    firstPageTreeCount: firstPage.trees.length,
    secondPageTreeCount: secondPage.trees.length,
    thirdPageTreeCount: thirdPage.trees.length,
    backwardRoundTripMatches: true,
    route: `${baseUrl}/en/forest/writing`,
    username: fixture.users.owner.username,
    password: process.env.ACCOUNT_DELETION_FIXTURE_PASSWORD
      || DEFAULT_ACCOUNT_DELETION_FIXTURE_PASSWORD
  });
}

function elapsedMilliseconds(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

async function measured(work) {
  const startedAt = process.hrtime.bigint();
  const result = await work();
  return { result, elapsedMs: elapsedMilliseconds(startedAt) };
}

function serializedBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function fixtureDistribution(values) {
  return Object.fromEntries([...values.reduce((counts, value) => (
    counts.set(value, (counts.get(value) || 0) + 1)
  ), new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));
}

async function measureWritingPages(ownerUserId) {
  const durations = [];
  const seenTreeIds = new Set();
  const seenCursors = new Set();
  let cursor = null;
  let pageCount = 0;
  let totalBytes = 0;
  let maximumPageRows = 0;
  let omittedUnavailableCount = 0;
  do {
    const page = await measured(() => listForestOwnerWritingTrees({
      ownerUserId,
      preferredContentLang: 'en',
      cursor
    }));
    requireFixtureCondition(page.result.status === 'ready', 'Writing pressure read was not ready.');
    durations.push(page.elapsedMs);
    totalBytes += serializedBytes(page.result);
    maximumPageRows = Math.max(maximumPageRows, page.result.trees.length);
    omittedUnavailableCount += page.result.page.omittedUnavailableCount;
    for (const tree of page.result.trees) {
      requireFixtureCondition(
        !seenTreeIds.has(tree.writingTreeId),
        'Writing pressure pagination returned a duplicate tree.'
      );
      seenTreeIds.add(tree.writingTreeId);
    }
    pageCount += 1;
    const nextCursor = page.result.page.nextCursor;
    if (nextCursor) {
      requireFixtureCondition(
        !seenCursors.has(nextCursor),
        'Writing pressure pagination repeated a cursor.'
      );
      seenCursors.add(nextCursor);
    }
    cursor = nextCursor;
    requireFixtureCondition(pageCount <= 100, 'Writing pressure pagination exceeded 100 pages.');
  } while (cursor);
  return {
    pageCount,
    returnedTreeCount: seenTreeIds.size,
    maximumPageRows,
    omittedUnavailableCount,
    serializedBytes: totalBytes,
    timings: summarizeForestPressureTimings(durations)
  };
}

async function measureNeighborhood(ownerUserId, neighborhood) {
  const durations = [];
  const pages = [];
  let cursor = null;
  let pageCount = 0;
  let placementCount = 0;
  let totalBytes = 0;
  do {
    const requestCursor = cursor;
    const page = await measured(() => readForestOwnerRegionManifest({
      ownerUserId,
      cells: neighborhood.cells,
      cursor: requestCursor,
      limit: FOREST_OWNER_REGION_MAX_PAGE_SIZE
    }));
    requireFixtureCondition(page.result.status === 'ready', 'Pressure region was not ready.');
    durations.push(page.elapsedMs);
    pages.push({ cursor: requestCursor, manifest: page.result });
    pageCount += 1;
    placementCount += page.result.placements.length;
    totalBytes += serializedBytes(page.result);
    cursor = page.result.page.nextCursor;
    requireFixtureCondition(pageCount <= 10, 'Pressure region exceeded 10 pages.');
  } while (cursor);
  return {
    label: neighborhood.label,
    cells: neighborhood.cells,
    pageCount,
    placementCount,
    serializedBytes: totalBytes,
    timings: summarizeForestPressureTimings(durations),
    pages
  };
}

async function measureAssetDelivery(ownerUserId, neighborhood) {
  const firstPage = neighborhood.pages[0];
  const assetKeys = [...new Set(firstPage.manifest.placements.map(
    placement => placement.assetKey
  ))].slice(0, 24);
  requireFixtureCondition(assetKeys.length > 0, 'Pressure region had no assets to measure.');
  const input = {
    ownerUserId,
    cells: neighborhood.cells,
    cursor: firstPage.cursor,
    assetKeys,
    transport: FOREST_ASSET_TRANSPORT_RASTER
  };
  const cold = await measured(() => deliverForestOwnerRegionAssets(input));
  const warm = await measured(() => deliverForestOwnerRegionAssets(input));
  for (const delivery of [cold.result, warm.result]) {
    requireFixtureCondition(
      delivery.status === 'ready' && delivery.assets.length === assetKeys.length,
      'Pressure asset delivery did not return every authorized asset.'
    );
  }
  return {
    neighborhood: neighborhood.label,
    requestedAssetCount: assetKeys.length,
    transport: FOREST_ASSET_TRANSPORT_RASTER,
    cold: {
      elapsedMs: summarizeForestPressureTimings([cold.elapsedMs]).totalMs,
      serializedBytes: serializedBytes(cold.result)
    },
    warm: {
      elapsedMs: summarizeForestPressureTimings([warm.elapsedMs]).totalMs,
      serializedBytes: serializedBytes(warm.result)
    }
  };
}

async function seedForestPressure(scenario) {
  const fixture = scenarioDefinition(scenario);
  const ownerUserId = fixture.users.owner._id;
  const [owner, world, paginationRecords] = await Promise.all([
    User.findById(ownerUserId).lean(),
    ForestOwnerWorld.findOne({ ownerUserId, worldRole: 'primary' }).lean(),
    Block.countDocuments({
      userId: ownerUserId,
      tags: 'forest-read-pagination'
    })
  ]);
  requireFixtureCondition(
    owner && world?.status === 'active' && world?.reconciliation?.state === 'idle',
    `Seed and verify the ${scenario} fixture before adding forest pressure records.`
  );
  requireFixtureCondition(
    paginationRecords === 0,
    `Reseed the ${scenario} scenario before switching from 55-tree to 600-tree pressure.`
  );

  const posts = buildForestOwnerPressurePosts({ scenario, owner });
  const insert = await measured(() => Block.bulkWrite(posts.map(({ _id, ...post }) => ({
    updateOne: {
      filter: { _id },
      update: { $set: post },
      upsert: true
    }
  })), { ordered: true }));

  const reconciliationDurations = [];
  const reconciliationOutcomes = {};
  for (let index = 0; index < posts.length; index += 1) {
    const reconciliation = await measured(() => reconcileForestOwnerGroup({
      ownerUserId,
      translationGroupId: posts[index].groupId,
      now: new Date()
    }));
    reconciliationDurations.push(reconciliation.elapsedMs);
    reconciliationOutcomes[reconciliation.result.outcome] =
      (reconciliationOutcomes[reconciliation.result.outcome] || 0) + 1;
    if ((index + 1) % 100 === 0) {
      console.log(`Forest pressure reconciliation: ${index + 1}/${posts.length}`);
    }
  }

  const groupIds = posts.map(post => post.groupId);
  const [pressurePostCount, pressureTrees, visibleTreeCount] = await Promise.all([
    Block.countDocuments({
      userId: ownerUserId,
      tags: FOREST_OWNER_PRESSURE_TAG
    }),
    ForestWritingTree.find({
      ownerUserId,
      translationGroupId: { $in: groupIds }
    }, {
      _id: 0,
      sourceState: 1,
      hiddenFromForest: 1,
      placementIndex: 1
    }).lean(),
    ForestWritingTree.countDocuments({
      ownerUserId,
      sourceState: 'active',
      hiddenFromForest: false
    })
  ]);
  requireFixtureCondition(
    pressurePostCount === FOREST_OWNER_PRESSURE_TREE_COUNT
      && pressureTrees.length === FOREST_OWNER_PRESSURE_TREE_COUNT
      && pressureTrees.every(tree => (
        tree.sourceState === 'active' && tree.hiddenFromForest === false
      )),
    'Pressure fixture did not converge to 600 active visible trees.'
  );

  const cellSummary = summarizeForestPressureCells(pressureTrees);
  const neighborhoods = [];
  for (const definition of forestPressureNeighborhoods(cellSummary)) {
    neighborhoods.push(await measureNeighborhood(ownerUserId, definition));
  }
  const writing = await measureWritingPages(ownerUserId);
  requireFixtureCondition(
    writing.returnedTreeCount === visibleTreeCount,
    'Writing pressure pagination did not return every active visible tree.'
  );
  const assetNeighborhood = neighborhoods.slice().sort((left, right) => (
    right.placementCount - left.placementCount
  ))[0];
  const assets = await measureAssetDelivery(ownerUserId, assetNeighborhood);

  const report = {
    database: mongoose.connection.name,
    scenario,
    generatedPressurePosts: pressurePostCount,
    activeVisibleTreesIncludingBaseline: visibleTreeCount,
    sourceDistribution: {
      status: fixtureDistribution(posts.map(post => post.status)),
      visibility: fixtureDistribution(posts.map(post => post.visibility)),
      language: fixtureDistribution(posts.map(post => post.lang))
    },
    setup: {
      blockUpsertMs: summarizeForestPressureTimings([insert.elapsedMs]).totalMs,
      reconciliationOutcomes,
      reconciliationTimings: summarizeForestPressureTimings(reconciliationDurations)
    },
    spatialDistribution: {
      treeCount: cellSummary.treeCount,
      occupiedCellCount: cellSummary.occupiedCellCount,
      cellSpanX: cellSummary.cellSpanX,
      cellSpanY: cellSummary.cellSpanY,
      occupancy: cellSummary.occupancy
    },
    writing,
    regionalNeighborhoods: neighborhoods.map(neighborhood => ({
      label: neighborhood.label,
      pageCount: neighborhood.pageCount,
      placementCount: neighborhood.placementCount,
      serializedBytes: neighborhood.serializedBytes,
      timings: neighborhood.timings
    })),
    assets
  };
  console.log('Activity Forest 600-tree pressure fixture passes:');
  console.log(JSON.stringify(report, null, 2));
}

async function verifyAfter(scenario) {
  const fixture = scenarioDefinition(scenario);
  const check = makeCheckCollector();
  const retainedKeys = expectedRetainedPostKeys(scenario);
  const retainedIds = new Set(retainedKeys.map((key) => fixture.posts[key]._id));
  const ownerPostIds = [
    fixture.posts.ownerPublicDraft._id,
    fixture.posts.ownerPublicLocked._id,
    fixture.posts.ownerUnlistedLocked._id,
    fixture.posts.ownerUnlistedDraft._id,
    fixture.posts.ownerLegacyLocked._id
  ];

  const [
    owner,
    request,
    reservation,
    ownerPosts,
    peerPost,
    translation,
    comments,
    notifications,
    reactions,
    flags,
    reports,
    rateEvents,
    authSessions,
    collaborationSessions,
    collaborationBackups,
    staleUsernameReferences,
    quest,
    forestOwnerWorld,
    forestWritingTreeCount
  ] = await Promise.all([
    User.findById(fixture.users.owner._id).lean(),
    AccountDeletionRequest.findOne({ ownerUserId: fixture.users.owner._id }).lean(),
    UsernameReservation.findById(fixture.users.owner.username).lean(),
    Block.find({ _id: { $in: ownerPostIds } }).lean(),
    Block.findById(fixture.posts.peerPublicLocked._id).lean(),
    Block.findById(fixture.posts.peerTranslation._id).lean(),
    BlockComment.find({ _id: { $in: fixture.ids.commentIds } }).lean(),
    Notification.find({ _id: { $in: fixture.ids.notificationIds } }).lean(),
    BlockReaction.find({ _id: { $in: fixture.ids.reactionIds } }).lean(),
    Flag.find({ _id: { $in: fixture.ids.flagIds } }).lean(),
    CommentReport.find({ _id: { $in: fixture.ids.commentReportIds } }).lean(),
    CommentRateEvent.find({ userId: fixture.users.owner._id }).lean(),
    AuthSession.find({ userId: fixture.users.owner._id }).lean(),
    Session.find({ _id: { $in: ownerPostIds } }).lean(),
    Backup.find({ _id: { $in: ownerPostIds } }).lean(),
    Block.countDocuments({
      $or: [
        { creator: fixture.users.owner.username },
        { collaborators: fixture.users.owner.username },
        { originalAuthor: fixture.users.owner.username }
      ]
    }),
    Quest.findById(fixture.ids.questId).lean(),
    ForestOwnerWorld.findOne({ ownerUserId: fixture.users.owner._id }).lean(),
    ForestWritingTree.countDocuments({ ownerUserId: fixture.users.owner._id })
  ]);

  const commentsById = new Map(comments.map((comment) => [String(comment._id), comment]));
  const notificationsById = new Map(
    notifications.map((notification) => [String(notification._id), notification])
  );
  const reactionsById = new Map(reactions.map((reaction) => [String(reaction._id), reaction]));
  const flagsById = new Map(flags.map((flag) => [String(flag._id), flag]));

  check.expect('owner account is deleted', owner === null, owner);
  check.expect(
    'completed request records the selected disposition',
    request?.status === 'completed' && request?.disposition === scenario,
    request ? { status: request.status, disposition: request.disposition } : null
  );
  check.expect(
    'forest cleanup converged before evidence expiry',
    request?.forestCleanup?.status === 'completed'
      && request?.forestCleanup?.completedAt
      && request?.evidenceExpiresAt,
    request ? {
      forestCleanup: request.forestCleanup,
      evidenceExpiresAt: request.evidenceExpiresAt
    } : null
  );
  check.expect('owner forest is deleted', forestOwnerWorld === null, forestOwnerWorld);
  check.expect(
    'owner writing trees are deleted',
    forestWritingTreeCount === 0,
    forestWritingTreeCount
  );
  check.expect(
    'username is quarantined',
    reservation?.expiresAt > new Date(),
    reservation?.expiresAt || null
  );
  check.expect('expected owner post count remains', ownerPosts.length === retainedIds.size, ownerPosts.length);
  check.expect(
    'only retainable owner posts remain',
    ownerPosts.every((post) => retainedIds.has(String(post._id))),
    ownerPosts.map((post) => post.title)
  );
  check.expect(
    'retained posts are ownerless and non-editable',
    ownerPosts.every((post) => (
      !post.userId
      && !post.editToken
      && post.authorshipState === scenario
      && post.creator === (scenario === 'anonymous' ? 'anonymous' : 'Deleted author')
    )),
    ownerPosts.map((post) => ({
      creator: post.creator,
      authorshipState: post.authorshipState,
      hasUserId: Boolean(post.userId),
      hasEditToken: Boolean(post.editToken)
    }))
  );
  check.expect(
    'in-progress unlisted post is always deleted',
    !ownerPosts.some((post) => String(post._id) === fixture.posts.ownerUnlistedDraft._id),
    ownerPosts.length
  );
  check.expect(
    'peer post survives without owner collaborator or vote',
    Boolean(peerPost)
      && !peerPost.collaborators.includes(fixture.users.owner.username)
      && !peerPost.votes.some((vote) => vote.userId === fixture.users.owner._id)
      && peerPost.voteCount === -1,
    peerPost ? {
      collaborators: peerPost.collaborators,
      voteCount: peerPost.voteCount,
      voteUserIds: peerPost.votes.map((vote) => vote.userId)
    } : null
  );
  check.expect(
    'translation attribution is scrubbed safely',
    Boolean(translation)
      && !translation.originalAuthor
      && (scenario === 'delete' ? !translation.originalBlock : Boolean(translation.originalBlock)),
    translation ? {
      originalAuthor: translation.originalAuthor,
      originalBlock: translation.originalBlock
    } : null
  );
  check.expect(
    'owner comments and dependent reply are deleted',
    !commentsById.has(fixture.comments.ownerOnPeer._id)
      && !commentsById.has(fixture.comments.peerReplyToOwner._id)
      && !commentsById.has(fixture.comments.ownerReplyToPeer._id),
    comments.length
  );
  check.expect(
    'observer control comment survives',
    commentsById.has(fixture.comments.observerOnPeer._id),
    comments.length
  );
  check.expect(
    'peer comment on owner post follows post disposition',
    commentsById.has(fixture.comments.peerOnOwner._id) === (scenario !== 'delete'),
    comments.length
  );
  check.expect(
    'owner-addressed and deleted-comment notifications are gone',
    !notificationsById.has(fixture.notifications.addressedToOwner._id)
      && !notificationsById.has(fixture.notifications.ownerCommentToPeer._id),
    notifications.length
  );
  check.expect(
    'surviving notification has a scrubbed actor',
    notificationsById.get(fixture.notifications.survivingDeletedActor._id)?.actorUserId == null,
    notificationsById.get(fixture.notifications.survivingDeletedActor._id)?.actorUserId
  );
  check.expect(
    'owner-post notification follows post disposition',
    notificationsById.has(fixture.notifications.ownerPostControl._id) === (scenario !== 'delete'),
    notifications.length
  );
  check.expect(
    'owner reaction is removed while observer reaction survives',
    !reactionsById.has(fixture.reactions[0]._id)
      && reactionsById.has(fixture.reactions[1]._id),
    reactions.length
  );
  check.expect(
    'reaction on owner post follows post disposition',
    reactionsById.has(fixture.reactions[2]._id) === (scenario !== 'delete'),
    reactions.length
  );
  check.expect(
    'surviving moderation flag loses owner reporter identity',
    flagsById.get(fixture.flags[0]._id)?.reporter == null,
    flagsById.get(fixture.flags[0]._id)?.reporter
  );
  check.expect(
    'flag on owner post follows post disposition',
    flagsById.has(fixture.flags[1]._id) === (scenario !== 'delete'),
    flags.length
  );
  check.expect('fixture comment reports are removed', reports.length === 0, reports.length);
  check.expect('owner rate-limit events are removed', rateEvents.length === 0, rateEvents.length);
  check.expect(
    'every owner auth session is revoked',
    authSessions.length >= 1 && authSessions.every((session) => session.revokedAt),
    {
      total: authSessions.length,
      active: authSessions.filter((session) => !session.revokedAt).length
    }
  );
  check.expect(
    'owned collaboration sessions are removed',
    collaborationSessions.length === 0,
    collaborationSessions.length
  );
  check.expect(
    'owned collaboration backups are removed',
    collaborationBackups.length === 0,
    collaborationBackups.length
  );
  check.expect(
    'no authorization-bearing username references remain',
    staleUsernameReferences === 0,
    staleUsernameReferences
  );
  check.expect(
    'archived quest history loses deleted administrator identity',
    quest?.administratorUserId == null,
    quest?.administratorUserId
  );
  check.finish(`Post-deletion verification (${scenario})`);
}

async function archiveQuest(scenario) {
  const fixture = scenarioDefinition(scenario);
  const result = await Quest.updateOne(
    { _id: fixture.ids.questId },
    { $set: { status: 'archived', updatedAt: new Date() } }
  );
  if (result.matchedCount !== 1) {
    throw new Error(`Fixture quest not found for scenario "${scenario}".`);
  }
  console.log(`Archived active-quest guard for ${scenario}. Deletion may now be retried.`);
}

async function deleteDirect(scenario) {
  const fixture = scenarioDefinition(scenario);
  await withTransaction(async (session) => {
    await acquireForestLedgerFence({
      ownerUserId: fixture.users.owner._id,
      session
    });
  });
  const fencedOwner = await User.findById(fixture.users.owner._id).lean();
  if (fencedOwner?.forestLedgerFence !== 1) {
    throw new Error('Forest ledger transaction fence did not persist before deletion.');
  }

  const result = await deleteAccount({
    userId: fixture.users.owner._id,
    disposition: scenario
  });

  const [deletingWorld, pendingRequest, treesBeforeCleanup] = await Promise.all([
    ForestOwnerWorld.findOne({ ownerUserId: fixture.users.owner._id }).lean(),
    AccountDeletionRequest.findOne({ ownerUserId: fixture.users.owner._id }).lean(),
    ForestWritingTree.countDocuments({ ownerUserId: fixture.users.owner._id })
  ]);
  if (deletingWorld?.status !== 'deleting'
    || pendingRequest?.forestCleanup?.status !== 'pending'
    || pendingRequest?.evidenceExpiresAt
    || treesBeforeCleanup !== 3) {
    throw new Error('Deletion transaction did not establish the pending forest-cleanup boundary.');
  }

  let postDeletionFenceFailedClosed = false;
  try {
    await withTransaction(session => acquireForestLedgerFence({
      ownerUserId: fixture.users.owner._id,
      session
    }));
  } catch (error) {
    postDeletionFenceFailedClosed = error instanceof ForestLedgerFenceError
      && error.code === 'FOREST_OWNER_UNAVAILABLE';
  }
  if (!postDeletionFenceFailedClosed) {
    throw new Error('Forest ledger fence did not fail closed after account deletion.');
  }

  const firstCleanup = await cleanUpAccountDeletionForests({
    limit: 1,
    ownerUserId: fixture.users.owner._id,
    treeBatchSize: 2,
    maxTreeBatchesPerRequest: 1
  });
  const [requestAfterFirstCleanup, treesAfterFirstCleanup, worldAfterFirstCleanup] = await Promise.all([
    AccountDeletionRequest.findOne({ ownerUserId: fixture.users.owner._id }).lean(),
    ForestWritingTree.countDocuments({ ownerUserId: fixture.users.owner._id }),
    ForestOwnerWorld.exists({ ownerUserId: fixture.users.owner._id })
  ]);
  if (firstCleanup.deletedTrees !== 2
    || firstCleanup.pending !== 1
    || treesAfterFirstCleanup !== 1
    || !worldAfterFirstCleanup
    || requestAfterFirstCleanup?.forestCleanup?.status !== 'pending'
    || requestAfterFirstCleanup?.evidenceExpiresAt) {
    throw new Error('Bounded forest cleanup did not remain pending after its first batch.');
  }

  const secondCleanup = await cleanUpAccountDeletionForests({
    limit: 1,
    ownerUserId: fixture.users.owner._id,
    treeBatchSize: 2,
    maxTreeBatchesPerRequest: 1
  });
  if (secondCleanup.deletedTrees !== 1 || secondCleanup.pending !== 1) {
    throw new Error('Forest cleanup did not resume its bounded tree drain.');
  }

  const finalCleanup = await cleanUpAccountDeletionForests({
    limit: 1,
    ownerUserId: fixture.users.owner._id,
    treeBatchSize: 2,
    maxTreeBatchesPerRequest: 1
  });
  const idempotentCleanup = await cleanUpAccountDeletionForests({
    limit: 1,
    ownerUserId: fixture.users.owner._id,
    treeBatchSize: 2,
    maxTreeBatchesPerRequest: 1
  });
  if (finalCleanup.completed !== 1
    || finalCleanup.deletedWorlds !== 1
    || idempotentCleanup.requests !== 0) {
    throw new Error('Forest cleanup did not converge idempotently.');
  }

  console.log('Direct account-deletion service result:', result);
  console.log('Forest cleanup integration passes:', {
    fenceBeforeDeletion: fencedOwner.forestLedgerFence,
    postDeletionFenceFailedClosed,
    firstCleanup,
    secondCleanup,
    finalCleanup,
    idempotentCleanup
  });
  console.log(`Run: npm run account-deletion:fixture -- verify-after ${scenario}`);
}

async function main() {
  const args = parseAccountDeletionFixtureArgs(process.argv.slice(2));
  if (args.help) return usage();

  await connectFixtureDatabase();
  switch (args.command) {
    case 'seed':
      await seedFixtureScenario(args.scenario, { activeQuest: args.activeQuest });
      break;
    case 'reset':
      await withTransaction((session) => resetFixtureScenario(args.scenario, { session }));
      console.log(`Reset account-deletion fixture scenario: ${args.scenario}`);
      break;
    case 'verify-before':
      await verifyBefore(args.scenario);
      break;
    case 'delete-direct':
      await deleteDirect(args.scenario);
      break;
    case 'create-tree-direct':
      await createTreeDirect(args.scenario);
      break;
    case 'seed-forest-pagination':
      await seedForestPagination(args.scenario);
      break;
    case 'seed-forest-pressure':
      await seedForestPressure(args.scenario);
      break;
    case 'verify-after':
      await verifyAfter(args.scenario);
      break;
    case 'archive-quest':
      await archiveQuest(args.scenario);
      break;
    default:
      throw new Error(`Unsupported command: ${args.command}`);
  }
}

main()
  .catch((error) => {
    console.error('Account-deletion fixture failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));

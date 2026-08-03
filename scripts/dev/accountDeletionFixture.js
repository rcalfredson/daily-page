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
  ACCOUNT_DELETION_FIXTURE_ROOM_ID,
  ACCOUNT_DELETION_FIXTURE_SCENARIOS,
  ACCOUNT_DELETION_FIXTURE_TAG,
  buildAccountDeletionFixture,
  DEFAULT_ACCOUNT_DELETION_FIXTURE_PASSWORD,
  expectedRetainedPostKeys,
  parseAccountDeletionFixtureArgs
} from '../lib/accountDeletionFixture.js';

function usage() {
  console.log('Usage: npm run account-deletion:fixture -- <command> <scenario> [options]');
  console.log('');
  console.log(`Scenarios: ${ACCOUNT_DELETION_FIXTURE_SCENARIOS.join(', ')}`);
  console.log('');
  console.log('Commands:');
  console.log('  seed <scenario> --write [--active-quest]  Reset and seed one scenario.');
  console.log('  verify-before <scenario>                  Verify the login-ready fixture.');
  console.log('  delete-direct <scenario> --write          Invoke the deletion service directly.');
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
  const [users, posts, comments, notifications, activeSessions, quest] = await Promise.all([
    User.find({ _id: { $in: fixture.ids.userIds } }).lean(),
    Block.find({ _id: { $in: fixture.ids.postIds } }).lean(),
    BlockComment.find({ _id: { $in: fixture.ids.commentIds } }).lean(),
    Notification.find({ _id: { $in: fixture.ids.notificationIds } }).lean(),
    AuthSession.countDocuments({
      userId: fixture.users.owner._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    }),
    Quest.findById(fixture.ids.questId).lean()
  ]);

  check.expect('three fixture accounts exist', users.length === 3, users.length);
  check.expect('eight fixture posts exist', posts.length === 8, posts.length);
  check.expect('five interlinked comments exist', comments.length === 5, comments.length);
  check.expect('four notifications exist', notifications.length === 4, notifications.length);
  check.expect('owner has a second active session', activeSessions >= 1, activeSessions);
  check.expect('quest guard record exists', Boolean(quest), quest?.status || null);
  check.expect(
    'in-progress unlisted post is present before deletion',
    posts.some((post) => String(post._id) === fixture.posts.ownerUnlistedDraft._id),
    posts.length
  );
  check.finish(`Pre-deletion verification (${scenario})`);
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
    quest
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
    Quest.findById(fixture.ids.questId).lean()
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
  const result = await deleteAccount({
    userId: fixture.users.owner._id,
    disposition: scenario
  });
  await cleanUpAccountDeletionForests({
    limit: 1,
    ownerUserId: fixture.users.owner._id
  });
  console.log('Direct account-deletion service result:', result);
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

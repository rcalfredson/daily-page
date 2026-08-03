import mongoose from 'mongoose';
import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';
import AuthSession from '../db/models/AuthSession.js';
import Backup from '../db/models/Backup.js';
import Block from '../db/models/Block.js';
import BlockComment from '../db/models/BlockComment.js';
import BlockReaction from '../db/models/BlockReaction.js';
import CommentRateEvent from '../db/models/CommentRateEvent.js';
import CommentReport from '../db/models/CommentReport.js';
import Flag from '../db/models/Flag.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import Notification from '../db/models/Notification.js';
import Quest from '../db/models/Quest.js';
import QuestItem from '../db/models/QuestItem.js';
import QuestSubmission from '../db/models/QuestSubmission.js';
import Session from '../db/models/Session.js';
import User from '../db/models/User.js';
import UsernameReservation from '../db/models/UsernameReservation.js';
import { ACCOUNT_WRITING_DISPOSITIONS } from '../db/schemas/AccountDeletionRequestSchema.js';
import * as cache from './cache.js';

export const USERNAME_QUARANTINE_MS = 365 * 24 * 60 * 60 * 1000;
export {
  DELETION_EVIDENCE_RETENTION_MS
} from './accountDeletionEvidence.js';

export class AccountDeletionError extends Error {
  constructor(code, { status = 400, details = null } = {}) {
    super(code);
    this.name = 'AccountDeletionError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function asId(value) {
  return String(value || '');
}

function ownedPostFilter(userId, username) {
  return {
    $or: [
      { userId },
      {
        $and: [
          { userId: { $in: [null, ''] } },
          { creator: username }
        ]
      }
    ]
  };
}

function retainablePostFilter() {
  return {
    $or: [
      { visibility: 'public' },
      { visibility: 'unlisted', status: 'locked' }
    ]
  };
}

function profileMediaStatus(profilePic) {
  if (!profilePic || profilePic === '/assets/img/default-pic.png') return 'none';
  return 'pending';
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

export function buildAccountDeletionService({
  models = {},
  transactionRunner = runInTransaction,
  clearCache = cache.clear
} = {}) {
  const db = {
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
    Notification,
    Quest,
    QuestItem,
    QuestSubmission,
    Session,
    User,
    UsernameReservation,
    ...models
  };

  return async function deleteAccount({
    userId,
    disposition,
    now = new Date()
  }) {
    if (!ACCOUNT_WRITING_DISPOSITIONS.includes(disposition)) {
      throw new AccountDeletionError('INVALID_DISPOSITION');
    }

    const result = await transactionRunner(async (session) => {
      const user = await db.User.findById(userId, null, { session });
      if (!user) {
        throw new AccountDeletionError('ACCOUNT_NOT_FOUND', { status: 404 });
      }

      const activeAdminQuestCount = await db.Quest.countDocuments({
        administratorUserId: asId(userId),
        status: 'active'
      }, { session });
      if (activeAdminQuestCount) {
        throw new AccountDeletionError('ACTIVE_QUEST_ADMIN', {
          status: 409,
          details: { count: activeAdminQuestCount }
        });
      }

      const username = String(user.username);
      const ownerFilter = ownedPostFilter(asId(userId), username);
      const allOwnedPosts = await db.Block.find(ownerFilter, {
        _id: 1,
        visibility: 1,
        status: 1
      }, { session }).lean();
      const allOwnedPostIds = allOwnedPosts.map((post) => asId(post._id));
      const retainableIds = disposition === 'delete'
        ? []
        : allOwnedPosts
          .filter((post) => (
            post.visibility === 'public'
            || (post.visibility === 'unlisted' && post.status === 'locked')
          ))
          .map((post) => asId(post._id));
      const retainableIdSet = new Set(retainableIds);
      const deletedPostIds = allOwnedPosts
        .map((post) => asId(post._id))
        .filter((postId) => !retainableIdSet.has(postId));
      const retainedCreator = disposition === 'anonymous' ? 'anonymous' : 'Deleted author';

      await db.AccountDeletionRequest.create([{
        ownerUserId: asId(userId),
        disposition,
        status: 'processing',
        startedAt: now,
        evidenceExpiresAt: null,
        profileMedia: {
          url: user.profilePic || null,
          status: profileMediaStatus(user.profilePic)
        },
        forestCleanup: {
          status: 'pending',
          attempts: 0,
          lastAttemptAt: null,
          completedAt: null
        }
      }], { session });

      await db.ForestOwnerWorld.updateMany(
        { ownerUserId: asId(userId) },
        {
          $set: {
            status: 'deleting',
            'reconciliation.state': 'idle',
            'reconciliation.phase': null,
            'reconciliation.blockCursor': null,
            'reconciliation.treeCursor': null,
            'reconciliation.startedAt': null,
            'reconciliation.leaseToken': null,
            'reconciliation.leaseExpiresAt': null
          }
        },
        { session }
      );

      await db.UsernameReservation.updateOne(
        { _id: username },
        {
          $set: {
            expiresAt: new Date(now.getTime() + USERNAME_QUARANTINE_MS),
            reason: 'account-deleted'
          }
        },
        { upsert: true, session }
      );

      if (retainableIds.length) {
        await db.Block.updateMany(
          { _id: { $in: retainableIds } },
          {
            $set: {
              creator: retainedCreator,
              authorshipState: disposition
            },
            $unset: {
              userId: 1,
              editToken: 1
            }
          },
          { session }
        );
      }
      if (allOwnedPostIds.length) {
        await db.Session.deleteMany({ _id: { $in: allOwnedPostIds } }, { session });
        await db.Backup.deleteMany({ _id: { $in: allOwnedPostIds } }, { session });
      }

      const deletedComments = await db.BlockComment.find({
        $or: [
          { userId: asId(userId) },
          ...(deletedPostIds.length ? [{ blockId: { $in: deletedPostIds } }] : [])
        ]
      }, { _id: 1, parentCommentId: 1 }, { session }).lean();
      const deletedCommentIds = deletedComments.map((comment) => asId(comment._id));
      const deletedTopLevelCommentIds = deletedComments
        .filter((comment) => !comment.parentCommentId)
        .map((comment) => asId(comment._id));
      if (deletedTopLevelCommentIds.length) {
        const replies = await db.BlockComment.find({
          parentCommentId: { $in: deletedTopLevelCommentIds }
        }, { _id: 1 }, { session }).lean();
        deletedCommentIds.push(...replies.map((reply) => asId(reply._id)));
      }
      const uniqueDeletedCommentIds = [...new Set(deletedCommentIds)];

      const affectedSubmissions = await db.QuestSubmission.find({
        $or: [
          { ownerUserId: asId(userId) },
          ...(deletedPostIds.length ? [{ blockId: { $in: deletedPostIds } }] : [])
        ]
      }, { _id: 1, blockId: 1, status: 1 }, { session }).lean();
      const affectedSubmissionIds = affectedSubmissions.map((submission) => asId(submission._id));
      const deletedPostIdSet = new Set(deletedPostIds);
      const revokeSubmissionIds = affectedSubmissions
        .filter((submission) => (
          deletedPostIdSet.has(asId(submission.blockId))
          || ['draft', 'pending', 'changes-requested'].includes(submission.status)
        ))
        .map((submission) => asId(submission._id));

      if (revokeSubmissionIds.length) {
        await db.QuestItem.updateMany(
          {
            $or: [
              { activeSubmissionId: { $in: revokeSubmissionIds } },
              { approvedSubmissionId: { $in: revokeSubmissionIds } }
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
        await db.QuestSubmission.updateMany(
          { _id: { $in: revokeSubmissionIds } },
          {
            $set: {
              status: 'revoked',
              replacementSubmissionId: null
            }
          },
          { session }
        );
      }
      if (affectedSubmissionIds.length) {
        await db.QuestSubmission.updateMany(
          { _id: { $in: affectedSubmissionIds } },
          {
            $set: { ownerUserId: null },
            $pull: { contributorUserIds: asId(userId) }
          },
          { session }
        );
      }

      await db.QuestItem.updateMany(
        { reservedByUserId: asId(userId) },
        { $set: { reservedByUserId: null, reservedUntil: null } },
        { session }
      );
      await db.QuestSubmission.updateMany(
        { contributorUserIds: asId(userId) },
        { $pull: { contributorUserIds: asId(userId) } },
        { session }
      );
      await db.QuestSubmission.updateMany(
        { 'reviewHistory.actorUserId': asId(userId) },
        {
          $set: {
            'reviewHistory.$[event].actorType': 'system',
            'reviewHistory.$[event].actorUserId': null
          }
        },
        {
          arrayFilters: [{ 'event.actorUserId': asId(userId) }],
          session
        }
      );
      await db.Quest.updateMany(
        { administratorUserId: asId(userId), status: { $ne: 'active' } },
        { $set: { administratorUserId: null } },
        { session }
      );

      if (deletedPostIds.length) {
        await db.Block.deleteMany({ _id: { $in: deletedPostIds } }, { session });
        await db.BlockReaction.deleteMany({ blockId: { $in: deletedPostIds } }, { session });
        await db.Flag.deleteMany({ blockId: { $in: deletedPostIds } }, { session });
        await db.Block.updateMany(
          { originalBlock: { $in: deletedPostIds } },
          { $unset: { originalBlock: 1, originalAuthor: 1 } },
          { session }
        );
        await db.Block.updateMany(
          { 'editorial.primaryPillarBlockId': { $in: deletedPostIds } },
          { $unset: { 'editorial.primaryPillarBlockId': 1 } },
          { session }
        );
        await db.Block.updateMany(
          { 'editorial.relatedBlockIds': { $in: deletedPostIds } },
          { $pull: { 'editorial.relatedBlockIds': { $in: deletedPostIds } } },
          { session }
        );
      }

      await db.Block.updateMany(
        { collaborators: username },
        { $pull: { collaborators: username } },
        { session }
      );
      await db.Block.updateMany(
        { originalAuthor: username },
        { $unset: { originalAuthor: 1 } },
        { session }
      );
      await db.Block.updateMany(
        { 'votes.userId': asId(userId) },
        [
          {
            $set: {
              votes: {
                $filter: {
                  input: '$votes',
                  as: 'vote',
                  cond: { $ne: ['$$vote.userId', asId(userId)] }
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

      if (uniqueDeletedCommentIds.length) {
        await db.BlockComment.deleteMany({ _id: { $in: uniqueDeletedCommentIds } }, { session });
        await db.CommentReport.deleteMany({
          $or: [
            { commentId: { $in: uniqueDeletedCommentIds } },
            { reporterId: asId(userId) }
          ]
        }, { session });
      } else {
        await db.CommentReport.deleteMany({ reporterId: asId(userId) }, { session });
      }

      await db.BlockReaction.deleteMany({ userId: asId(userId) }, { session });
      await db.CommentRateEvent.deleteMany({ userId: asId(userId) }, { session });
      await db.Flag.updateMany({ reporter: username }, { $set: { reporter: null } }, { session });
      await db.Notification.deleteMany({
        $or: [
          { userId: asId(userId) },
          ...(deletedPostIds.length ? [{ blockId: { $in: deletedPostIds } }] : []),
          ...(uniqueDeletedCommentIds.length
            ? [{ commentId: { $in: uniqueDeletedCommentIds } }]
            : [])
        ]
      }, { session });
      await db.Notification.updateMany(
        { actorUserId: asId(userId) },
        { $set: { actorUserId: null } },
        { session }
      );
      await db.AuthSession.updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: now } },
        { session }
      );

      const deleted = await db.User.deleteOne({ _id: userId }, { session });
      if (deleted.deletedCount !== 1) {
        throw new AccountDeletionError('CONCURRENT_ACCOUNT_CHANGE', { status: 409 });
      }

      const completedAt = new Date(now);
      await db.AccountDeletionRequest.updateOne(
        { ownerUserId: asId(userId), status: 'processing' },
        {
          $set: {
            status: 'completed',
            completedAt,
            counts: {
              retainedPosts: retainableIds.length,
              deletedPosts: deletedPostIds.length
            }
          }
        },
        { session }
      );

      return {
        ownerUserId: asId(userId),
        disposition,
        retainedPosts: retainableIds.length,
        deletedPosts: deletedPostIds.length
      };
    });

    clearCache();
    return result;
  };
}

export const deleteAccount = buildAccountDeletionService();

export function isRetainablePost(post) {
  return Boolean(post && (
    post.visibility === 'public'
    || (post.visibility === 'unlisted' && post.status === 'locked')
  ));
}

export { ownedPostFilter, retainablePostFilter };

import mongoose from 'mongoose';
import Block from './models/Block.js';
import Quest from './models/Quest.js';
import QuestItem from './models/QuestItem.js';
import QuestSubmission from './models/QuestSubmission.js';
import User from './models/User.js';
import {
  QUEST_NOTIFICATION_EVENTS,
  notifyQuestEvent
} from './questNotificationService.js';
import { questAcceptsNewWork } from './questDomain.js';
import { QUEST_ERROR_CODES, questError } from './questErrors.js';
import {
  QUEST_BLOCK_OPERATIONS,
  QUEST_SUBMISSION_ACTIONS,
  assertQuestBlockMutationAllowed,
  assertQuestSubmissionTransition
} from './questSubmissionPolicy.js';

const LIVE_SUBMISSION_STATUSES = Object.freeze(['draft', 'pending', 'changes-requested', 'approved']);

function id(value) {
  return value == null ? '' : String(value);
}

function userActor(userId) {
  return { type: 'user', userId: id(userId) };
}

function systemActor() {
  return { type: 'system' };
}

function createdEvent({ ownerUserId, now, block }) {
  return {
    type: 'created',
    actorType: 'user',
    actorUserId: id(ownerUserId),
    occurredAt: now,
    fromStatus: null,
    toStatus: 'draft',
    comment: null,
    blockUpdatedAt: block?.updatedAt || null,
    reasonCode: null
  };
}

export async function runQuestTransaction(work) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function assertQuestAcceptsNewWork(quest) {
  if (quest?.status === 'archived') {
    throw questError(QUEST_ERROR_CODES.ARCHIVED, { status: 409 });
  }
  if (!questAcceptsNewWork(quest)) {
    throw questError(QUEST_ERROR_CODES.NOT_ACCEPTING_SUBMISSIONS, { status: 409 });
  }
}

function requireFound(value, code, status = 404) {
  if (!value) throw questError(code, { status });
  return value;
}

async function translateDuplicateSubmissionError(work) {
  try {
    return await work();
  } catch (error) {
    if ([11000, 11001].includes(error?.code)) {
      throw questError(QUEST_ERROR_CODES.SUBMISSION_DUPLICATE, { status: 409 });
    }
    throw error;
  }
}

function assertQuestTypeItemShape(quest, itemId) {
  if (quest.type === 'set' && !itemId) {
    throw questError(QUEST_ERROR_CODES.ITEM_NOT_FOUND, { status: 400 });
  }
  if (quest.type === 'count' && itemId) {
    throw questError(QUEST_ERROR_CODES.TYPE_MISMATCH, { status: 409 });
  }
}

function assertBlockCanStartSubmission(quest, block) {
  if (!block || !quest.allowedRoomIds?.includes(block.roomId)) {
    throw questError(QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, {
      status: 409,
      details: { reason: block ? 'room-not-allowed' : 'block-not-found' }
    });
  }
}

function assertSubmissionOwnerOwnsBlock(owner, block) {
  const ownerIdMatches = block.userId && id(block.userId) === id(owner._id);
  const legacyUsernameMatches = !block.userId && block.creator && block.creator === owner.username;
  if (!ownerIdMatches && !legacyUsernameMatches) {
    throw questError(QUEST_ERROR_CODES.FORBIDDEN, {
      status: 403,
      details: { reason: 'submission-owner-does-not-own-block' }
    });
  }
}

async function updateSubmissionForTransition({
  QuestSubmissionModel,
  submission,
  transition,
  session,
  set = {},
  unset = {}
}) {
  const update = {
    $set: { status: transition.toStatus, ...set },
    $push: { reviewHistory: transition.event }
  };
  if (Object.keys(unset).length) update.$unset = unset;

  const updated = await QuestSubmissionModel.findOneAndUpdate({
    _id: submission._id,
    status: transition.fromStatus
  }, update, { returnDocument: 'after', session, runValidators: true });
  if (!updated) {
    throw questError(QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE, {
      status: 409,
      details: { reason: 'concurrent-transition' }
    });
  }
  return updated;
}

async function releaseSubmissionItem({ QuestItemModel, submission, session }) {
  if (!submission.questItemId) return null;
  const item = await QuestItemModel.findOneAndUpdate({
    _id: id(submission.questItemId),
    questId: id(submission.questId),
    activeSubmissionId: id(submission._id)
  }, {
    $set: {
      reservedByUserId: null,
      reservedUntil: null,
      activeSubmissionId: null,
      approvedSubmissionId: null
    }
  }, { returnDocument: 'after', session, runValidators: true });
  if (!item) {
    throw questError(QUEST_ERROR_CODES.ITEM_UNAVAILABLE, {
      status: 409,
      details: { reason: 'submission-item-assignment-changed' }
    });
  }
  return item;
}

async function loadTransitionContext({
  QuestModel,
  QuestSubmissionModel,
  BlockModel,
  submissionId,
  session,
  includeBlock = false
}) {
  const submission = requireFound(
    await QuestSubmissionModel.findById(id(submissionId), null, { session }),
    QUEST_ERROR_CODES.SUBMISSION_NOT_FOUND
  );
  const quest = requireFound(
    await QuestModel.findById(id(submission.questId), null, { session }),
    QUEST_ERROR_CODES.NOT_FOUND
  );
  const block = includeBlock
    ? await BlockModel.findById(id(submission.blockId), null, { session })
    : null;
  return { submission, quest, block };
}

async function resolveContributorUserIds({ UserModel, block, session }) {
  const contributors = new Map();
  if (block.userId) {
    const creator = await UserModel.findById(id(block.userId), null, { session });
    if (creator) contributors.set(id(creator._id), creator);
  }

  const usernames = [...new Set(
    [...(!block.userId ? [block.creator] : []), ...(block.collaborators || [])]
      .map(value => String(value || '').trim())
      .filter(value => value && value !== 'anonymous' && !value.startsWith('anonymous_'))
  )];
  if (usernames.length) {
    const users = await UserModel.find({ username: { $in: usernames } }, null, { session });
    for (const user of users) contributors.set(id(user._id), user);
  }
  return [...contributors.keys()].sort();
}

async function evaluateQuestCompletion({
  QuestModel,
  QuestItemModel,
  QuestSubmissionModel,
  quest,
  session
}) {
  const questId = id(quest._id);
  let completedCount;
  let targetCount;
  if (quest.type === 'set') {
    [completedCount, targetCount] = await Promise.all([
      QuestItemModel.countDocuments({
        questId, active: true, approvedSubmissionId: { $ne: null }
      }, { session }),
      QuestItemModel.countDocuments({ questId, active: true }, { session })
    ]);
  } else {
    completedCount = await QuestSubmissionModel.countDocuments({
      questId, status: 'approved'
    }, { session });
    targetCount = quest.targetCount;
  }

  if (targetCount > 0 && completedCount >= targetCount && quest.status === 'active') {
    await QuestModel.updateOne(
      { _id: quest._id, status: 'active' },
      { $set: { status: 'completed' } },
      { session }
    );
    return true;
  }
  return quest.status === 'completed';
}

export function buildQuestSubmissionService({
  QuestModel = Quest,
  QuestItemModel = QuestItem,
  QuestSubmissionModel = QuestSubmission,
  BlockModel = Block,
  UserModel = User,
  transactionRunner = runQuestTransaction
} = {}) {
  async function createQuestSubmission({ questId, itemId = null, blockId, ownerUserId, now = new Date() }) {
    return translateDuplicateSubmissionError(() => transactionRunner(async session => {
      const [quest, block, owner] = await Promise.all([
        QuestModel.findById(id(questId), null, { session }),
        BlockModel.findById(id(blockId), null, { session }),
        UserModel.findById(id(ownerUserId), null, { session })
      ]);
      requireFound(quest, QUEST_ERROR_CODES.NOT_FOUND);
      requireFound(owner, QUEST_ERROR_CODES.FORBIDDEN, 403);
      assertQuestAcceptsNewWork(quest);
      assertQuestTypeItemShape(quest, itemId);
      assertBlockCanStartSubmission(quest, block);
      assertSubmissionOwnerOwnsBlock(owner, block);

      const duplicate = await QuestSubmissionModel.findOne({
        questId: id(quest._id),
        status: { $in: LIVE_SUBMISSION_STATUSES },
        $or: [
          { blockId: id(block._id) },
          { blockGroupId: id(block.groupId) }
        ]
      }, null, { session });
      if (duplicate) {
        throw questError(QUEST_ERROR_CODES.SUBMISSION_DUPLICATE, { status: 409 });
      }

      let item = null;
      if (quest.type === 'set') {
        item = requireFound(await QuestItemModel.findOne({
          _id: id(itemId), questId: id(quest._id), active: true
        }, null, { session }), QUEST_ERROR_CODES.ITEM_NOT_FOUND);
        if (
          id(item.reservedByUserId) !== id(ownerUserId) ||
          !item.reservedUntil || new Date(item.reservedUntil) <= now ||
          item.activeSubmissionId || item.approvedSubmissionId
        ) {
          const code = item.reservedUntil && new Date(item.reservedUntil) <= now
            ? QUEST_ERROR_CODES.CLAIM_EXPIRED
            : QUEST_ERROR_CODES.ITEM_UNAVAILABLE;
          throw questError(code, { status: 409 });
        }
      }

      const [submission] = await QuestSubmissionModel.create([{
        questId: id(quest._id),
        questItemId: item ? id(item._id) : null,
        ownerUserId: id(ownerUserId),
        blockId: id(block._id),
        blockGroupId: id(block.groupId),
        status: 'draft',
        reviewHistory: [createdEvent({ ownerUserId, now, block })]
      }], { session });

      if (item) {
        const attached = await QuestItemModel.findOneAndUpdate({
          _id: item._id,
          questId: id(quest._id),
          active: true,
          reservedByUserId: id(ownerUserId),
          reservedUntil: { $gt: now },
          activeSubmissionId: null,
          approvedSubmissionId: null
        }, {
          $set: { activeSubmissionId: id(submission._id) }
        }, { returnDocument: 'after', session, runValidators: true });
        if (!attached) {
          throw questError(QUEST_ERROR_CODES.ITEM_UNAVAILABLE, {
            status: 409,
            details: { reason: 'concurrent-item-attachment' }
          });
        }
      }

      return submission;
    }));
  }

  async function submitQuestSubmission({ submissionId, ownerUserId, now = new Date() }) {
    return transactionRunner(async session => {
      const { submission, quest, block } = await loadTransitionContext({
        QuestModel, QuestSubmissionModel, BlockModel, submissionId, session, includeBlock: true
      });
      const ownerExists = await UserModel.exists({ _id: id(ownerUserId) }, { session });
      if (!ownerExists) throw questError(QUEST_ERROR_CODES.FORBIDDEN, { status: 403 });
      if (submission.questItemId) {
        const item = await QuestItemModel.findOne({
          _id: id(submission.questItemId),
          questId: id(quest._id),
          activeSubmissionId: id(submission._id),
          reservedByUserId: id(submission.ownerUserId)
        }, null, { session });
        if (!item) throw questError(QUEST_ERROR_CODES.ITEM_UNAVAILABLE, { status: 409 });
        if (item.reservedUntil && new Date(item.reservedUntil) <= now) {
          throw questError(QUEST_ERROR_CODES.CLAIM_EXPIRED, { status: 409 });
        }
      }

      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.SUBMIT,
        submission,
        quest,
        actor: userActor(ownerUserId),
        block,
        now
      });
      const updated = await updateSubmissionForTransition({
        QuestSubmissionModel,
        submission,
        transition,
        session,
        set: { submittedAt: now, reviewedBlockUpdatedAt: block.updatedAt }
      });
      if (submission.questItemId) {
        await QuestItemModel.updateOne({
          _id: id(submission.questItemId), activeSubmissionId: id(submission._id)
        }, { $set: { reservedUntil: null } }, { session, runValidators: true });
      }
      return updated;
    });
  }

  async function requestQuestSubmissionChanges({
    submissionId, administratorUserId, comment, now = new Date()
  }) {
    return transactionRunner(async session => {
      const { submission, quest } = await loadTransitionContext({
        QuestModel, QuestSubmissionModel, BlockModel, submissionId, session
      });
      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.REQUEST_CHANGES,
        submission,
        quest,
        actor: userActor(administratorUserId),
        comment,
        now
      });
      return updateSubmissionForTransition({
        QuestSubmissionModel, submission, transition, session
      });
    });
  }

  async function reopenQuestSubmissionDraft({ submissionId, ownerUserId, now = new Date() }) {
    return transactionRunner(async session => {
      const { submission, quest, block } = await loadTransitionContext({
        QuestModel, QuestSubmissionModel, BlockModel, submissionId, session, includeBlock: true
      });
      requireFound(block, QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, 409);
      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.REOPEN,
        submission,
        quest,
        actor: userActor(ownerUserId),
        now
      });
      const updated = await updateSubmissionForTransition({
        QuestSubmissionModel,
        submission,
        transition,
        session,
        unset: { reviewedBlockUpdatedAt: 1 }
      });
      const blockUpdate = await BlockModel.updateOne(
        { _id: id(submission.blockId), status: 'locked' },
        { $set: { status: 'in-progress' }, $unset: { lockedAt: 1 } },
        { session }
      );
      if (blockUpdate.matchedCount !== 1) {
        throw questError(QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, {
          status: 409,
          details: { reason: 'block-not-locked' }
        });
      }
      return updated;
    });
  }

  async function approveQuestSubmission({
    submissionId, administratorUserId, comment = null, now = new Date()
  }) {
    return transactionRunner(async session => {
      const { submission, quest, block } = await loadTransitionContext({
        QuestModel, QuestSubmissionModel, BlockModel, submissionId, session, includeBlock: true
      });
      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.APPROVE,
        submission,
        quest,
        actor: userActor(administratorUserId),
        block,
        comment,
        now
      });
      const contributorUserIds = await resolveContributorUserIds({ UserModel, block, session });
      const sequencedQuest = await QuestModel.findOneAndUpdate({
        _id: quest._id,
        status: { $in: ['active', 'completed'] }
      }, {
        $inc: { approvalSequenceCounter: 1 }
      }, { returnDocument: 'after', session, projection: { approvalSequenceCounter: 1 } });
      if (!sequencedQuest) throw questError(QUEST_ERROR_CODES.NOT_ACCEPTING_SUBMISSIONS, { status: 409 });

      const updated = await updateSubmissionForTransition({
        QuestSubmissionModel,
        submission,
        transition,
        session,
        set: {
          approvedAt: now,
          approvedSequence: sequencedQuest.approvalSequenceCounter,
          reviewedBlockUpdatedAt: block.updatedAt,
          contributorUserIds
        }
      });
      if (submission.questItemId) {
        const completedItem = await QuestItemModel.findOneAndUpdate({
          _id: id(submission.questItemId),
          questId: id(quest._id),
          active: true,
          activeSubmissionId: id(submission._id),
          approvedSubmissionId: null
        }, {
          $set: {
            approvedSubmissionId: id(submission._id),
            reservedUntil: null
          }
        }, { returnDocument: 'after', session, runValidators: true });
        if (!completedItem) throw questError(QUEST_ERROR_CODES.ITEM_UNAVAILABLE, { status: 409 });
      }
      const questCompleted = await evaluateQuestCompletion({
        QuestModel, QuestItemModel, QuestSubmissionModel, quest, session
      });
      return { submission: updated, questCompleted };
    });
  }

  async function rejectQuestSubmission({
    submissionId, administratorUserId, comment, now = new Date()
  }) {
    return transactionRunner(async session => {
      const { submission, quest } = await loadTransitionContext({
        QuestModel, QuestSubmissionModel, BlockModel, submissionId, session
      });
      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.REJECT,
        submission,
        quest,
        actor: userActor(administratorUserId),
        comment,
        now
      });
      const updated = await updateSubmissionForTransition({
        QuestSubmissionModel, submission, transition, session
      });
      await releaseSubmissionItem({ QuestItemModel, submission, session });
      return updated;
    });
  }

  async function withdrawQuestSubmission({ submissionId, ownerUserId, now = new Date() }) {
    return transactionRunner(async session => {
      const { submission, quest } = await loadTransitionContext({
        QuestModel, QuestSubmissionModel, BlockModel, submissionId, session
      });
      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.WITHDRAW,
        submission,
        quest,
        actor: userActor(ownerUserId),
        now
      });
      const updated = await updateSubmissionForTransition({
        QuestSubmissionModel, submission, transition, session
      });
      await releaseSubmissionItem({ QuestItemModel, submission, session });
      return updated;
    });
  }

  async function startApprovedSubmissionRevision({
    submissionId, ownerUserId, now = new Date()
  }) {
    return transactionRunner(async session => {
      const { submission, quest, block } = await loadTransitionContext({
        QuestModel, QuestSubmissionModel, BlockModel, submissionId, session, includeBlock: true
      });
      requireFound(block, QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, 409);
      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.START_REVISION,
        submission,
        quest,
        actor: userActor(ownerUserId),
        now
      });
      let historical = await updateSubmissionForTransition({
        QuestSubmissionModel,
        submission,
        transition,
        session
      });
      const [replacement] = await QuestSubmissionModel.create([{
        questId: id(submission.questId),
        questItemId: submission.questItemId ? id(submission.questItemId) : null,
        ownerUserId: id(submission.ownerUserId),
        blockId: id(submission.blockId),
        blockGroupId: id(submission.blockGroupId),
        status: 'draft',
        supersedesSubmissionId: id(submission._id),
        reviewHistory: [createdEvent({ ownerUserId, now, block })]
      }], { session });
      historical = await QuestSubmissionModel.findOneAndUpdate({
        _id: submission._id,
        status: 'revoked',
        replacementSubmissionId: null
      }, {
        $set: { replacementSubmissionId: id(replacement._id) }
      }, { returnDocument: 'after', session, runValidators: true });
      if (!historical) {
        throw questError(QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE, {
          status: 409,
          details: { reason: 'concurrent-revision-link' }
        });
      }

      if (submission.questItemId) {
        const reassigned = await QuestItemModel.findOneAndUpdate({
          _id: id(submission.questItemId),
          activeSubmissionId: id(submission._id),
          approvedSubmissionId: id(submission._id)
        }, {
          $set: {
            activeSubmissionId: id(replacement._id),
            approvedSubmissionId: null,
            reservedByUserId: id(submission.ownerUserId),
            reservedUntil: null
          }
        }, { returnDocument: 'after', session, runValidators: true });
        if (!reassigned) throw questError(QUEST_ERROR_CODES.ITEM_UNAVAILABLE, { status: 409 });
      }

      const blockUpdate = await BlockModel.updateOne(
        { _id: id(submission.blockId), status: 'locked' },
        { $set: { status: 'in-progress' }, $unset: { lockedAt: 1 } },
        { session }
      );
      if (blockUpdate.matchedCount !== 1) {
        throw questError(QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, {
          status: 409,
          details: { reason: 'block-not-locked' }
        });
      }
      return { historicalSubmission: historical, replacementSubmission: replacement };
    });
  }

  async function revokeQuestSubmission({
    submissionId,
    administratorUserId = null,
    reasonCode,
    comment = null,
    now = new Date()
  }) {
    return transactionRunner(async session => {
      const { submission, quest } = await loadTransitionContext({
        QuestModel, QuestSubmissionModel, BlockModel, submissionId, session
      });
      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.REVOKE,
        submission,
        quest,
        actor: administratorUserId ? userActor(administratorUserId) : systemActor(),
        reasonCode,
        comment,
        now
      });
      const updated = await updateSubmissionForTransition({
        QuestSubmissionModel, submission, transition, session
      });
      await releaseSubmissionItem({ QuestItemModel, submission, session });
      return updated;
    });
  }

  async function reconcileQuestSubmissionForBlock({
    blockId, reasonCode, actorUserId = null, now = new Date()
  }) {
    const submissions = await QuestSubmissionModel.find({
      blockId: id(blockId), status: { $in: LIVE_SUBMISSION_STATUSES }
    });
    const results = [];
    for (const candidate of submissions) {
      const result = await transactionRunner(async session => {
        const { submission, quest } = await loadTransitionContext({
          QuestModel,
          QuestSubmissionModel,
          BlockModel,
          submissionId: candidate._id,
          session
        });
        if (!LIVE_SUBMISSION_STATUSES.includes(submission.status)) return null;
        const transition = assertQuestSubmissionTransition({
          action: QUEST_SUBMISSION_ACTIONS.INVALIDATE,
          submission,
          quest,
          actor: actorUserId ? userActor(actorUserId) : systemActor(),
          reasonCode,
          now
        });
        const updated = await updateSubmissionForTransition({
          QuestSubmissionModel, submission, transition, session
        });
        await releaseSubmissionItem({ QuestItemModel, submission, session });
        return updated;
      });
      if (result) results.push(result);
    }
    return results;
  }

  async function expireQuestClaims({ now = new Date(), limit = 100 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
    const candidates = await QuestItemModel.find({
      approvedSubmissionId: null,
      reservedUntil: { $lte: now }
    }, null, { limit: safeLimit });
    let releasedUnattachedClaims = 0;
    let withdrawnDrafts = 0;
    const expiredClaims = [];

    for (const candidate of candidates) {
      const expired = await expireQuestItemClaim({
        questId: candidate.questId,
        itemId: candidate._id,
        now
      });
      if (!expired) continue;
      expiredClaims.push(expired);
      if (expired.submission) withdrawnDrafts += 1;
      else releasedUnattachedClaims += 1;
    }

    return {
      releasedUnattachedClaims,
      withdrawnDrafts,
      expiredClaims
    };
  }

  async function expireQuestItemClaim({ questId, itemId, now = new Date() }) {
    return transactionRunner(async session => {
      const item = await QuestItemModel.findOne({
        _id: id(itemId),
        questId: id(questId),
        approvedSubmissionId: null,
        reservedUntil: { $lte: now }
      }, null, { session });
      if (!item) return null;
      const eventToken = `expired-${new Date(item.reservedUntil).toISOString()}`;

      if (!item.activeSubmissionId) {
        const released = await QuestItemModel.updateOne({
          _id: item._id,
          activeSubmissionId: null,
          approvedSubmissionId: null,
          reservedUntil: { $lte: now }
        }, {
          $set: { reservedByUserId: null, reservedUntil: null }
        }, { session });
        if (released.matchedCount !== 1) return null;
        return {
          questId: id(item.questId),
          itemId: id(item._id),
          ownerUserId: id(item.reservedByUserId),
          blockId: null,
          submission: null,
          eventToken
        };
      }

      const { submission, quest } = await loadTransitionContext({
        QuestModel,
        QuestSubmissionModel,
        BlockModel,
        submissionId: item.activeSubmissionId,
        session
      });
      if (submission.status !== 'draft') return null;
      const transition = assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.EXPIRE,
        submission,
        quest,
        actor: systemActor(),
        now
      });
      const updated = await updateSubmissionForTransition({
        QuestSubmissionModel, submission, transition, session
      });
      await releaseSubmissionItem({ QuestItemModel, submission, session });
      return {
        questId: id(item.questId),
        itemId: id(item._id),
        ownerUserId: id(submission.ownerUserId),
        blockId: id(submission.blockId),
        submission: updated,
        eventToken
      };
    });
  }

  async function getActiveQuestSubmissionsForBlock(blockId) {
    return QuestSubmissionModel.find({
      blockId: id(blockId), status: { $in: LIVE_SUBMISSION_STATUSES }
    });
  }

  async function deleteBlockWithQuestReconciliation({ blockId, now = new Date() }) {
    return transactionRunner(async session => {
      const block = requireFound(
        await BlockModel.findById(id(blockId), null, { session }),
        QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE
      );
      const submissions = await QuestSubmissionModel.find({
        blockId: id(blockId), status: { $in: LIVE_SUBMISSION_STATUSES }
      }, null, { session });
      assertQuestBlockMutationAllowed({
        submissions,
        operation: QUEST_BLOCK_OPERATIONS.DELETE
      });

      for (const submission of submissions) {
        const quest = requireFound(
          await QuestModel.findById(id(submission.questId), null, { session }),
          QUEST_ERROR_CODES.NOT_FOUND
        );
        const transition = assertQuestSubmissionTransition({
          action: QUEST_SUBMISSION_ACTIONS.INVALIDATE,
          submission,
          quest,
          actor: systemActor(),
          reasonCode: 'block-deleted',
          now
        });
        await updateSubmissionForTransition({
          QuestSubmissionModel, submission, transition, session
        });
        await releaseSubmissionItem({ QuestItemModel, submission, session });
      }

      const deleted = await BlockModel.findOneAndDelete(
        { _id: block._id },
        { session }
      );
      if (!deleted) {
        throw questError(QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, {
          status: 409,
          details: { reason: 'concurrent-block-deletion' }
        });
      }
      return deleted;
    });
  }

  return {
    createQuestSubmission,
    submitQuestSubmission,
    requestQuestSubmissionChanges,
    reopenQuestSubmissionDraft,
    approveQuestSubmission,
    rejectQuestSubmission,
    withdrawQuestSubmission,
    startApprovedSubmissionRevision,
    revokeQuestSubmission,
    reconcileQuestSubmissionForBlock,
    expireQuestClaims,
    expireQuestItemClaim,
    getActiveQuestSubmissionsForBlock,
    deleteBlockWithQuestReconciliation
  };
}

export function buildNotifyingQuestSubmissionService({
  coreService,
  notify = notifyQuestEvent,
  logger = console
}) {
  async function dispatch(payload) {
    try {
      await notify(payload);
    } catch (error) {
      logger.error('Failed to create quest workflow notification:', error);
    }
  }

  return {
    ...coreService,
    async submitQuestSubmission(args) {
      const result = await coreService.submitQuestSubmission(args);
      await dispatch({ type: QUEST_NOTIFICATION_EVENTS.REVIEW_REQUESTED, submission: result });
      return result;
    },
    async requestQuestSubmissionChanges(args) {
      const result = await coreService.requestQuestSubmissionChanges(args);
      await dispatch({ type: QUEST_NOTIFICATION_EVENTS.CHANGES_REQUESTED, submission: result });
      return result;
    },
    async approveQuestSubmission(args) {
      const result = await coreService.approveQuestSubmission(args);
      await dispatch({ type: QUEST_NOTIFICATION_EVENTS.APPROVED, submission: result.submission });
      return result;
    },
    async rejectQuestSubmission(args) {
      const result = await coreService.rejectQuestSubmission(args);
      await dispatch({ type: QUEST_NOTIFICATION_EVENTS.REJECTED, submission: result });
      return result;
    },
    async revokeQuestSubmission(args) {
      const result = await coreService.revokeQuestSubmission(args);
      await dispatch({ type: QUEST_NOTIFICATION_EVENTS.REVOKED, submission: result });
      return result;
    },
    async reconcileQuestSubmissionForBlock(args) {
      const results = await coreService.reconcileQuestSubmissionForBlock(args);
      for (const submission of results.filter(result => result.status === 'revoked')) {
        await dispatch({ type: QUEST_NOTIFICATION_EVENTS.REVOKED, submission });
      }
      return results;
    },
    async expireQuestClaims(args) {
      const result = await coreService.expireQuestClaims(args);
      for (const expiry of result.expiredClaims || []) {
        await dispatch({
          type: QUEST_NOTIFICATION_EVENTS.CLAIM_EXPIRED,
          submission: expiry.submission,
          expiry,
          token: expiry.eventToken
        });
      }
      return result;
    },
    async expireQuestItemClaim(args) {
      const result = await coreService.expireQuestItemClaim(args);
      if (result) {
        await dispatch({
          type: QUEST_NOTIFICATION_EVENTS.CLAIM_EXPIRED,
          submission: result.submission,
          expiry: result,
          token: result.eventToken
        });
      }
      return result;
    }
  };
}

const coreQuestSubmissionService = buildQuestSubmissionService();
const questSubmissionService = buildNotifyingQuestSubmissionService({
  coreService: coreQuestSubmissionService
});

export const createQuestSubmission = questSubmissionService.createQuestSubmission;
export const submitQuestSubmission = questSubmissionService.submitQuestSubmission;
export const requestQuestSubmissionChanges = questSubmissionService.requestQuestSubmissionChanges;
export const reopenQuestSubmissionDraft = questSubmissionService.reopenQuestSubmissionDraft;
export const approveQuestSubmission = questSubmissionService.approveQuestSubmission;
export const rejectQuestSubmission = questSubmissionService.rejectQuestSubmission;
export const withdrawQuestSubmission = questSubmissionService.withdrawQuestSubmission;
export const startApprovedSubmissionRevision = questSubmissionService.startApprovedSubmissionRevision;
export const revokeQuestSubmission = questSubmissionService.revokeQuestSubmission;
export const reconcileQuestSubmissionForBlock = questSubmissionService.reconcileQuestSubmissionForBlock;
export const expireQuestClaims = questSubmissionService.expireQuestClaims;
export const expireQuestItemClaim = questSubmissionService.expireQuestItemClaim;
export const getActiveQuestSubmissionsForBlock = questSubmissionService.getActiveQuestSubmissionsForBlock;
export const deleteBlockWithQuestReconciliation =
  questSubmissionService.deleteBlockWithQuestReconciliation;

export { resolveContributorUserIds };

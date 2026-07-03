import {
  isQuestBlockEligible,
  questAcceptsReviewActions
} from './questDomain.js';
import { QUEST_ERROR_CODES, questError } from './questErrors.js';

export const QUEST_SUBMISSION_ACTIONS = Object.freeze({
  SUBMIT: 'submit',
  REQUEST_CHANGES: 'request-changes',
  REOPEN: 'reopen',
  APPROVE: 'approve',
  REJECT: 'reject',
  WITHDRAW: 'withdraw',
  START_REVISION: 'start-revision',
  REVOKE: 'revoke',
  EXPIRE: 'expire',
  INVALIDATE: 'invalidate'
});

export const QUEST_BLOCK_OPERATIONS = Object.freeze({
  CONTENT: 'content',
  METADATA: 'metadata',
  DELETE: 'delete'
});

const TRANSITIONS = Object.freeze({
  [QUEST_SUBMISSION_ACTIONS.SUBMIT]: {
    from: ['draft'],
    to: 'pending',
    actor: 'owner',
    eventType: 'review-requested',
    requiresEligibleBlock: true,
    requiresReviewableQuest: true
  },
  [QUEST_SUBMISSION_ACTIONS.REQUEST_CHANGES]: {
    from: ['pending'],
    to: 'changes-requested',
    actor: 'administrator',
    eventType: 'changes-requested',
    requiresComment: true,
    requiresReviewableQuest: true
  },
  [QUEST_SUBMISSION_ACTIONS.REOPEN]: {
    from: ['changes-requested'],
    to: 'draft',
    actor: 'owner',
    eventType: 'editing-reopened',
    requiresReviewableQuest: true
  },
  [QUEST_SUBMISSION_ACTIONS.APPROVE]: {
    from: ['pending'],
    to: 'approved',
    actor: 'administrator',
    eventType: 'approved',
    requiresEligibleBlock: true,
    requiresUnchangedBlock: true,
    requiresReviewableQuest: true
  },
  [QUEST_SUBMISSION_ACTIONS.REJECT]: {
    from: ['pending'],
    to: 'rejected',
    actor: 'administrator',
    eventType: 'rejected',
    requiresComment: true,
    requiresReviewableQuest: true
  },
  [QUEST_SUBMISSION_ACTIONS.WITHDRAW]: {
    from: ['draft', 'changes-requested', 'pending'],
    to: 'withdrawn',
    actor: 'owner',
    eventType: 'withdrawn'
  },
  [QUEST_SUBMISSION_ACTIONS.START_REVISION]: {
    from: ['approved'],
    to: 'revoked',
    actor: 'owner',
    eventType: 'revision-started',
    defaultReasonCode: 'owner-revision',
    requiresReviewableQuest: true
  },
  [QUEST_SUBMISSION_ACTIONS.REVOKE]: {
    from: ['approved'],
    to: 'revoked',
    actor: 'administrator-or-system',
    eventType: 'revoked',
    requiresReason: true
  },
  [QUEST_SUBMISSION_ACTIONS.EXPIRE]: {
    from: ['draft'],
    to: 'withdrawn',
    actor: 'system',
    eventType: 'claim-expired',
    defaultReasonCode: 'claim-expired'
  },
  [QUEST_SUBMISSION_ACTIONS.INVALIDATE]: {
    from: ['draft', 'changes-requested', 'pending', 'approved'],
    to: null,
    actor: 'administrator-or-system',
    eventType: 'invalidated',
    requiresReason: true,
    dynamicTarget: true
  }
});

const QUEST_LOCKED_SUBMISSION_STATES = new Set(['pending', 'changes-requested', 'approved']);
const VALID_BLOCK_OPERATIONS = new Set(Object.values(QUEST_BLOCK_OPERATIONS));

function idsMatch(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function normalizedComment(comment) {
  const value = String(comment || '').trim();
  return value || null;
}

function assertActor(rule, { submission, quest, actor }) {
  const isUser = actor?.type === 'user' && Boolean(actor.userId);
  const isSystem = actor?.type === 'system' && !actor.userId;
  const isOwner = isUser && idsMatch(actor.userId, submission.ownerUserId);
  const isAdministrator = isUser && idsMatch(actor.userId, quest.administratorUserId);

  const allowed =
    (rule.actor === 'owner' && isOwner) ||
    (rule.actor === 'administrator' && isAdministrator) ||
    (rule.actor === 'system' && isSystem) ||
    (rule.actor === 'administrator-or-system' && (isAdministrator || isSystem));

  if (!allowed) throw questError(QUEST_ERROR_CODES.FORBIDDEN, { status: 403 });
}

function assertBlockRevisionUnchanged(submission, block) {
  const submittedRevision = submission.reviewedBlockUpdatedAt;
  const currentRevision = block?.updatedAt;
  if (!submittedRevision || !currentRevision ||
      new Date(submittedRevision).getTime() !== new Date(currentRevision).getTime()) {
    throw questError(QUEST_ERROR_CODES.SUBMISSION_BLOCK_CHANGED, { status: 409 });
  }
}

function targetFor(rule, submission) {
  if (!rule.dynamicTarget) return rule.to;
  return submission.status === 'approved' || submission.status === 'pending'
    ? 'revoked'
    : 'withdrawn';
}

export function getQuestSubmissionTransition(action) {
  return TRANSITIONS[action] || null;
}

export function assertQuestSubmissionTransition({
  action,
  submission,
  quest,
  actor,
  block = null,
  comment = null,
  reasonCode = null,
  now = new Date()
}) {
  const rule = getQuestSubmissionTransition(action);
  if (!rule || !submission || !quest) {
    throw questError(QUEST_ERROR_CODES.INVALID, {
      details: { field: 'transition', reason: 'unknown-action-or-missing-context' }
    });
  }

  if (!rule.from.includes(submission.status)) {
    throw questError(QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE, {
      status: 409,
      details: { action, status: submission.status, allowedFrom: rule.from }
    });
  }

  assertActor(rule, { submission, quest, actor });

  if (rule.requiresReviewableQuest && !questAcceptsReviewActions(quest)) {
    const code = quest.status === 'archived'
      ? QUEST_ERROR_CODES.ARCHIVED
      : QUEST_ERROR_CODES.NOT_ACCEPTING_SUBMISSIONS;
    throw questError(code, { status: 409 });
  }

  const cleanComment = normalizedComment(comment);
  if (rule.requiresComment && !cleanComment) {
    throw questError(QUEST_ERROR_CODES.REVIEW_COMMENT_REQUIRED, { status: 400 });
  }
  if (cleanComment && cleanComment.length > 4000) {
    throw questError(QUEST_ERROR_CODES.INVALID, {
      details: { field: 'comment', reason: 'too-long' }
    });
  }

  const cleanReasonCode = String(reasonCode || rule.defaultReasonCode || '').trim() || null;
  if (rule.requiresReason && !cleanReasonCode) {
    throw questError(QUEST_ERROR_CODES.INVALID, {
      details: { field: 'reasonCode', reason: 'required' }
    });
  }

  if (rule.requiresEligibleBlock && !isQuestBlockEligible(quest, block)) {
    throw questError(QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE, { status: 409 });
  }
  if (rule.requiresUnchangedBlock) assertBlockRevisionUnchanged(submission, block);

  const toStatus = targetFor(rule, submission);
  return {
    action,
    fromStatus: submission.status,
    toStatus,
    event: {
      type: rule.eventType,
      actorType: actor.type,
      actorUserId: actor.type === 'user' ? String(actor.userId) : null,
      occurredAt: now,
      fromStatus: submission.status,
      toStatus,
      comment: cleanComment,
      blockUpdatedAt: block?.updatedAt || null,
      reasonCode: cleanReasonCode
    }
  };
}

export function getQuestBlockMutationPolicy({ submissions = [], operation }) {
  if (!VALID_BLOCK_OPERATIONS.has(operation)) {
    throw questError(QUEST_ERROR_CODES.INVALID, {
      details: { field: 'operation', reason: 'unknown-block-operation' }
    });
  }

  const blockingSubmission = submissions.find(submission =>
    QUEST_LOCKED_SUBMISSION_STATES.has(submission?.status)
  );
  if (!blockingSubmission) return { allowed: true, reason: null, submissionId: null };

  return {
    allowed: false,
    reason: `quest-submission-${blockingSubmission.status}`,
    submissionId: String(blockingSubmission._id || blockingSubmission.id || '') || null
  };
}

export function assertQuestBlockMutationAllowed(options) {
  const policy = getQuestBlockMutationPolicy(options);
  if (!policy.allowed) {
    throw questError(QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE, {
      status: 409,
      details: { reason: policy.reason, submissionId: policy.submissionId }
    });
  }
  return policy;
}

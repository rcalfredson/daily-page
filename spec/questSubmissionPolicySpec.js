import {
  QUEST_BLOCK_OPERATIONS,
  QUEST_SUBMISSION_ACTIONS,
  assertQuestBlockMutationAllowed,
  assertQuestSubmissionTransition,
  getQuestBlockMutationPolicy
} from '../server/db/questSubmissionPolicy.js';
import { QUEST_ERROR_CODES, QuestDomainError } from '../server/db/questErrors.js';

const NOW = new Date('2026-07-03T12:00:00.000Z');
const BLOCK_UPDATED_AT = new Date('2026-07-03T11:00:00.000Z');

function quest(overrides = {}) {
  return {
    status: 'active',
    administratorUserId: 'admin-1',
    allowedRoomIds: ['united-states'],
    ...overrides
  };
}

function submission(status, overrides = {}) {
  return {
    _id: 'submission-1',
    status,
    ownerUserId: 'owner-1',
    reviewedBlockUpdatedAt: BLOCK_UPDATED_AT,
    ...overrides
  };
}

function eligibleBlock(overrides = {}) {
  return {
    _id: 'block-1',
    roomId: 'united-states',
    visibility: 'unlisted',
    status: 'locked',
    updatedAt: BLOCK_UPDATED_AT,
    ...overrides
  };
}

function user(userId) {
  return { type: 'user', userId };
}

function expectQuestError(fn, code) {
  try {
    fn();
    fail(`Expected ${code}`);
  } catch (error) {
    expect(error).toEqual(jasmine.any(QuestDomainError));
    expect(error.code).toBe(code);
    return error;
  }
  return null;
}

describe('quest submission transition policy', () => {
  it('lets an owner submit an eligible locked post and constructs immutable event input', () => {
    const result = assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.SUBMIT,
      submission: submission('draft'),
      quest: quest(),
      actor: user('owner-1'),
      block: eligibleBlock(),
      now: NOW
    });

    expect(result).toEqual({
      action: 'submit',
      fromStatus: 'draft',
      toStatus: 'pending',
      event: {
        type: 'review-requested',
        actorType: 'user',
        actorUserId: 'owner-1',
        occurredAt: NOW,
        fromStatus: 'draft',
        toStatus: 'pending',
        comment: null,
        blockUpdatedAt: BLOCK_UPDATED_AT,
        reasonCode: null
      }
    });
  });

  it('rejects submission by another user or with an ineligible block', () => {
    expectQuestError(() => assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.SUBMIT,
      submission: submission('draft'),
      quest: quest(),
      actor: user('someone-else'),
      block: eligibleBlock()
    }), QUEST_ERROR_CODES.FORBIDDEN);

    expectQuestError(() => assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.SUBMIT,
      submission: submission('draft'),
      quest: quest(),
      actor: user('owner-1'),
      block: eligibleBlock({ status: 'in-progress' })
    }), QUEST_ERROR_CODES.SUBMISSION_BLOCK_INELIGIBLE);
  });

  it('allows review actions for active and completed quests but not archived quests', () => {
    const input = {
      action: QUEST_SUBMISSION_ACTIONS.REQUEST_CHANGES,
      submission: submission('pending'),
      actor: user('admin-1'),
      comment: 'Please add another source.'
    };

    expect(assertQuestSubmissionTransition({ ...input, quest: quest() }).toStatus)
      .toBe('changes-requested');
    expect(assertQuestSubmissionTransition({
      ...input, quest: quest({ status: 'completed' })
    }).toStatus).toBe('changes-requested');
    expectQuestError(() => assertQuestSubmissionTransition({
      ...input, quest: quest({ status: 'archived' })
    }), QUEST_ERROR_CODES.ARCHIVED);
  });

  it('requires administrator review comments when requesting changes or rejecting', () => {
    for (const action of [
      QUEST_SUBMISSION_ACTIONS.REQUEST_CHANGES,
      QUEST_SUBMISSION_ACTIONS.REJECT
    ]) {
      expectQuestError(() => assertQuestSubmissionTransition({
        action,
        submission: submission('pending'),
        quest: quest(),
        actor: user('admin-1'),
        comment: '   '
      }), QUEST_ERROR_CODES.REVIEW_COMMENT_REQUIRED);
    }
  });

  it('only lets the owner reopen a changes-requested submission', () => {
    const result = assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.REOPEN,
      submission: submission('changes-requested'),
      quest: quest(),
      actor: user('owner-1')
    });
    expect(result.toStatus).toBe('draft');

    expectQuestError(() => assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.REOPEN,
      submission: submission('changes-requested'),
      quest: quest(),
      actor: user('admin-1')
    }), QUEST_ERROR_CODES.FORBIDDEN);
  });

  it('approves only an unchanged eligible revision', () => {
    const result = assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.APPROVE,
      submission: submission('pending'),
      quest: quest(),
      actor: user('admin-1'),
      block: eligibleBlock()
    });
    expect(result.toStatus).toBe('approved');

    expectQuestError(() => assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.APPROVE,
      submission: submission('pending'),
      quest: quest(),
      actor: user('admin-1'),
      block: eligibleBlock({ updatedAt: new Date('2026-07-03T11:30:00.000Z') })
    }), QUEST_ERROR_CODES.SUBMISSION_BLOCK_CHANGED);
  });

  it('allows owners to withdraw only non-terminal review work', () => {
    for (const status of ['draft', 'changes-requested', 'pending']) {
      expect(assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.WITHDRAW,
        submission: submission(status),
        quest: quest(),
        actor: user('owner-1')
      }).toStatus).toBe('withdrawn');
    }

    expectQuestError(() => assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.WITHDRAW,
      submission: submission('approved'),
      quest: quest(),
      actor: user('owner-1')
    }), QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE);
  });

  it('starts approved revision with the contract reason code', () => {
    const result = assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.START_REVISION,
      submission: submission('approved'),
      quest: quest(),
      actor: user('owner-1'),
      now: NOW
    });
    expect(result.toStatus).toBe('revoked');
    expect(result.event.reasonCode).toBe('owner-revision');
    expect(result.event.type).toBe('revision-started');
  });

  it('restricts revocation and expiry to their privileged actors', () => {
    expect(assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.REVOKE,
      submission: submission('approved'),
      quest: quest(),
      actor: { type: 'system' },
      reasonCode: 'block-deleted'
    }).toStatus).toBe('revoked');

    expectQuestError(() => assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.REVOKE,
      submission: submission('approved'),
      quest: quest(),
      actor: user('owner-1'),
      reasonCode: 'block-deleted'
    }), QUEST_ERROR_CODES.FORBIDDEN);

    expect(assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.EXPIRE,
      submission: submission('draft'),
      quest: quest(),
      actor: { type: 'system' }
    }).event.reasonCode).toBe('claim-expired');
  });

  it('maps invalidation to revoked for reviewed work and withdrawn for editable work', () => {
    for (const status of ['pending', 'approved']) {
      expect(assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.INVALIDATE,
        submission: submission(status),
        quest: quest(),
        actor: { type: 'system' },
        reasonCode: 'block-deleted'
      }).toStatus).toBe('revoked');
    }
    for (const status of ['draft', 'changes-requested']) {
      expect(assertQuestSubmissionTransition({
        action: QUEST_SUBMISSION_ACTIONS.INVALIDATE,
        submission: submission(status),
        quest: quest(),
        actor: { type: 'system' },
        reasonCode: 'block-deleted'
      }).toStatus).toBe('withdrawn');
    }
  });

  it('rejects transitions from states not admitted by the action', () => {
    const error = expectQuestError(() => assertQuestSubmissionTransition({
      action: QUEST_SUBMISSION_ACTIONS.APPROVE,
      submission: submission('draft'),
      quest: quest(),
      actor: user('admin-1'),
      block: eligibleBlock()
    }), QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE);
    expect(error.details.allowedFrom).toEqual(['pending']);
  });
});

describe('quest block mutation policy', () => {
  it('allows ordinary mutations for drafts and terminal submissions', () => {
    for (const status of ['draft', 'rejected', 'withdrawn', 'revoked']) {
      expect(getQuestBlockMutationPolicy({
        submissions: [submission(status)],
        operation: QUEST_BLOCK_OPERATIONS.CONTENT
      }).allowed).toBeTrue();
    }
  });

  it('blocks content, metadata, and deletion during review and after approval', () => {
    for (const status of ['pending', 'changes-requested', 'approved']) {
      for (const operation of Object.values(QUEST_BLOCK_OPERATIONS)) {
        const result = getQuestBlockMutationPolicy({
          submissions: [submission(status)], operation
        });
        expect(result).toEqual({
          allowed: false,
          reason: `quest-submission-${status}`,
          submissionId: 'submission-1'
        });
      }
    }
  });

  it('throws a typed state error when a blocked mutation is asserted', () => {
    const error = expectQuestError(() => assertQuestBlockMutationAllowed({
      submissions: [submission('pending')],
      operation: QUEST_BLOCK_OPERATIONS.DELETE
    }), QUEST_ERROR_CODES.SUBMISSION_INVALID_STATE);
    expect(error.details.reason).toBe('quest-submission-pending');
  });
});

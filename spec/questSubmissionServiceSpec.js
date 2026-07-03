import mongoose from 'mongoose';
import {
  buildQuestSubmissionService,
  runQuestTransaction,
  resolveContributorUserIds
} from '../server/db/questSubmissionService.js';
import { QUEST_ERROR_CODES, QuestDomainError } from '../server/db/questErrors.js';

const NOW = new Date('2026-07-03T12:00:00.000Z');

function comparable(value) {
  return value instanceof Date ? value.getTime() : String(value);
}

function matchesValue(actual, expected) {
  if (expected === null && actual === undefined) return true;
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    if ('$in' in expected) return expected.$in.some(value => comparable(actual) === comparable(value));
    if ('$ne' in expected) return comparable(actual) !== comparable(expected.$ne);
    if ('$gt' in expected) return comparable(actual) > comparable(expected.$gt);
    if ('$lte' in expected) return comparable(actual) <= comparable(expected.$lte);
  }
  return comparable(actual) === comparable(expected);
}

function matches(document, filter) {
  return Object.entries(filter || {}).every(([field, expected]) => {
    if (field === '$or') return expected.some(branch => matches(document, branch));
    return matchesValue(document[field], expected);
  });
}

function applyUpdate(document, update) {
  if (update.$set) Object.assign(document, update.$set);
  if (update.$unset) {
    for (const field of Object.keys(update.$unset)) delete document[field];
  }
  if (update.$inc) {
    for (const [field, amount] of Object.entries(update.$inc)) {
      document[field] = (document[field] || 0) + amount;
    }
  }
  if (update.$push) {
    for (const [field, value] of Object.entries(update.$push)) {
      document[field] ||= [];
      document[field].push(value);
    }
  }
  return document;
}

function makeCollection(initial = [], prefix = 'id') {
  const documents = initial;
  let sequence = initial.length;
  return {
    documents,
    async findById(documentId) {
      return documents.find(document => String(document._id) === String(documentId)) || null;
    },
    async findOne(filter) {
      return documents.find(document => matches(document, filter)) || null;
    },
    async find(filter, projection, options = {}) {
      const found = documents.filter(document => matches(document, filter));
      return options.limit ? found.slice(0, options.limit) : found;
    },
    async create(rows) {
      return rows.map(row => {
        const document = { _id: `${prefix}-${++sequence}`, ...row };
        documents.push(document);
        return document;
      });
    },
    async findOneAndUpdate(filter, update) {
      const document = documents.find(candidate => matches(candidate, filter));
      return document ? applyUpdate(document, update) : null;
    },
    async updateOne(filter, update) {
      const document = documents.find(candidate => matches(candidate, filter));
      if (!document) return { matchedCount: 0, modifiedCount: 0 };
      applyUpdate(document, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany(filter, update) {
      const found = documents.filter(document => matches(document, filter));
      found.forEach(document => applyUpdate(document, update));
      return { matchedCount: found.length, modifiedCount: found.length };
    },
    async countDocuments(filter) {
      return documents.filter(document => matches(document, filter)).length;
    },
    async exists(filter) {
      return documents.some(document => matches(document, filter));
    }
  };
}

function makeHarness({ targetItemCount = 1 } = {}) {
  const quests = makeCollection([{
    _id: 'quest-1',
    type: 'set',
    status: 'active',
    administratorUserId: 'admin-1',
    allowedRoomIds: ['united-states'],
    reservationDurationHours: 168,
    approvalSequenceCounter: 0
  }, {
    _id: 'count-quest',
    type: 'count',
    status: 'active',
    administratorUserId: 'admin-1',
    allowedRoomIds: ['united-states'],
    targetCount: 2,
    approvalSequenceCounter: 0
  }], 'quest');
  const items = [];
  for (let index = 0; index < targetItemCount; index += 1) {
    items.push({
      _id: `item-${index + 1}`,
      questId: 'quest-1',
      active: true,
      reservedByUserId: index === 0 ? 'owner-1' : null,
      reservedUntil: index === 0 ? new Date('2026-07-10T12:00:00.000Z') : null,
      activeSubmissionId: null,
      approvedSubmissionId: null
    });
  }
  const questItems = makeCollection(items, 'item');
  const submissions = makeCollection([], 'submission');
  const blocks = makeCollection([{
    _id: 'block-1',
    groupId: 'group-1',
    roomId: 'united-states',
    userId: 'owner-1',
    creator: 'Owner',
    collaborators: ['Collaborator', 'anonymous_123', 'Owner', 'MissingUser'],
    visibility: 'unlisted',
    status: 'in-progress',
    updatedAt: new Date('2026-07-03T10:00:00.000Z')
  }, {
    _id: 'block-2',
    groupId: 'group-2',
    roomId: 'united-states',
    userId: 'owner-1',
    creator: 'Owner',
    collaborators: [],
    visibility: 'public',
    status: 'locked',
    updatedAt: new Date('2026-07-03T09:00:00.000Z')
  }], 'block');
  const users = makeCollection([{
    _id: 'owner-1', username: 'Owner'
  }, {
    _id: 'admin-1', username: 'Admin'
  }, {
    _id: 'collaborator-1', username: 'Collaborator'
  }], 'user');
  const transactionRunner = jasmine.createSpy('transactionRunner').and.callFake(work => work('session'));
  const service = buildQuestSubmissionService({
    QuestModel: quests,
    QuestItemModel: questItems,
    QuestSubmissionModel: submissions,
    BlockModel: blocks,
    UserModel: users,
    transactionRunner
  });
  return { service, quests, questItems, submissions, blocks, users, transactionRunner };
}

async function expectQuestError(promise, code) {
  try {
    await promise;
    fail(`Expected ${code}`);
  } catch (error) {
    expect(error).toEqual(jasmine.any(QuestDomainError));
    expect(error.code).toBe(code);
  }
}

describe('transactional quest submission service', () => {
  it('creates a set submission and conditionally attaches it to its live claim', async () => {
    const harness = makeHarness();
    const created = await harness.service.createQuestSubmission({
      questId: 'quest-1',
      itemId: 'item-1',
      blockId: 'block-1',
      ownerUserId: 'owner-1',
      now: NOW
    });

    expect(created.status).toBe('draft');
    expect(created.blockGroupId).toBe('group-1');
    expect(created.reviewHistory[0].type).toBe('created');
    expect(harness.questItems.documents[0].activeSubmissionId).toBe(created._id);
    expect(harness.transactionRunner).toHaveBeenCalledTimes(1);
  });

  it('creates count submissions without items and excludes translations of a live qualifying post', async () => {
    const harness = makeHarness();
    const created = await harness.service.createQuestSubmission({
      questId: 'count-quest', blockId: 'block-1', ownerUserId: 'owner-1', now: NOW
    });
    expect(created.questItemId).toBeNull();

    harness.blocks.documents.push({
      _id: 'block-translation',
      groupId: 'group-1',
      roomId: 'united-states',
      userId: 'owner-1',
      creator: 'Owner',
      collaborators: [],
      visibility: 'public',
      status: 'locked',
      updatedAt: NOW
    });
    await expectQuestError(harness.service.createQuestSubmission({
      questId: 'count-quest',
      blockId: 'block-translation',
      ownerUserId: 'owner-1',
      now: NOW
    }), QUEST_ERROR_CODES.SUBMISSION_DUPLICATE);
  });

  it('rejects expired claims and duplicate live block submissions', async () => {
    const harness = makeHarness();
    harness.questItems.documents[0].reservedUntil = new Date('2026-07-03T11:59:59.000Z');
    await expectQuestError(harness.service.createQuestSubmission({
      questId: 'quest-1', itemId: 'item-1', blockId: 'block-1', ownerUserId: 'owner-1', now: NOW
    }), QUEST_ERROR_CODES.CLAIM_EXPIRED);

    harness.questItems.documents[0].reservedUntil = new Date('2026-07-10T12:00:00.000Z');
    await harness.service.createQuestSubmission({
      questId: 'quest-1', itemId: 'item-1', blockId: 'block-1', ownerUserId: 'owner-1', now: NOW
    });
    await expectQuestError(harness.service.createQuestSubmission({
      questId: 'quest-1', itemId: 'item-1', blockId: 'block-1', ownerUserId: 'owner-1', now: NOW
    }), QUEST_ERROR_CODES.SUBMISSION_DUPLICATE);
  });

  it('submits, requests changes, reopens, resubmits, and approves atomically', async () => {
    const harness = makeHarness();
    const draft = await harness.service.createQuestSubmission({
      questId: 'quest-1', itemId: 'item-1', blockId: 'block-1', ownerUserId: 'owner-1', now: NOW
    });
    harness.blocks.documents[0].status = 'locked';
    harness.blocks.documents[0].updatedAt = new Date('2026-07-03T11:00:00.000Z');

    const pending = await harness.service.submitQuestSubmission({
      submissionId: draft._id, ownerUserId: 'owner-1', now: NOW
    });
    expect(pending.status).toBe('pending');
    expect(pending.reviewedBlockUpdatedAt).toEqual(harness.blocks.documents[0].updatedAt);
    expect(harness.questItems.documents[0].reservedUntil).toBeNull();

    const changes = await harness.service.requestQuestSubmissionChanges({
      submissionId: draft._id,
      administratorUserId: 'admin-1',
      comment: 'Please add one more viewpoint.',
      now: NOW
    });
    expect(changes.status).toBe('changes-requested');

    const reopened = await harness.service.reopenQuestSubmissionDraft({
      submissionId: draft._id, ownerUserId: 'owner-1', now: NOW
    });
    expect(reopened.status).toBe('draft');
    expect(harness.blocks.documents[0].status).toBe('in-progress');
    expect(reopened.reviewedBlockUpdatedAt).toBeUndefined();

    harness.blocks.documents[0].status = 'locked';
    harness.blocks.documents[0].updatedAt = new Date('2026-07-03T11:30:00.000Z');
    await harness.service.submitQuestSubmission({
      submissionId: draft._id, ownerUserId: 'owner-1', now: NOW
    });
    const approved = await harness.service.approveQuestSubmission({
      submissionId: draft._id, administratorUserId: 'admin-1', now: NOW
    });

    expect(approved.submission.status).toBe('approved');
    expect(approved.submission.approvedSequence).toBe(1);
    expect(approved.submission.contributorUserIds).toEqual(['collaborator-1', 'owner-1']);
    expect(harness.questItems.documents[0].approvedSubmissionId).toBe(draft._id);
    expect(harness.quests.documents[0].status).toBe('completed');
    expect(approved.questCompleted).toBeTrue();
  });

  it('refuses approval if the reviewed block changed', async () => {
    const harness = makeHarness();
    const [pending] = await harness.submissions.create([{
      questId: 'quest-1',
      questItemId: 'item-1',
      ownerUserId: 'owner-1',
      blockId: 'block-2',
      blockGroupId: 'group-2',
      status: 'pending',
      reviewedBlockUpdatedAt: new Date('2026-07-03T08:00:00.000Z'),
      reviewHistory: []
    }]);
    harness.questItems.documents[0].activeSubmissionId = pending._id;
    await expectQuestError(harness.service.approveQuestSubmission({
      submissionId: pending._id, administratorUserId: 'admin-1', now: NOW
    }), QUEST_ERROR_CODES.SUBMISSION_BLOCK_CHANGED);
  });

  it('releases a set item when a pending submission is rejected', async () => {
    const harness = makeHarness();
    const [pending] = await harness.submissions.create([{
      questId: 'quest-1',
      questItemId: 'item-1',
      ownerUserId: 'owner-1',
      blockId: 'block-2',
      blockGroupId: 'group-2',
      status: 'pending',
      reviewHistory: []
    }]);
    Object.assign(harness.questItems.documents[0], {
      activeSubmissionId: pending._id,
      reservedUntil: null
    });
    const rejected = await harness.service.rejectQuestSubmission({
      submissionId: pending._id,
      administratorUserId: 'admin-1',
      comment: 'This targets the wrong item.',
      now: NOW
    });
    expect(rejected.status).toBe('rejected');
    expect(harness.questItems.documents[0].activeSubmissionId).toBeNull();
    expect(harness.questItems.documents[0].reservedByUserId).toBeNull();
  });

  it('withdraws owner-controlled work and releases its set item', async () => {
    const harness = makeHarness();
    const draft = await harness.service.createQuestSubmission({
      questId: 'quest-1', itemId: 'item-1', blockId: 'block-1', ownerUserId: 'owner-1', now: NOW
    });
    const withdrawn = await harness.service.withdrawQuestSubmission({
      submissionId: draft._id, ownerUserId: 'owner-1', now: NOW
    });
    expect(withdrawn.status).toBe('withdrawn');
    expect(harness.questItems.documents[0].activeSubmissionId).toBeNull();
  });

  it('replaces an approved submission with a retained, non-expiring revision draft', async () => {
    const harness = makeHarness();
    const [approved] = await harness.submissions.create([{
      questId: 'quest-1',
      questItemId: 'item-1',
      ownerUserId: 'owner-1',
      blockId: 'block-2',
      blockGroupId: 'group-2',
      status: 'approved',
      approvedAt: NOW,
      approvedSequence: 1,
      reviewedBlockUpdatedAt: harness.blocks.documents[1].updatedAt,
      contributorUserIds: ['owner-1'],
      reviewHistory: []
    }]);
    Object.assign(harness.questItems.documents[0], {
      activeSubmissionId: approved._id,
      approvedSubmissionId: approved._id,
      reservedUntil: null
    });

    const result = await harness.service.startApprovedSubmissionRevision({
      submissionId: approved._id, ownerUserId: 'owner-1', now: NOW
    });
    expect(result.historicalSubmission.status).toBe('revoked');
    expect(result.historicalSubmission.replacementSubmissionId)
      .toBe(result.replacementSubmission._id);
    expect(result.replacementSubmission.supersedesSubmissionId).toBe(approved._id);
    expect(harness.questItems.documents[0].activeSubmissionId)
      .toBe(result.replacementSubmission._id);
    expect(harness.questItems.documents[0].approvedSubmissionId).toBeNull();
    expect(harness.questItems.documents[0].reservedUntil).toBeNull();
    expect(harness.blocks.documents[1].status).toBe('in-progress');
  });

  it('reconciles live submissions idempotently and releases their item', async () => {
    const harness = makeHarness();
    const [approved] = await harness.submissions.create([{
      questId: 'quest-1',
      questItemId: 'item-1',
      ownerUserId: 'owner-1',
      blockId: 'block-2',
      blockGroupId: 'group-2',
      status: 'approved',
      reviewHistory: []
    }]);
    Object.assign(harness.questItems.documents[0], {
      activeSubmissionId: approved._id,
      approvedSubmissionId: approved._id,
      reservedUntil: null
    });

    const first = await harness.service.reconcileQuestSubmissionForBlock({
      blockId: 'block-2', reasonCode: 'block-deleted', now: NOW
    });
    const second = await harness.service.reconcileQuestSubmissionForBlock({
      blockId: 'block-2', reasonCode: 'block-deleted', now: NOW
    });
    expect(first.length).toBe(1);
    expect(first[0].status).toBe('revoked');
    expect(second).toEqual([]);
    expect(harness.questItems.documents[0].activeSubmissionId).toBeNull();
  });

  it('expires unattached claims and attached drafts without deleting posts', async () => {
    const harness = makeHarness({ targetItemCount: 2 });
    const [draft] = await harness.submissions.create([{
      questId: 'quest-1',
      questItemId: 'item-1',
      ownerUserId: 'owner-1',
      blockId: 'block-1',
      blockGroupId: 'group-1',
      status: 'draft',
      reviewHistory: []
    }]);
    Object.assign(harness.questItems.documents[0], {
      activeSubmissionId: draft._id,
      reservedUntil: new Date('2026-07-03T11:00:00.000Z')
    });
    Object.assign(harness.questItems.documents[1], {
      reservedByUserId: 'owner-1',
      reservedUntil: new Date('2026-07-03T11:00:00.000Z')
    });

    const result = await harness.service.expireQuestClaims({ now: NOW });
    expect(result).toEqual({ releasedUnattachedClaims: 1, withdrawnDrafts: 1 });
    expect(draft.status).toBe('withdrawn');
    expect(harness.questItems.documents[0].activeSubmissionId).toBeNull();
    expect(harness.blocks.documents.some(block => block._id === 'block-1')).toBeTrue();
  });

  it('lazily expires one attached item claim for claim-sensitive operations', async () => {
    const harness = makeHarness();
    const [draft] = await harness.submissions.create([{
      questId: 'quest-1',
      questItemId: 'item-1',
      ownerUserId: 'owner-1',
      blockId: 'block-1',
      blockGroupId: 'group-1',
      status: 'draft',
      reviewHistory: []
    }]);
    Object.assign(harness.questItems.documents[0], {
      activeSubmissionId: draft._id,
      reservedUntil: new Date('2026-07-03T11:00:00.000Z')
    });

    expect(await harness.service.expireQuestItemClaim({
      questId: 'quest-1', itemId: 'item-1', now: NOW
    })).toBeTrue();
    expect(draft.status).toBe('withdrawn');
    expect(harness.questItems.documents[0].activeSubmissionId).toBeNull();
  });
});

describe('quest contributor snapshots', () => {
  it('deduplicates registered creator and collaborators while excluding anonymous identities', async () => {
    const harness = makeHarness();
    const contributors = await resolveContributorUserIds({
      UserModel: harness.users,
      block: harness.blocks.documents[0],
      session: 'session'
    });
    expect(contributors).toEqual(['collaborator-1', 'owner-1']);
  });
});

describe('quest transaction runner', () => {
  it('commits callback results and always closes the session', async () => {
    const session = {
      withTransaction: jasmine.createSpy('withTransaction').and.callFake(callback => callback()),
      endSession: jasmine.createSpy('endSession').and.resolveTo()
    };
    spyOn(mongoose, 'startSession').and.resolveTo(session);

    await expectAsync(runQuestTransaction(async activeSession => {
      expect(activeSession).toBe(session);
      return 'committed-result';
    })).toBeResolvedTo('committed-result');
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('propagates transaction failures after closing the session', async () => {
    const failure = new Error('write conflict');
    const session = {
      withTransaction: jasmine.createSpy('withTransaction').and.callFake(callback => callback()),
      endSession: jasmine.createSpy('endSession').and.resolveTo()
    };
    spyOn(mongoose, 'startSession').and.resolveTo(session);

    await expectAsync(runQuestTransaction(async () => {
      throw failure;
    })).toBeRejectedWith(failure);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});

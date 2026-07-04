import {
  QUEST_NOTIFICATION_EVENTS,
  buildQuestNotificationService
} from '../server/db/questNotificationService.js';

function modelById(documents) {
  return {
    findById: jasmine.createSpy('findById').and.callFake(async id =>
      documents.find(document => String(document._id) === String(id)) || null
    )
  };
}

function submission(overrides = {}) {
  return {
    _id: 'submission-1',
    questId: 'quest-1',
    questItemId: 'item-1',
    ownerUserId: 'owner-1',
    blockId: 'block-1',
    status: 'pending',
    reviewHistory: [{
      _id: 'event-1',
      type: 'review-requested',
      actorType: 'user',
      actorUserId: 'owner-1'
    }],
    ...overrides
  };
}

function makeHarness() {
  const createNotificationRecord = jasmine.createSpy('createNotificationRecord')
    .and.callFake(async input => ({ _id: 'notification-1', emailedAt: null, ...input }));
  const markEmailed = jasmine.createSpy('markEmailed').and.resolveTo();
  const buildEmail = jasmine.createSpy('buildEmail').and.resolveTo({
    subject: 'Quest notification', html: '<p>Quest notification</p>'
  });
  const sendEmailFn = jasmine.createSpy('sendEmailFn').and.resolveTo();
  const service = buildQuestNotificationService({
    QuestModel: modelById([{
      _id: 'quest-1',
      slug: 'virtual-road-trip',
      administratorUserId: 'admin-1',
      name_i18n: { en: 'Virtual road trip' }
    }]),
    QuestItemModel: modelById([{ _id: 'item-1', label: 'Tioga, PA' }]),
    BlockModel: modelById([{
      _id: 'block-1', roomId: 'united-states', title: 'Tioga, PA'
    }]),
    UserModel: modelById([{
      _id: 'owner-1', username: 'Owner', email: 'owner@example.com'
    }, {
      _id: 'admin-1', username: 'Admin', email: 'admin@example.com'
    }]),
    createNotificationRecord,
    markEmailed,
    buildEmail,
    sendEmailFn
  });
  return { service, createNotificationRecord, markEmailed, buildEmail, sendEmailFn };
}

describe('quest notification service', () => {
  it('notifies the administrator about review requests with a stable event key', async () => {
    const harness = makeHarness();
    await harness.service.notifyQuestEvent({
      type: QUEST_NOTIFICATION_EVENTS.REVIEW_REQUESTED,
      submission: submission()
    });

    expect(harness.createNotificationRecord).toHaveBeenCalledWith(jasmine.objectContaining({
      userId: 'admin-1',
      actorUserId: 'owner-1',
      questId: 'quest-1',
      questSubmissionId: 'submission-1',
      dedupeKey: 'quest:quest_review_requested:admin-1:submission-1:event-1'
    }));
    expect(harness.sendEmailFn).toHaveBeenCalledWith(jasmine.objectContaining({
      to: 'admin@example.com'
    }));
    expect(harness.buildEmail).toHaveBeenCalledWith(jasmine.objectContaining({
      targetUrl: 'http://localhost:3000/en/quests/review?questId=quest-1&submission=submission-1' +
        '#quest-review-submission-submission-1'
    }));
    expect(harness.markEmailed).toHaveBeenCalledWith('notification-1');
  });

  it('notifies the owner for decisions and supports system actors', async () => {
    const harness = makeHarness();
    await harness.service.notifyQuestEvent({
      type: QUEST_NOTIFICATION_EVENTS.REVOKED,
      submission: submission({
        status: 'revoked',
        reviewHistory: [{
          _id: 'event-2', type: 'revoked', actorType: 'system', actorUserId: null
        }]
      })
    });

    expect(harness.createNotificationRecord).toHaveBeenCalledWith(jasmine.objectContaining({
      userId: 'owner-1',
      actorUserId: null,
      type: 'quest_submission_revoked'
    }));
    expect(harness.buildEmail).toHaveBeenCalledWith(jasmine.objectContaining({
      targetUrl: 'http://localhost:3000/en/quests/virtual-road-trip?submission=submission-1' +
        '#quest-submission-submission-1'
    }));
  });

  it('creates item-only claim expiry notifications with deterministic tokens', async () => {
    const harness = makeHarness();
    await harness.service.notifyQuestEvent({
      type: QUEST_NOTIFICATION_EVENTS.CLAIM_EXPIRED,
      expiry: {
        questId: 'quest-1',
        itemId: 'item-1',
        ownerUserId: 'owner-1',
        eventToken: 'expired-2026-07-03T12:00:00.000Z'
      }
    });

    expect(harness.createNotificationRecord).toHaveBeenCalledWith(jasmine.objectContaining({
      questSubmissionId: null,
      questItemId: 'item-1',
      dedupeKey: jasmine.stringContaining('expired-2026-07-03T12:00:00.000Z')
    }));
  });

  it('does not resend email for an already emailed idempotent record', async () => {
    const harness = makeHarness();
    harness.createNotificationRecord.and.resolveTo({
      _id: 'notification-1', emailedAt: new Date()
    });
    await harness.service.notifyQuestEvent({
      type: QUEST_NOTIFICATION_EVENTS.APPROVED,
      submission: submission({ status: 'approved' })
    });
    expect(harness.sendEmailFn).not.toHaveBeenCalled();
  });
});

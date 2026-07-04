import Notification from '../server/db/models/Notification.js';

describe('notification schema', () => {
  it('continues to validate existing comment notifications', async () => {
    const notification = new Notification({
      userId: 'user-1',
      type: 'block_comment',
      actorUserId: 'user-2',
      blockId: 'block-1',
      commentId: 'comment-1'
    });
    await expectAsync(notification.validate()).toBeResolved();
  });

  it('allows system-authored quest expiry notifications with item references', async () => {
    const notification = new Notification({
      userId: 'user-1',
      type: 'quest_claim_expired',
      questId: 'quest-1',
      questItemId: 'item-1',
      dedupeKey: 'quest:expiry:user-1:item-1:event-1'
    });
    await expectAsync(notification.validate()).toBeResolved();
    expect(notification.actorUserId).toBeNull();
    expect(notification.blockId).toBeNull();
  });

  it('requires quest workflow references and stable dedupe keys', async () => {
    const notification = new Notification({
      userId: 'user-1',
      type: 'quest_submission_approved',
      questId: 'quest-1'
    });
    await expectAsync(notification.validate()).toBeRejectedWithError(/validation failed/i);
    expect(notification.errors.questSubmissionId).toBeDefined();
    expect(notification.errors.dedupeKey).toBeDefined();
  });

  it('declares a partial unique quest event index without indexing null comment records', () => {
    const index = Notification.schema.indexes().find(([, options]) =>
      options.name === 'unique_quest_notification_event'
    );
    expect(index?.[1]).toEqual(jasmine.objectContaining({
      unique: true,
      partialFilterExpression: { dedupeKey: { $type: 'string' } }
    }));
  });
});

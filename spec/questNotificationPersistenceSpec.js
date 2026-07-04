import Notification from '../server/db/models/Notification.js';
import { createQuestNotification } from '../server/db/notificationService.js';

function queryResult(result) {
  return { lean: () => Promise.resolve(result) };
}

function input() {
  return {
    userId: 'user-1',
    type: 'quest_submission_approved',
    actorUserId: 'admin-1',
    blockId: 'block-1',
    questId: 'quest-1',
    questSubmissionId: 'submission-1',
    dedupeKey: 'quest:approved:user-1:submission-1:event-1'
  };
}

describe('quest notification persistence', () => {
  it('returns an existing event without inserting a duplicate', async () => {
    const existing = { _id: 'notification-1', ...input() };
    spyOn(Notification, 'findOne').and.returnValue(queryResult(existing));
    spyOn(Notification, 'create');

    await expectAsync(createQuestNotification(input())).toBeResolvedTo(existing);
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it('recovers the winning record when concurrent insertion hits the unique index', async () => {
    const existing = { _id: 'notification-1', ...input() };
    spyOn(Notification, 'findOne').and.returnValues(queryResult(null), queryResult(existing));
    const duplicateError = Object.assign(new Error('duplicate'), { code: 11000 });
    spyOn(Notification, 'create').and.rejectWith(duplicateError);

    await expectAsync(createQuestNotification(input())).toBeResolvedTo(existing);
    expect(Notification.findOne).toHaveBeenCalledTimes(2);
  });
});

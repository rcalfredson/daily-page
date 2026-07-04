import { serializeNotifications } from '../server/api/v1/notifications.js';
import Block from '../server/db/models/Block.js';
import Quest from '../server/db/models/Quest.js';
import QuestItem from '../server/db/models/QuestItem.js';
import User from '../server/db/models/User.js';

function queryResult(result) {
  return {
    select() { return this; },
    lean() { return Promise.resolve(result); }
  };
}

function translator(key, params = {}) {
  const values = {
    'notifications.inSite.fallbackActor': 'Someone',
    'notifications.inSite.fallbackBlockTitle': 'your post',
    'notifications.inSite.fallbackQuestName': 'the quest',
    'notifications.inSite.fallbackItemLabel': 'your item',
    'notifications.inSite.item.unknown': 'Notification',
    'notifications.inSite.item.questReviewRequested':
      '{actorUsername} submitted {blockTitle} for {questName}.',
    'notifications.inSite.item.questClaimExpired':
      'Your reservation for {itemLabel} in {questName} expired.'
  };
  return (values[key] || key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}

describe('quest notification serialization', () => {
  it('renders quest messages and workflow destinations for the notification menu', async () => {
    const actorId = '507f1f77bcf86cd799439011';
    const blockId = '507f1f77bcf86cd799439012';
    const questId = '507f1f77bcf86cd799439013';
    const itemId = '507f1f77bcf86cd799439014';
    spyOn(User, 'find').and.returnValue(queryResult([{ _id: actorId, username: 'Alice' }]));
    spyOn(Block, 'find').and.returnValue(queryResult([{
      _id: blockId, roomId: 'united-states', title: 'Tioga, PA'
    }]));
    spyOn(Quest, 'find').and.returnValue(queryResult([{
      _id: questId,
      slug: 'virtual-road-trip',
      name_i18n: { en: 'Virtual road trip' }
    }]));
    spyOn(QuestItem, 'find').and.returnValue(queryResult([{
      _id: itemId, label: 'Tioga County, PA'
    }]));

    const serialized = await serializeNotifications([{
      _id: 'notification-1',
      type: 'quest_review_requested',
      actorUserId: actorId,
      blockId,
      questId,
      questSubmissionId: 'submission-1',
      questItemId: itemId,
      createdAt: new Date('2026-07-03T12:00:00.000Z')
    }, {
      _id: 'notification-2',
      type: 'quest_claim_expired',
      actorUserId: null,
      blockId: null,
      questId,
      questSubmissionId: null,
      questItemId: itemId
    }], { t: translator, uiLang: 'en' });

    expect(serialized[0].message).toBe('Alice submitted Tioga, PA for Virtual road trip.');
    expect(serialized[0].path)
      .toBe(`/quests/review?questId=${questId}&submission=submission-1` +
        '#quest-review-submission-submission-1');
    expect(serialized[1].message)
      .toBe('Your reservation for Tioga County, PA in Virtual road trip expired.');
    expect(serialized[1].path)
      .toBe(`/quests/virtual-road-trip?view=items#quest-item-${itemId}`);
  });
});

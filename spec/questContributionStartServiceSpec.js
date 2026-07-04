import { buildQuestContributionStartService } from '../server/db/questService.js';
import { QUEST_ERROR_CODES } from '../server/db/questErrors.js';

function query(value) {
  return { lean: () => Promise.resolve(value) };
}

function harness({ quest = {}, item = {}, userExists = true } = {}) {
  const questDoc = {
    _id: 'quest-1',
    slug: 'road-trip',
    type: 'set',
    status: 'active',
    name_i18n: { en: 'Road trip' },
    description_i18n: { en: 'Visit places.' },
    instructions_i18n: { en: 'Write a post.' },
    defaultRoomId: 'united-states',
    ...quest
  };
  const itemDoc = {
    _id: 'item-1',
    questId: 'quest-1',
    key: 'tioga-pa',
    label: 'Tioga, PA',
    active: true,
    reservedByUserId: 'user-1',
    reservedUntil: new Date('2030-01-02T00:00:00Z'),
    activeSubmissionId: null,
    approvedSubmissionId: null,
    ...item
  };
  const QuestModel = { findById: jasmine.createSpy('findById').and.returnValue(query(questDoc)) };
  const QuestItemModel = { findOne: jasmine.createSpy('findOne').and.returnValue(query(itemDoc)) };
  const UserModel = { exists: jasmine.createSpy('exists').and.resolveTo(userExists) };
  return {
    service: buildQuestContributionStartService({ QuestModel, QuestItemModel, UserModel }),
    QuestItemModel
  };
}

async function expectCode(promise, code) {
  try {
    await promise;
    fail(`Expected ${code}`);
  } catch (error) {
    expect(error.code).toBe(code);
  }
}

describe('quest contribution start service', () => {
  const now = new Date('2030-01-01T00:00:00Z');

  it('returns server-owned room, title, quest, and claimed item context', async () => {
    const { service } = harness();
    const context = await service({ questId: 'quest-1', itemId: 'item-1', userId: 'user-1', now });
    expect(context.roomId).toBe('united-states');
    expect(context.suggestedTitle).toBe('Tioga, PA');
    expect(context.quest.displayName).toBe('Road trip');
    expect(context.item.id).toBe('item-1');
  });

  it('rejects another user’s, expired, or already attached reservation', async () => {
    const anotherUser = harness();
    await expectCode(anotherUser.service({
      questId: 'quest-1', itemId: 'item-1', userId: 'user-2', now
    }), QUEST_ERROR_CODES.ITEM_UNAVAILABLE);

    const expired = harness({ item: { reservedUntil: new Date('2029-12-31T00:00:00Z') } });
    await expectCode(expired.service({
      questId: 'quest-1', itemId: 'item-1', userId: 'user-1', now
    }), QUEST_ERROR_CODES.ITEM_UNAVAILABLE);

    const attached = harness({ item: { activeSubmissionId: 'submission-1' } });
    await expectCode(attached.service({
      questId: 'quest-1', itemId: 'item-1', userId: 'user-1', now
    }), QUEST_ERROR_CODES.ITEM_UNAVAILABLE);
  });

  it('supports count quests without an item and rejects forged item context', async () => {
    const { service, QuestItemModel } = harness({ quest: { type: 'count', targetCount: 10 } });
    const context = await service({ questId: 'quest-1', userId: 'user-1', now });
    expect(context.item).toBeNull();
    expect(QuestItemModel.findOne).not.toHaveBeenCalled();
    await expectCode(service({
      questId: 'quest-1', itemId: 'item-1', userId: 'user-1', now
    }), QUEST_ERROR_CODES.TYPE_MISMATCH);
  });

  it('rejects anonymous or unregistered owners', async () => {
    const { service } = harness({ userExists: false });
    await expectCode(service({
      questId: 'quest-1', itemId: 'item-1', userId: '', now
    }), QUEST_ERROR_CODES.FORBIDDEN);
  });
});

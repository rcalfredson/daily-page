import Block from '../server/db/models/Block.js';
import Quest from '../server/db/models/Quest.js';
import QuestItem from '../server/db/models/QuestItem.js';
import QuestSubmission from '../server/db/models/QuestSubmission.js';
import {
  listApprovedQuestPosts,
  listQuestItems
} from '../server/db/questService.js';

function queryResult(result) {
  return {
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(result); }
  };
}

describe('quest read services', () => {
  it('returns localized, derived item states without exposing claimant identities', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    spyOn(Quest, 'findById').and.resolveTo({ _id: 'quest-1', type: 'set' });
    spyOn(QuestItem, 'find').and.returnValue(queryResult([{
      _id: 'item-1',
      questId: 'quest-1',
      key: 'tioga-pa',
      label: 'Tioga, PA',
      label_i18n: { es: 'Tioga, Pensilvania' },
      active: true,
      reservedByUserId: 'private-user-id',
      reservedUntil: new Date('2026-07-04T12:00:00.000Z'),
      activeSubmissionId: null,
      approvedSubmissionId: null
    }]));
    spyOn(QuestItem, 'countDocuments').and.resolveTo(1);
    spyOn(QuestSubmission, 'find').and.returnValue(queryResult([]));
    spyOn(Block, 'find').and.returnValue(queryResult([]));

    const result = await listQuestItems({
      questId: 'quest-1', uiLang: 'es', now
    });

    expect(result.items).toEqual([{
      id: 'item-1',
      key: 'tioga-pa',
      label: 'Tioga, Pensilvania',
      state: 'reserved',
      reservedUntil: new Date('2026-07-04T12:00:00.000Z'),
      post: null
    }]);
    expect(JSON.stringify(result)).not.toContain('private-user-id');
  });

  it('identifies a reservation only to its authenticated claimant', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    spyOn(Quest, 'findById').and.resolveTo({ _id: 'quest-1', type: 'set' });
    spyOn(QuestItem, 'find').and.returnValue(queryResult([{
      _id: 'item-1',
      questId: 'quest-1',
      key: 'tioga-pa',
      label: 'Tioga, PA',
      active: true,
      reservedByUserId: 'user-1',
      reservedUntil: new Date('2026-07-04T12:00:00.000Z'),
      activeSubmissionId: null,
      approvedSubmissionId: null
    }]));
    spyOn(QuestItem, 'countDocuments').and.resolveTo(1);
    spyOn(QuestSubmission, 'find').and.returnValue(queryResult([]));
    spyOn(Block, 'find').and.returnValue(queryResult([]));

    const owner = await listQuestItems({ questId: 'quest-1', userId: 'user-1', now });
    expect(owner.items[0].reservedByCurrentUser).toBeTrue();
  });

  it('filters workflow states through submission assignments and links visible posts', async () => {
    spyOn(Quest, 'findById').and.resolveTo({ _id: 'quest-1', type: 'set' });
    spyOn(QuestSubmission, 'find').and.callFake(filter => {
      if (filter.status === 'pending') {
        return queryResult([{ _id: 'submission-1' }]);
      }
      return queryResult([{
        _id: 'submission-1',
        status: 'pending',
        blockId: 'block-1'
      }]);
    });
    spyOn(QuestItem, 'find').and.callFake(filter => {
      expect(filter.activeSubmissionId).toEqual({ $in: ['submission-1'] });
      return queryResult([{
        _id: 'item-1',
        key: 'tioga-pa',
        label: 'Tioga, PA',
        active: true,
        activeSubmissionId: 'submission-1',
        approvedSubmissionId: null
      }]);
    });
    spyOn(QuestItem, 'countDocuments').and.resolveTo(1);
    spyOn(Block, 'find').and.callFake(filter => {
      expect(filter.$and?.[1]?.$or).toEqual([
        { visibility: 'public' },
        { visibility: 'unlisted', status: 'locked' }
      ]);
      return queryResult([{
        _id: 'block-1', title: 'Tioga, PA', roomId: 'united-states',
        lang: 'en', creator: 'Alice'
      }]);
    });

    const result = await listQuestItems({ questId: 'quest-1', state: 'pending' });
    expect(result.items[0].state).toBe('pending');
    expect(result.items[0].post).toEqual(jasmine.objectContaining({
      id: 'block-1', roomId: 'united-states'
    }));
  });

  it('returns approved qualifying posts in approval order with contributor counts', async () => {
    spyOn(Quest, 'findById').and.resolveTo({ _id: 'quest-1', type: 'count' });
    spyOn(QuestSubmission, 'find').and.returnValue(queryResult([{
      _id: 'submission-1',
      blockId: 'block-1',
      approvedAt: new Date('2026-07-03T12:00:00.000Z'),
      approvedSequence: 4,
      contributorUserIds: ['user-1', 'user-2']
    }]));
    spyOn(QuestSubmission, 'countDocuments').and.resolveTo(1);
    spyOn(Block, 'find').and.returnValue(queryResult([{
      _id: 'block-1',
      title: 'Tioga, PA',
      roomId: 'united-states',
      lang: 'en',
      creator: 'Alice'
    }]));

    const result = await listApprovedQuestPosts({ questId: 'quest-1' });
    expect(result.posts).toEqual([jasmine.objectContaining({
      _id: 'block-1',
      approvedSequence: 4,
      contributorCount: 2
    })]);
    expect(result.total).toBe(1);
  });
});

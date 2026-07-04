import { buildQuestSubmissionReadService } from '../server/db/questSubmissionReadService.js';
import { QUEST_ERROR_CODES, QuestDomainError } from '../server/db/questErrors.js';

function queryResult(result) {
  return {
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(result); }
  };
}

function model(documents) {
  return {
    findById: jasmine.createSpy('findById').and.callFake(id =>
      queryResult(documents.find(document => String(document._id) === String(id)) || null)
    ),
    find: jasmine.createSpy('find').and.callFake(filter => {
      let rows = documents;
      if (filter?._id?.$in) {
        rows = rows.filter(document => filter._id.$in.includes(String(document._id)));
      }
      if (filter?.administratorUserId) {
        rows = rows.filter(document => document.administratorUserId === filter.administratorUserId);
      }
      return queryResult(rows);
    }),
    countDocuments: jasmine.createSpy('countDocuments').and.resolveTo(documents.length),
    exists: jasmine.createSpy('exists').and.callFake(async filter =>
      documents.some(document => String(document._id) === String(filter._id))
    )
  };
}

function makeHarness() {
  const quests = model([{
    _id: 'quest-1',
    slug: 'road-trip',
    administratorUserId: 'admin-1',
    name_i18n: { en: 'Road trip' }
  }]);
  const items = model([{ _id: 'item-1', key: 'tioga-pa', label: 'Tioga, PA' }]);
  const blocks = model([{
    _id: 'block-1', groupId: 'group-1', roomId: 'united-states',
    title: 'Tioga, PA', lang: 'en', status: 'locked', visibility: 'public'
  }]);
  const users = model([{
    _id: 'owner-1', username: 'Owner', profilePic: '/owner.png'
  }]);
  const submissions = model([{
    _id: 'submission-1',
    questId: 'quest-1',
    questItemId: 'item-1',
    ownerUserId: 'owner-1',
    blockId: 'block-1',
    status: 'pending',
    contributorUserIds: [],
    reviewHistory: [{
      _id: 'event-1', type: 'review-requested', actorType: 'user',
      actorUserId: 'owner-1', fromStatus: 'draft', toStatus: 'pending'
    }]
  }]);
  const service = buildQuestSubmissionReadService({
    QuestModel: quests,
    QuestItemModel: items,
    QuestSubmissionModel: submissions,
    BlockModel: blocks,
    UserModel: users
  });
  return { service, quests, submissions };
}

async function expectCode(promise, code) {
  try {
    await promise;
    fail(`Expected ${code}`);
  } catch (error) {
    expect(error).toEqual(jasmine.any(QuestDomainError));
    expect(error.code).toBe(code);
  }
}

describe('quest submission read service', () => {
  it('allows owners and administrators to inspect review history', async () => {
    const { service } = makeHarness();
    const ownerView = await service.getQuestSubmissionForUser({
      submissionId: 'submission-1', userId: 'owner-1'
    });
    const adminView = await service.getQuestSubmissionForUser({
      submissionId: 'submission-1', userId: 'admin-1'
    });

    expect(ownerView.reviewHistory[0]).toEqual(jasmine.objectContaining({
      type: 'review-requested', actorUserId: 'owner-1'
    }));
    expect(adminView.quest.name).toBe('Road trip');
    expect(adminView.item.label).toBe('Tioga, PA');
  });

  it('does not disclose submissions to unrelated users', async () => {
    const { service } = makeHarness();
    await expectCode(service.getQuestSubmissionForUser({
      submissionId: 'submission-1', userId: 'other-user'
    }), QUEST_ERROR_CODES.FORBIDDEN);
  });

  it('scopes personal submission listings to quest and authenticated owner', async () => {
    const { service, submissions } = makeHarness();
    const result = await service.listUserQuestSubmissions({
      questId: 'quest-1', userId: 'owner-1', status: 'pending'
    });
    const filter = submissions.find.calls.mostRecent().args[0];
    expect(filter).toEqual({
      questId: 'quest-1', ownerUserId: 'owner-1', status: 'pending'
    });
    expect(result.submissions[0].block.title).toBe('Tioga, PA');
  });

  it('supports a paginated set of displayable personal workflow states', async () => {
    const { service, submissions } = makeHarness();
    const statuses = ['draft', 'pending', 'changes-requested', 'approved'];
    const result = await service.listUserQuestSubmissions({
      questId: 'quest-1', userId: 'owner-1', statuses, page: 2, limit: 6
    });
    expect(submissions.find.calls.mostRecent().args[0]).toEqual({
      questId: 'quest-1',
      ownerUserId: 'owner-1',
      status: { $in: statuses }
    });
    expect(result.statuses).toEqual(statuses);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(6);
  });

  it('rejects a quest-specific review queue for a non-administrator', async () => {
    const { service } = makeHarness();
    await expectCode(service.listAdministratorReviewQueue({
      administratorUserId: 'other-user', questId: 'quest-1'
    }), QUEST_ERROR_CODES.FORBIDDEN);
  });

  it('returns oldest pending work for an authorized administrator', async () => {
    const { service, submissions } = makeHarness();
    const result = await service.listAdministratorReviewQueue({
      administratorUserId: 'admin-1', questId: 'quest-1'
    });
    expect(submissions.find.calls.mostRecent().args[0]).toEqual({
      questId: { $in: ['quest-1'] }, status: 'pending'
    });
    expect(result.submissions[0].owner.username).toBe('Owner');
  });

  it('can focus an administrator queue read on one pending notification submission', async () => {
    const { service, submissions } = makeHarness();
    await service.listAdministratorReviewQueue({
      administratorUserId: 'admin-1',
      questId: 'quest-1',
      submissionId: 'submission-1'
    });
    expect(submissions.find.calls.mostRecent().args[0]).toEqual({
      questId: { $in: ['quest-1'] },
      status: 'pending',
      _id: 'submission-1'
    });
  });
});

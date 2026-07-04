import Quest from '../server/db/models/Quest.js';
import QuestItem from '../server/db/models/QuestItem.js';
import QuestSubmission from '../server/db/models/QuestSubmission.js';
import { getUserQuestContributions } from '../server/db/questService.js';

function queryResult(result) {
  return { lean: () => Promise.resolve(result) };
}

describe('quest achievement service', () => {
  it('derives current badge tiers and next thresholds only from approved snapshots', async () => {
    spyOn(QuestSubmission, 'aggregate').and.resolveTo([{
      _id: 'quest-1',
      contributionCount: 3,
      reachedCurrentCountAt: new Date('2026-07-03T12:00:00Z')
    }]);
    spyOn(Quest, 'find').and.returnValue(queryResult([{
      _id: 'quest-1',
      slug: 'road-trip',
      type: 'set',
      name_i18n: { en: 'Road trip' },
      medalThresholds: { bronze: 0.25, silver: 0.5, gold: 0.75 },
      badgeAssetPath: '/assets/img/quests/road-trip.svg'
    }]));
    spyOn(QuestItem, 'countDocuments').and.resolveTo(10);

    const achievements = await getUserQuestContributions({ userId: 'user-1' });
    const match = QuestSubmission.aggregate.calls.mostRecent().args[0][0].$match;
    expect(match).toEqual({ status: 'approved', contributorUserIds: 'user-1' });
    expect(achievements[0]).toEqual(jasmine.objectContaining({
      contributionCount: 3,
      targetCount: 10,
      medalTier: 'bronze',
      thresholdCounts: { bronze: 3, silver: 5, gold: 8 },
      nextTier: 'silver',
      nextTierContributionCount: 5
    }));
  });

  it('returns no achievement when revoked approvals leave no current credit', async () => {
    spyOn(QuestSubmission, 'aggregate').and.resolveTo([]);
    spyOn(Quest, 'find').and.returnValue(queryResult([]));
    const achievements = await getUserQuestContributions({ userId: 'user-1' });
    expect(achievements).toEqual([]);
  });
});

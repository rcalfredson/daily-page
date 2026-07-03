import Quest from '../server/db/models/Quest.js';
import QuestItem from '../server/db/models/QuestItem.js';
import QuestSubmission from '../server/db/models/QuestSubmission.js';

function validQuest(overrides = {}) {
  return new Quest({
    slug: 'virtual-road-trip',
    type: 'set',
    name_i18n: { en: 'Virtual road trip' },
    description_i18n: { en: 'Visit every county.' },
    instructions_i18n: { en: 'Include facts and Street View captures.' },
    administratorUserId: '507f1f77bcf86cd799439011',
    allowedRoomIds: ['united-states'],
    defaultRoomId: 'united-states',
    badgeAssetPath: '/assets/img/quests/virtual-road-trip.svg',
    ...overrides
  });
}

describe('quest schemas', () => {
  it('accepts a valid set quest and applies contract defaults', async () => {
    const quest = validQuest();
    await expectAsync(quest.validate()).toBeResolved();
    expect(quest.reservationDurationHours).toBe(168);
    expect(quest.medalThresholds.toObject()).toEqual({ bronze: 0.25, silver: 0.5, gold: 0.75 });
  });

  it('requires count targets and forbids set targets', async () => {
    const countQuest = validQuest({ type: 'count', targetCount: undefined });
    await expectAsync(countQuest.validate()).toBeRejectedWithError(/require a positive integer targetCount/);

    const setQuest = validQuest({ targetCount: 3245 });
    await expectAsync(setQuest.validate()).toBeRejectedWithError(/derive their target/);
  });

  it('requires English content and a default room from the allowed list', async () => {
    const quest = validQuest({
      name_i18n: { es: 'Viaje virtual' },
      defaultRoomId: 'history'
    });
    await expectAsync(quest.validate()).toBeRejectedWithError(/validation failed/i);
    expect(quest.errors.name_i18n.message).toContain('English');
    expect(quest.errors.defaultRoomId.message).toContain('allowedRoomIds');
  });

  it('restricts badge paths and enforces ascending medal thresholds', async () => {
    const quest = validQuest({
      badgeAssetPath: 'https://example.com/badge.svg',
      medalThresholds: { bronze: 0.5, silver: 0.25, gold: 0.75 }
    });
    await expectAsync(quest.validate()).toBeRejectedWithError(/validation failed/i);
    expect(quest.errors.badgeAssetPath).toBeDefined();
    expect(quest.errors.medalThresholds).toBeDefined();
  });

  it('requires coherent item reservation and approval pointers', async () => {
    const incompleteClaim = new QuestItem({
      questId: 'quest-1', key: 'tioga-pa', label: 'Tioga, PA', reservedByUserId: 'user-1'
    });
    await expectAsync(incompleteClaim.validate()).toBeRejectedWithError(/reservation/i);

    const mismatchedApproval = new QuestItem({
      questId: 'quest-1',
      key: 'centre-pa',
      label: 'Centre, PA',
      activeSubmissionId: 'submission-1',
      approvedSubmissionId: 'submission-2'
    });
    await expectAsync(mismatchedApproval.validate()).toBeRejectedWithError(/active item submission/i);
  });

  it('requires approval metadata and deduplicated contributor snapshots', async () => {
    const submission = new QuestSubmission({
      questId: 'quest-1',
      questItemId: 'item-1',
      ownerUserId: 'user-1',
      blockId: 'block-1',
      blockGroupId: 'group-1',
      status: 'approved',
      contributorUserIds: ['user-1', 'user-1']
    });
    await expectAsync(submission.validate()).toBeRejectedWithError(/validation failed/i);
    expect(submission.errors.status).toBeDefined();
    expect(submission.errors.contributorUserIds).toBeDefined();
  });

  it('validates review history actor identity', async () => {
    const submission = new QuestSubmission({
      questId: 'quest-1',
      ownerUserId: 'user-1',
      blockId: 'block-1',
      blockGroupId: 'group-1',
      reviewHistory: [{
        type: 'submitted',
        actorType: 'user',
        toStatus: 'pending'
      }]
    });
    await expectAsync(submission.validate()).toBeRejectedWithError(/actorUserId/);
  });
});

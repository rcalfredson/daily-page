import {
  compareQuestLeaderboardEntries,
  deriveQuestItemState,
  getQuestMedalTier,
  getQuestProgressSummary,
  isQuestBlockEligible,
  questAcceptsNewWork,
  resolveQuestItemLabel,
  resolveQuestLocalizedField,
  toQuestI18nDTO
} from '../server/db/questDomain.js';

describe('quest domain helpers', () => {
  it('resolves localized quest fields using requested, English, and first-value fallback', () => {
    const quest = {
      name_i18n: new Map([['en', 'Road trip'], ['es', 'Viaje por carretera']]),
      description_i18n: { en: 'Explore the country' },
      instructions_i18n: { fr: 'Écrivez quelque chose' }
    };

    expect(resolveQuestLocalizedField(quest, 'name', 'es')).toBe('Viaje por carretera');
    expect(resolveQuestLocalizedField(quest, 'name', 'de')).toBe('Road trip');
    expect(resolveQuestLocalizedField(quest, 'instructions', 'de')).toBe('Écrivez quelque chose');
    expect(toQuestI18nDTO(quest, 'es').displayDescription).toBe('Explore the country');
  });

  it('localizes item labels while retaining their source label fallback', () => {
    expect(resolveQuestItemLabel({
      label: 'Tioga, PA',
      label_i18n: { es: 'Tioga, Pensilvania' }
    }, 'es')).toBe('Tioga, Pensilvania');
    expect(resolveQuestItemLabel({ label: 'Tioga, PA' }, 'fr')).toBe('Tioga, PA');
  });

  it('accepts new work according to quest lifecycle configuration', () => {
    expect(questAcceptsNewWork({ status: 'active' })).toBeTrue();
    expect(questAcceptsNewWork({
      status: 'completed',
      acceptingSubmissionsAfterCompletion: true
    })).toBeTrue();
    expect(questAcceptsNewWork({
      status: 'completed',
      acceptingSubmissionsAfterCompletion: false
    })).toBeFalse();
    expect(questAcceptsNewWork({ status: 'archived' })).toBeFalse();
  });

  it('uses the site public-visibility rule for qualifying blocks', () => {
    const quest = { allowedRoomIds: ['united-states'] };

    expect(isQuestBlockEligible(quest, {
      roomId: 'united-states', visibility: 'public', status: 'locked'
    })).toBeTrue();
    expect(isQuestBlockEligible(quest, {
      roomId: 'united-states', visibility: 'unlisted', status: 'locked'
    })).toBeTrue();
    expect(isQuestBlockEligible(quest, {
      roomId: 'united-states', visibility: 'unlisted', status: 'in-progress'
    })).toBeFalse();
    expect(isQuestBlockEligible(quest, {
      roomId: 'history', visibility: 'public', status: 'locked'
    })).toBeFalse();
  });

  it('computes count and set progress without displaying more than 100 percent', () => {
    expect(getQuestProgressSummary({
      quest: { type: 'count', targetCount: 10 },
      approvedCount: 12
    })).toEqual({
      completedCount: 12,
      targetCount: 10,
      ratio: 1.2,
      displayRatio: 1,
      isComplete: true
    });

    expect(getQuestProgressSummary({
      quest: { type: 'set' },
      approvedCount: 2,
      activeItemCount: 8
    }).ratio).toBe(0.25);
  });

  it('uses ceiling arithmetic for medal thresholds', () => {
    expect(getQuestMedalTier({ contributionCount: 0, targetCount: 10 })).toBeNull();
    expect(getQuestMedalTier({ contributionCount: 2, targetCount: 10 })).toBe('base');
    expect(getQuestMedalTier({ contributionCount: 3, targetCount: 10 })).toBe('bronze');
    expect(getQuestMedalTier({ contributionCount: 5, targetCount: 10 })).toBe('silver');
    expect(getQuestMedalTier({ contributionCount: 8, targetCount: 10 })).toBe('gold');
  });

  it('derives item state with approval and submission state taking precedence', () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    expect(deriveQuestItemState({
      item: { active: true, approvedSubmissionId: 'submission-1' }, now
    })).toBe('completed');
    expect(deriveQuestItemState({
      item: { active: true }, submission: { status: 'changes-requested' }, now
    })).toBe('changes-requested');
    expect(deriveQuestItemState({
      item: {
        active: true,
        reservedByUserId: 'user-1',
        reservedUntil: '2026-07-04T12:00:00.000Z'
      },
      now
    })).toBe('reserved');
    expect(deriveQuestItemState({ item: { active: true }, now })).toBe('available');
  });

  it('orders leaderboard ties by achievement time, sequence, and username', () => {
    const entries = [
      {
        username: 'Zoe', contributionCount: 3,
        reachedCurrentCountAt: '2026-07-02T12:00:00.000Z', reachedCurrentCountSequence: 3
      },
      {
        username: 'Amy', contributionCount: 4,
        reachedCurrentCountAt: '2026-07-03T12:00:00.000Z', reachedCurrentCountSequence: 4
      },
      {
        username: 'Bea', contributionCount: 3,
        reachedCurrentCountAt: '2026-07-01T12:00:00.000Z', reachedCurrentCountSequence: 2
      }
    ];

    expect(entries.sort(compareQuestLeaderboardEntries).map(entry => entry.username))
      .toEqual(['Amy', 'Bea', 'Zoe']);
  });
});

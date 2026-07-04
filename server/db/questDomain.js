import { isPubliclyVisibleBlock } from './blockService.js';

export const DEFAULT_QUEST_MEDAL_THRESHOLDS = Object.freeze({
  bronze: 0.25,
  silver: 0.5,
  gold: 0.75
});

function entriesOf(map) {
  if (!map) return [];
  if (typeof map.entries === 'function') return Array.from(map.entries());
  return Object.entries(map);
}

export function resolveQuestLocalizedField(quest, field, uiLang = 'en') {
  const values = quest?.[`${field}_i18n`];
  const entries = entriesOf(values);
  const byLanguage = new Map(entries);

  return byLanguage.get(uiLang) ||
    byLanguage.get('en') ||
    entries.find(([, value]) => String(value || '').trim())?.[1] ||
    quest?.[field] ||
    '';
}

export function toQuestI18nDTO(quest, uiLang = 'en') {
  const source = typeof quest?.toObject === 'function' ? quest.toObject() : quest;
  return {
    ...source,
    displayName: resolveQuestLocalizedField(source, 'name', uiLang),
    displayDescription: resolveQuestLocalizedField(source, 'description', uiLang),
    displayInstructions: resolveQuestLocalizedField(source, 'instructions', uiLang)
  };
}

export function resolveQuestItemLabel(item, uiLang = 'en') {
  const entries = entriesOf(item?.label_i18n);
  const byLanguage = new Map(entries);
  return byLanguage.get(uiLang) ||
    byLanguage.get('en') ||
    entries.find(([, value]) => String(value || '').trim())?.[1] ||
    item?.label ||
    '';
}

export function questAcceptsNewWork(quest) {
  return quest?.status === 'active' || (
    quest?.status === 'completed' && quest?.acceptingSubmissionsAfterCompletion === true
  );
}

export function questAcceptsReviewActions(quest) {
  return quest?.status === 'active' || quest?.status === 'completed';
}

export function isQuestBlockEligible(quest, block) {
  return Boolean(
    quest &&
    block &&
    block.status === 'locked' &&
    quest.allowedRoomIds?.includes(block.roomId) &&
    isPubliclyVisibleBlock(block)
  );
}

export function getQuestTargetCount(quest, activeItemCount = null) {
  if (quest?.type === 'count') return Number(quest.targetCount) || 0;
  if (quest?.type === 'set') return Math.max(0, Number(activeItemCount) || 0);
  return 0;
}

export function getQuestProgressSummary({ quest, approvedCount, activeItemCount = null }) {
  const targetCount = getQuestTargetCount(quest, activeItemCount);
  const completedCount = Math.max(0, Number(approvedCount) || 0);
  const ratio = targetCount > 0 ? completedCount / targetCount : 0;

  return {
    completedCount,
    targetCount,
    ratio,
    displayRatio: Math.min(1, ratio),
    isComplete: targetCount > 0 && completedCount >= targetCount
  };
}

export function getQuestMedalTier({
  contributionCount,
  targetCount,
  thresholds = DEFAULT_QUEST_MEDAL_THRESHOLDS
}) {
  const contributions = Math.max(0, Number(contributionCount) || 0);
  const target = Math.max(0, Number(targetCount) || 0);
  if (!contributions || !target) return null;

  if (contributions >= Math.ceil(target * thresholds.gold)) return 'gold';
  if (contributions >= Math.ceil(target * thresholds.silver)) return 'silver';
  if (contributions >= Math.ceil(target * thresholds.bronze)) return 'bronze';
  return 'base';
}

export function deriveQuestItemState({ item, submission = null, now = new Date() }) {
  if (!item?.active) return 'inactive';
  if (item.approvedSubmissionId) return 'completed';
  if (submission?.status === 'pending') return 'pending';
  if (submission?.status === 'changes-requested') return 'changes-requested';
  if (submission?.status === 'draft') return 'draft';
  if (item.reservedByUserId && item.reservedUntil && new Date(item.reservedUntil) > now) {
    return 'reserved';
  }
  return 'available';
}

export function compareQuestLeaderboardEntries(left, right) {
  if (left.contributionCount !== right.contributionCount) {
    return right.contributionCount - left.contributionCount;
  }

  const leftReachedAt = new Date(left.reachedCurrentCountAt || 0).getTime();
  const rightReachedAt = new Date(right.reachedCurrentCountAt || 0).getTime();
  if (leftReachedAt !== rightReachedAt) return leftReachedAt - rightReachedAt;

  const leftSequence = Number(left.reachedCurrentCountSequence) || 0;
  const rightSequence = Number(right.reachedCurrentCountSequence) || 0;
  if (leftSequence !== rightSequence) return leftSequence - rightSequence;

  return String(left.username || '').localeCompare(String(right.username || ''), 'en', {
    sensitivity: 'base'
  });
}

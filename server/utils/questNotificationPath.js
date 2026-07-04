const REVIEW_REQUESTED = 'quest_review_requested';

function encoded(value) {
  return encodeURIComponent(String(value || ''));
}

export function questSubmissionAnchor(submissionId) {
  return `quest-submission-${encoded(submissionId)}`;
}

export function questReviewSubmissionAnchor(submissionId) {
  return `quest-review-submission-${encoded(submissionId)}`;
}

export function questItemAnchor(itemId) {
  return `quest-item-${encoded(itemId)}`;
}

export function buildQuestNotificationPath({
  type,
  questId,
  questSlug,
  submissionId = null,
  itemId = null
}) {
  if (type === REVIEW_REQUESTED && questId && submissionId) {
    return `/quests/review?questId=${encoded(questId)}&submission=${encoded(submissionId)}` +
      `#${questReviewSubmissionAnchor(submissionId)}`;
  }
  if (questSlug && submissionId) {
    return `/quests/${encoded(questSlug)}?submission=${encoded(submissionId)}` +
      `#${questSubmissionAnchor(submissionId)}`;
  }
  if (questSlug && itemId) {
    return `/quests/${encoded(questSlug)}?view=items#${questItemAnchor(itemId)}`;
  }
  return questSlug ? `/quests/${encoded(questSlug)}` : '/quests';
}

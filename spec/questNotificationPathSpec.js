import { buildQuestNotificationPath } from '../server/utils/questNotificationPath.js';

describe('quest notification paths', () => {
  it('sends review requests to the real private review route and exact submission', () => {
    expect(buildQuestNotificationPath({
      type: 'quest_review_requested',
      questId: 'quest-1',
      questSlug: 'road-trip',
      submissionId: 'submission-1'
    })).toBe(
      '/quests/review?questId=quest-1&submission=submission-1' +
      '#quest-review-submission-submission-1'
    );
  });

  it('sends every owner submission event to its review context on the quest page', () => {
    for (const type of [
      'quest_changes_requested',
      'quest_submission_approved',
      'quest_submission_rejected',
      'quest_submission_revoked'
    ]) {
      expect(buildQuestNotificationPath({
        type,
        questId: 'quest-1',
        questSlug: 'road trip',
        submissionId: 'submission/1'
      })).toBe(
        '/quests/road%20trip?submission=submission%2F1#quest-submission-submission%2F1'
      );
    }
  });

  it('sends unattached expiry events to the exact quest item', () => {
    expect(buildQuestNotificationPath({
      type: 'quest_claim_expired',
      questSlug: 'road-trip',
      itemId: 'item-1'
    })).toBe('/quests/road-trip?view=items#quest-item-item-1');
  });
});

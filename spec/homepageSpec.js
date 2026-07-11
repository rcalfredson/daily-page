import {
  getHomeActivitySince,
  getHomeActivityVisibility,
  HOME_ACTIVITY_MINIMUM,
  HOME_ACTIVITY_WINDOW_DAYS
} from '../server/services/homepage.js';

describe('homepage activity visibility', () => {
  it('uses a seven-day activity window', () => {
    const now = new Date('2026-07-10T12:00:00.000Z');
    expect(HOME_ACTIVITY_WINDOW_DAYS).toBe(7);
    expect(getHomeActivitySince(now).toISOString()).toBe('2026-07-03T12:00:00.000Z');
  });

  it('qualifies comments and reactions independently at four records', () => {
    const comments = Array.from({ length: HOME_ACTIVITY_MINIMUM }, () => ({}));
    const reactions = Array.from({ length: HOME_ACTIVITY_MINIMUM - 1 }, () => ({}));
    expect(getHomeActivityVisibility({ comments, reactions })).toEqual({
      showRecentComments: true,
      showRecentReactions: false
    });
  });

  it('hides both feeds below the threshold', () => {
    expect(getHomeActivityVisibility()).toEqual({
      showRecentComments: false,
      showRecentReactions: false
    });
  });
});

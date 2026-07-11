export const HOME_ACTIVITY_WINDOW_DAYS = 7;
export const HOME_ACTIVITY_MINIMUM = 4;

export function getHomeActivitySince(now = new Date()) {
  return new Date(now.getTime() - (HOME_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000));
}

export function getHomeActivityVisibility({ comments = [], reactions = [] } = {}) {
  return {
    showRecentComments: comments.length >= HOME_ACTIVITY_MINIMUM,
    showRecentReactions: reactions.length >= HOME_ACTIVITY_MINIMUM
  };
}

import { markdownToPlainText } from '../utils/markdownHelper.js';
import { toBlockPreviewDTO } from '../utils/block.js';

export const HOME_ACTIVITY_WINDOW_DAYS = 7;
export const HOME_ACTIVITY_MINIMUM = 4;
export const HOME_EXACT_POST_LIMIT = 20;
export const HOME_FEED_PREVIEW_CHARS = 450;

export function toHomeFeedPreviewDTO(block, { userId = null } = {}) {
  return toBlockPreviewDTO(block, {
    userId,
    previewChars: HOME_FEED_PREVIEW_CHARS
  });
}

export function getHomeTopBlocksOptions(preferredLang, fallbackLimit = 0) {
  return {
    lockedOnly: false,
    limit: HOME_EXACT_POST_LIMIT + fallbackLimit,
    preferredLang,
    includePinnedHome: true
  };
}

export function getHomeTrendingTagsOptions(preferredLang) {
  return { limit: 10, sortBy: 'totalBlocks', preferredLang };
}

export function getHomeActivitySince(now = new Date()) {
  return new Date(now.getTime() - (HOME_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000));
}

export function getHomeActivityVisibility({ comments = [], reactions = [] } = {}) {
  return {
    showRecentComments: comments.length >= HOME_ACTIVITY_MINIMUM,
    showRecentReactions: reactions.length >= HOME_ACTIVITY_MINIMUM
  };
}

export function partitionHomePostsByLocale(blocks, {
  exactLimit = 20,
  fallbackLimit = 6
} = {}) {
  const exact = [];
  const sourceFallbacks = [];
  const seenGroups = new Set();

  for (const block of blocks || []) {
    const familyKey = String(block?.groupId || block?._id || '');
    if (!familyKey || seenGroups.has(familyKey)) continue;
    seenGroups.add(familyKey);
    if (block.selection?.isSourceFallback) sourceFallbacks.push(block);
    else exact.push(block);
  }

  return {
    exact: exact.slice(0, exactLimit),
    sourceFallbacks: sourceFallbacks.slice(0, fallbackLimit)
  };
}

function compactDiscoveryDescription(value, limit = 220) {
  const text = markdownToPlainText(value).replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const shortened = text.slice(0, limit + 1);
  const wordBoundary = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, wordBoundary > limit * 0.65 ? wordBoundary : limit).trim()}…`;
}

export function toHomeDiscoveryCards(posts, roomsById = {}) {
  return (posts || []).map(post => {
    const room = roomsById[String(post.roomId)] || {};
    const bannerImage = post.bannerImage?.url && post.bannerImage?.kind !== 'streetview'
      ? post.bannerImage
      : null;

    return {
      id: String(post._id),
      groupId: String(post.groupId || post._id),
      roomId: post.roomId,
      roomName: room.displayName || room.name || post.roomId,
      title: post.title,
      description: compactDiscoveryDescription(post.description),
      lang: post.lang || 'en',
      bannerImage
    };
  });
}

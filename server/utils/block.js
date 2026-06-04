import { renderMarkdownPreview } from "./markdownHelper.js"
import { titleOnlyMeta } from './unfinished.js';

function idsMatch(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

export function parseEditTokens(rawTokens) {
  if (!rawTokens) return [];

  try {
    const tokens = JSON.parse(rawTokens);
    return Array.isArray(tokens) ? tokens : [];
  } catch {
    return [];
  }
}

export function isLoggedInBlockCreator(user, block) {
  if (!user || !block) return false;
  if (idsMatch(user.id, block.userId)) return true;

  return !block.userId &&
    block.creator &&
    block.creator !== 'anonymous' &&
    user.username === block.creator;
}

export function canManageBlock(user, block, editTokens) {
  const isCreator = isLoggedInBlockCreator(user, block);
  const hasEditToken = Array.isArray(editTokens) && editTokens.includes(block.editToken);

  if (block?.status === 'locked') {
    return isCreator;
  }

  return isCreator || hasEditToken;
}

export function canEditBlockContent(user, block) {
  if (!block) return false;
  if (block.status === 'locked') return isLoggedInBlockCreator(user, block);
  return true;
}

export function toBlockPreviewDTO(block, {
  userId = null,
  previewChars = 1400,
  includeUserVote = true,
  allowImages = true,
  includeTranslation = true
} = {}) {
  const userVote = includeUserVote && userId
    ? (block.votes?.find(v => v.userId === userId)?.type || null)
    : null;

  const meta = titleOnlyMeta(block, { graceDays: 7 })
  if (meta.isTitleOnly) {
    return {
      _id: block._id,
      title: block.title,
      creator: block.creator,
      createdAt: block.createdAt,
      roomId: block.roomId,
      lang: block.lang,
      status: block.status,
      originalAuthor: block.originalAuthor,
      originalBlock: block.originalBlock,
      userVote,
      voteCount: block.voteCount,
      ...(includeTranslation && block.translation ? { translation: block.translation } : {}),
      ...meta,
      truncated: false,
      contentHTML: ''
    };
  }

  const { html, truncated } = renderMarkdownPreview(block.content, {
    maxChars: previewChars,
    includeWholeTables: true,
    allowImages,
    ellipsis: ''
  });

  return {
    _id: block._id,
    title: block.title,
    creator: block.creator,
    createdAt: block.createdAt,
    roomId: block.roomId,
    lang: block.lang,
    status: block.status,
    originalAuthor: block.originalAuthor,
    originalBlock: block.originalBlock,
    userVote,
    voteCount: block.voteCount,
    ...(includeTranslation && block.translation ? { translation: block.translation } : {}),
    truncated,
    contentHTML: html
  };
}

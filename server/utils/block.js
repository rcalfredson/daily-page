import { renderMarkdownPreview } from "./markdownHelper.js"
import { titleOnlyMeta } from './unfinished.js';

export function canManageBlock(user, block, editTokens) {
  const isCreator = user && user.username === block.creator;
  const hasEditToken = editTokens.includes(block.editToken);
  return isCreator || hasEditToken;
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

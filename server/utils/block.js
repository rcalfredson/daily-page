import { renderMarkdownPreview } from "./markdownHelper.js"

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

  const contentHTML = renderMarkdownPreview(block.content, {
    maxChars: previewChars,
    includeWholeTables: true,
    allowImages,
    ellipsis: '…'
  });

  return {
    _id: block._id,
    title: block.title,
    creator: block.creator,
    createdAt: block.createdAt,
    userVote,
    ...(includeTranslation && block.translation ? { translation: block.translation } : {}),
    contentHTML
  };
}

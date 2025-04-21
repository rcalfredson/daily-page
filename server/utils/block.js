export function canManageBlock(user, block, editTokens) {
  const isCreator = user && user.username === block.creator;
  const hasEditToken = editTokens.includes(block.editToken);
  return isCreator || hasEditToken;
}
// Shared by discovery queries and SEO. Indexing never grants access to a record.
export const PUBLIC_BLOCK_VISIBILITY_MATCH = Object.freeze({
  $or: [
    { visibility: 'public' },
    { visibility: 'unlisted', status: 'locked' }
  ]
});

export function publiclyVisibleBlockMatch(match = {}) {
  if (!match || Object.keys(match).length === 0) return { ...PUBLIC_BLOCK_VISIBILITY_MATCH };
  return { $and: [match, PUBLIC_BLOCK_VISIBILITY_MATCH] };
}

export function isPubliclyVisibleBlock(block) {
  return block?.visibility === 'public' || (
    block?.visibility === 'unlisted' && block?.status === 'locked'
  );
}

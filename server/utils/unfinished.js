// server/utils/unfinished.js

export function cleanText(s) {
  return (typeof s === 'string' ? s : '')
    .replace(/\u200B/g, '')
    .trim();
}

export function isBlockTitleOnly(block) {
  const content = cleanText(block?.content);
  const desc = cleanText(block?.description);
  return !content && !desc;
}

export function titleOnlyMeta(block, opts = {}) {
  const graceDays = Number(opts.graceDays ?? 7);

  const createdAt = block?.createdAt ? new Date(block.createdAt) : null;
  const ageMs = createdAt ? (Date.now() - createdAt.getTime()) : null;
  const ageDays = (ageMs == null) ? null : ageMs / (1000 * 60 * 60 * 24);

  const titleOnly = isBlockTitleOnly(block);

  return {
    isTitleOnly: titleOnly,
    titleOnlyGraceDays: graceDays,
    titleOnlyAgeDays: ageDays,
    isInTitleOnlyGrace: titleOnly && ageDays != null && ageDays <= graceDays,
  };
}

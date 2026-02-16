import BlockReaction from './models/BlockReaction.js';

export const ALLOWED_REACTIONS = ['heart', 'leaf', 'wow', 'laugh'];

export async function toggleReaction({ blockId, userId, type }) {
  if (!ALLOWED_REACTIONS.includes(type)) {
    const err = new Error('Invalid reaction type');
    err.status = 400;
    throw err;
  }

  // Try delete first (toggle off)
  const deleted = await BlockReaction.findOneAndDelete({ blockId, userId, type }).lean();
  if (deleted) return { toggledOn: false };

  // Otherwise create (toggle on)
  // Unique index protects against double-creates in race cases.
  try {
    await BlockReaction.create({ blockId, userId, type });
    return { toggledOn: true };
  } catch (e) {
    // If duplicate key, treat as “already on”
    if (e?.code === 11000) return { toggledOn: true };
    throw e;
  }
}

export async function getReactionCounts(blockId) {
  const rows = await BlockReaction.aggregate([
    { $match: { blockId: String(blockId) } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]).exec();

  // Normalize to stable shape
  const counts = { heart: 0, leaf: 0, wow: 0, laugh: 0 };
  for (const r of rows) counts[r._id] = r.count;
  return counts;
}

export async function getUserReactionsForBlock({ blockId, userId }) {
  if (!userId) return [];
  const docs = await BlockReaction.find({ blockId: String(blockId), userId })
    .select('type -_id')
    .lean();
  return docs.map(d => d.type);
}

export async function getReactionCountsForBlocks(blockIds = []) {
  const ids = [...new Set((blockIds || []).map(String))].filter(Boolean);
  if (!ids.length) return {};

  const rows = await BlockReaction.aggregate([
    { $match: { blockId: { $in: ids } } },
    { $group: { _id: { blockId: '$blockId', type: '$type' }, count: { $sum: 1 } } },
  ]).exec();

  const empty = { heart: 0, leaf: 0, wow: 0, laugh: 0 };
  const out = Object.create(null);

  // Initialize all requested ids so response is stable
  for (const id of ids) out[id] = { ...empty };

  for (const r of rows) {
    const blockId = r._id?.blockId;
    const type = r._id?.type;
    if (!blockId || !type) continue;
    if (!out[blockId]) out[blockId] = { ...empty };
    out[blockId][type] = r.count;
  }

  return out;
}


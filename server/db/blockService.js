import mongoose from 'mongoose';
import Block from './models/Block.js';
import * as cache from '../services/cache.js';
import { normalizeEditorialInput } from './editorial.js';
import { normalizeBannerImageInput } from './bannerImage.js';

const DEFAULT_TTL = 5000; // Cache for 5 seconds (adjust as needed)

const TTL = {
  globalBlockStats: 60 * 1000,     // 60s
  trendingTags: 120 * 1000,        // 2 min
  totalTags: 10 * 60 * 1000,       // 10 min
  featuredRoom: 60 * 1000,         // 60s
  featuredBlock: 60 * 1000,        // 60s
  topBlocks: 60 * 1000             // 60s
};

// optional: spread expirations so you don't get synchronized misses
const JITTER = 10 * 1000; // up to 10s extra
const HOME_STALE_TTL = 30 * 60 * 1000;
export const HOME_PINNED_BLOCK_LIMIT = 3;

export const PUBLIC_BLOCK_VISIBILITY_MATCH = Object.freeze({
  $or: [
    { visibility: 'public' },
    { visibility: 'unlisted', status: 'locked' }
  ]
});

export function publiclyVisibleBlockMatch(match = {}) {
  if (!match || Object.keys(match).length === 0) {
    return { ...PUBLIC_BLOCK_VISIBILITY_MATCH };
  }

  return {
    $and: [
      match,
      PUBLIC_BLOCK_VISIBILITY_MATCH
    ]
  };
}

export function isPubliclyVisibleBlock(block) {
  return block?.visibility === 'public' || (
    block?.visibility === 'unlisted' && block?.status === 'locked'
  );
}

// Create a new block
export async function createBlock(data) {
  if (!data.groupId) data.groupId = new mongoose.Types.ObjectId().toString();
  if (!data.lang) data.lang = 'en';
  if (Object.prototype.hasOwnProperty.call(data, 'editorial')) {
    const { value } = normalizeEditorialInput(data.editorial);
    if (value !== undefined) data.editorial = value;
    else delete data.editorial;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'bannerImage')) {
    const { value } = normalizeBannerImageInput(data.bannerImage);
    if (value !== undefined) data.bannerImage = value;
    else delete data.bannerImage;
  }
  const block = new Block(data);
  return await block.save();
}

// Get a block by ID
export async function getBlockById(blockId) {
  return await Block.findById(blockId);
}

export async function getTranslationByGroupAndLang(groupId, lang) {
  if (!groupId || !lang) return null;
  return await Block.findOne({ groupId, lang }).select('_id lang title roomId status');
}

export async function getPublicTranslationByGroupAndLang(groupId, lang) {
  if (!groupId || !lang) return null;
  return await Block.findOne(publiclyVisibleBlockMatch({ groupId, lang }))
    .select('_id lang title roomId status');
}

export async function getTranslations(groupId) {
  return await Block.find({ groupId }).select('lang _id title roomId');
}

export async function getPublicTranslations(groupId) {
  return await Block.find(publiclyVisibleBlockMatch({ groupId })).select('lang _id title roomId');
}

export async function getGlobalBlockStats() {
  return await cache.get(
    `global-block-stats`,
    async () => {
      // Total blocks globales
      const totalBlocks = await Block.countDocuments(publiclyVisibleBlockMatch());

      // Colaboraciones en las últimas 24 horas (en lugar del día UTC)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const blocksLast24Hours = await Block.find(
        publiclyVisibleBlockMatch({ createdAt: { $gte: last24Hours } })
      )
        .select('collaborators')
        .lean();

      let collaborationsLast24Hours = 0;
      blocksLast24Hours.forEach(block => {
        if (Array.isArray(block.collaborators)) {
          collaborationsLast24Hours += block.collaborators.length;
        }
      });

      return { totalBlocks, collaborationsToday: collaborationsLast24Hours };
    },
    [],
    { ttlMs: TTL.globalBlockStats, jitterMs: JITTER, staleTtlMs: HOME_STALE_TTL }
  );
}

export async function getTotalTags() {
  return await cache.get('total-tags', async () => {
    const result = await Block.aggregate([
      { $match: publiclyVisibleBlockMatch() },
      { $unwind: '$tags' },
      { $group: { _id: '$tags' } },
      { $count: 'totalTags' }
    ]);
    return result?.[0]?.totalTags ?? 0;
  }, [], { ttlMs: TTL.totalTags, jitterMs: JITTER, staleTtlMs: HOME_STALE_TTL });
}

export async function getAllTagsWithCounts(timeframe = 'all') {
  return await cache.get(
    `all-tags-with-counts-${timeframe}`,
    async () => {
      const matchStage = {};

      if (timeframe !== 'all') {
        const now = new Date();
        let cutoff;
        switch (timeframe) {
          case '24h':
            cutoff = new Date(now - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            cutoff = null;
        }
        if (cutoff) {
          matchStage.createdAt = { $gte: cutoff };
        }
      }

      const pipeline = [
        { $match: publiclyVisibleBlockMatch(matchStage) },
        { $unwind: '$tags' }
      ];

      pipeline.push(
        { $group: { _id: '$tags', totalBlocks: { $sum: 1 } } },
        { $sort: { totalBlocks: -1 } }
      );

      return await Block.aggregate(pipeline).exec();
    },
    [],
    DEFAULT_TTL
  );
}


export async function getTagTrendData(tagName, timeframe = 30, opts = {}) {
  const { dedupeGroups = true } = opts;
  const days = timeframe === 'all' ? null : Number(timeframe) || 30;
  const dateFilter = days
    ? { createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
    : {};
  const pipeline = dedupeGroups
    ? [
      { $match: publiclyVisibleBlockMatch({ tags: tagName, ...dateFilter }) },
      {
        $project: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          groupId: 1,
        }
      },
      // one count per (day, groupId)
      { $group: { _id: { day: '$day', groupId: '$groupId' } } },
      // then count unique groups per day
      { $group: { _id: '$_id.day', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]
    : [
      { $match: publiclyVisibleBlockMatch({ tags: tagName, ...dateFilter }) },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];
  return Block.aggregate(pipeline).exec();
}

export async function getFeaturedBlockWithFallback(options = {}) {
  const { preferredLang = 'en' } = options;

  return await cache.get(
    `featured-block-with-fallback-${preferredLang}`,
    async () => {
      // “Featured” becomes: random block from last year (prefer lang if possible)
      const { block, period } = await getRandomBlockFromLastYear({ preferredLang });

      // If absolutely nothing exists (very early dev), fall back to old logic
      if (!block) {
        const { blocks, period: p2 } = await getTopBlocksWithFallback({
          lockedOnly: false,
          limit: 1,
          preferredLang,
        });
        return { featuredBlock: blocks[0] || null, period: p2 };
      }

      return { featuredBlock: block, period };
    },
    [],
    { ttlMs: TTL.featuredBlock, jitterMs: JITTER, staleTtlMs: HOME_STALE_TTL }
  );
}

export async function getRandomBlockFromLastYear(options = {}) {
  const { preferredLang = 'en', days = 365 } = options;
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1) Try preferred language
  const preferred = await Block.aggregate([
    { $match: publiclyVisibleBlockMatch({ createdAt: { $gte: start, $lte: end }, lang: preferredLang }) },
    { $sample: { size: 1 } },
  ]).exec();

  if (preferred?.[0]) return { block: preferred[0], period: { type: 'days', value: days } };

  // 2) Fallback: any language
  const anyLang = await Block.aggregate([
    { $match: publiclyVisibleBlockMatch({ createdAt: { $gte: start, $lte: end } }) },
    { $sample: { size: 1 } },
  ]).exec();

  return { block: anyLang?.[0] || null, period: { type: 'days', value: days } };
}

export async function getTopBlocksByTimeframe(
  days = null,
  limit = 20,
  roomId = null,
  preferredLangOrOpts = 'en'
) {
  const preferredContentLang =
    typeof preferredLangOrOpts === 'string'
      ? preferredLangOrOpts
      : (preferredLangOrOpts?.preferredContentLang
        || preferredLangOrOpts?.preferredLang
        || 'en');

  return await cache.get(
    `top-blocks-timeframe-${days || 'all'}-${limit}-${roomId || 'global'}-${preferredContentLang}`,
    async () => {
      const start = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : new Date(0);
      const end = new Date();

      if (roomId) {
        return findByRoomWithLangPref({
          roomId,
          // preferredLang here means preferred *content* language
          // for choosing a translation variant in lists.
          preferredLang: preferredContentLang,
          startDate: start,
          endDate: end,
          sortBy: 'voteCount',
          limit
        });
      }

      return findTopGlobalWithLangPref({
        preferredLang: preferredContentLang,
        lockedOnly: false,
        limit,
        startDate: start,
        endDate: end
      });
    },
    [],
    DEFAULT_TTL
  );
}


export async function getFeaturedRoomWithFallback() {
  return await cache.get(
    `featured-room-with-fallback`,
    async () => {
      const intervals = [1, 7, 30]; // en días
      let result = null;
      let usedInterval = 1;

      for (let days of intervals) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const pipeline = [
          { $match: publiclyVisibleBlockMatch({ createdAt: { $gte: cutoff } }) },
          { $group: { _id: '$roomId', totalRoomVotes: { $sum: '$voteCount' }, blockCount: { $sum: 1 } } },
          { $sort: { totalRoomVotes: -1 } },
          { $limit: 1 },
        ];
        const [res] = await Block.aggregate(pipeline).exec();
        if (res) {
          result = res;
          usedInterval = days;
          break;
        }
      }

      return { featuredRoomData: result, period: usedInterval };
    },
    [],
    { ttlMs: TTL.featuredRoom, jitterMs: JITTER }
  );
}

export async function getRecentActivityByUser(username, options = {}) {
  const days = options.days || 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const publicOnly = options.publicOnly === true;

  const query = {
    updatedAt: { $gte: cutoff },
    $or: [
      { creator: username },
      { collaborators: username }
    ]
  };
  const findQuery = publicOnly ? publiclyVisibleBlockMatch(query) : query;

  return await cache.get(
    `recent-activity-${username}-${days}d-${options.limit || 10}-${publicOnly ? 'public' : 'all'}`,
    async () => {
      const activities = await Block.find(findQuery)
        .sort({ updatedAt: -1 })
        .limit(options.limit || 10)
        .lean();
      return activities;
    },
    [],
    DEFAULT_TTL
  );
}

// Fallback para obtener bloques con actividad
export async function getTopBlocksWithFallback(options = {}) {
  const {
    lockedOnly = false,
    limit = 20,
    preferredLang = "en",
    includePinnedHome = false,
    pinnedLimit = HOME_PINNED_BLOCK_LIMIT
  } = options;

  const now = Date.now();
  const endNow = new Date();

  // Disjoint windows (fromDays -> toDays), newest first
  // 0–1d, 1–7d, 7–30d, 30–365d, then all-time
  const windows = [
    { fromDays: 0, toDays: 1 },
    { fromDays: 1, toDays: 7 },
    { fromDays: 7, toDays: 30 },
    { fromDays: 30, toDays: 365 },
    { fromDays: 365, toDays: null }, // all-time remainder
  ];

  const target = Number(limit);
  const collected = [];
  const seen = new Set();
  const pinnedBlocks = includePinnedHome
    ? await getPinnedHomeBlocks({ preferredLang, lockedOnly, limit: pinnedLimit })
    : [];

  for (const block of pinnedBlocks) {
    if (block?._id) seen.add(String(block._id));
    if (block?.groupId) seen.add(`group:${block.groupId}`);
  }

  let maxDaysUsed = 1;
  let usedAllTime = false;

  // Cache each band at a “reasonable” fixed size to avoid key explosion.
  // Pull more than you need so dedupe doesn’t starve you.
  const BAND_FETCH = Math.max(target * 3, 50);

  for (const w of windows) {
    if (collected.length >= target) break;

    const startDate = w.toDays == null
      ? new Date(0)
      : new Date(now - w.toDays * 24 * 60 * 60 * 1000);

    const endDate = w.fromDays === 0
      ? endNow
      : new Date(now - w.fromDays * 24 * 60 * 60 * 1000);

    const cacheKey =
      w.toDays == null
        ? `top-blocks-band-all-${lockedOnly}-${preferredLang}-${BAND_FETCH}`
        : `top-blocks-band-${w.fromDays}-${w.toDays}-${lockedOnly}-${preferredLang}-${BAND_FETCH}`;

    const bandBlocks = await cache.get(
      cacheKey,
      async () => {
        return await findTopGlobalWithLangPref({
          preferredLang,
          lockedOnly,
          limit: BAND_FETCH,
          startDate,
          endDate,
        });
      },
      [],
      { ttlMs: TTL.topBlocks, jitterMs: JITTER, staleTtlMs: HOME_STALE_TTL }
    );

    if (Array.isArray(bandBlocks) && bandBlocks.length > 0) {
      for (const b of bandBlocks) {
        const id = String(b?._id);
        if (!id || seen.has(id)) continue;
        if (b?.groupId && seen.has(`group:${b.groupId}`)) continue;
        seen.add(id);
        if (b?.groupId) seen.add(`group:${b.groupId}`);
        collected.push(b);
        if (collected.length >= target) break;
      }

      if (w.toDays == null) usedAllTime = true;
      else maxDaysUsed = Math.max(maxDaysUsed, w.toDays);
    }
  }

  const period = usedAllTime
    ? { type: 'all' }
    : { type: 'days', value: maxDaysUsed };

  const preferredBlocks = await loadPreferredTranslationVariants(
    collected,
    preferredLang,
    { lockedOnly }
  );

  return {
    blocks: mergePinnedHomeBlocks(pinnedBlocks, preferredBlocks, { limit: target }),
    period
  };
}

export function replaceWithPreferredTranslationVariants(blocks, preferredTranslations, preferredLang) {
  const preferredByGroup = new Map(
    (preferredTranslations || [])
      .filter(block => block?.groupId && block?.lang === preferredLang)
      .map(block => [String(block.groupId), block])
  );

  return (blocks || []).map(block => {
    if (!block?.groupId || block.lang === preferredLang) return block;
    return preferredByGroup.get(String(block.groupId)) || block;
  });
}

async function loadPreferredTranslationVariants(
  blocks,
  preferredLang,
  { lockedOnly = false, roomId = null, status = null } = {}
) {
  const groupIds = [...new Set(
    (blocks || [])
      .filter(block => block?.groupId && block.lang !== preferredLang)
      .map(block => block.groupId)
  )];

  if (groupIds.length === 0) return blocks;

  const variantMatch = {
    groupId: { $in: groupIds },
    lang: preferredLang
  };
  if (roomId) variantMatch.roomId = roomId;
  if (status) variantMatch.status = status;
  else if (lockedOnly) variantMatch.status = 'locked';

  const match = publiclyVisibleBlockMatch(variantMatch);
  const preferredTranslations = await Block.find(match).lean().exec();
  return replaceWithPreferredTranslationVariants(blocks, preferredTranslations, preferredLang);
}

export function mergePinnedHomeBlocks(pinnedBlocks, ordinaryBlocks, { limit = 20 } = {}) {
  const pinnedLimit = HOME_PINNED_BLOCK_LIMIT;
  const seen = new Set();
  const merged = [];

  const addBlock = (block) => {
    if (!block?._id) return false;
    const id = String(block._id);
    const groupId = block.groupId ? `group:${block.groupId}` : null;
    if (seen.has(id) || (groupId && seen.has(groupId))) return false;

    seen.add(id);
    if (groupId) seen.add(groupId);
    merged.push(block);
    return true;
  };

  for (const block of pinnedBlocks || []) {
    if (merged.length >= pinnedLimit) break;
    addBlock(block);
  }

  for (const block of ordinaryBlocks || []) {
    if (merged.length >= Number(limit) + pinnedLimit) break;
    addBlock(block);
  }

  return merged;
}

async function getPinnedHomeBlocks({ preferredLang = 'en', lockedOnly = false, limit = HOME_PINNED_BLOCK_LIMIT } = {}) {
  const match = publiclyVisibleBlockMatch({ pinnedAt: { $exists: true, $ne: null } });
  if (lockedOnly) match.status = 'locked';

  return Block.aggregate([
    { $match: match },
    { $sort: { pinnedAt: -1, createdAt: -1 } },
    { $group: { _id: '$groupId', docs: { $push: '$$ROOT' } } },
    {
      $project: {
        best: {
          $let: {
            vars: {
              preferred: {
                $filter: {
                  input: '$docs',
                  as: 'd',
                  cond: { $eq: ['$$d.lang', preferredLang] }
                }
              }
            },
            in: {
              $cond: [
                { $gt: [{ $size: '$$preferred' }, 0] },
                { $arrayElemAt: ['$$preferred', 0] },
                { $arrayElemAt: ['$docs', 0] }
              ]
            }
          }
        }
      }
    },
    { $replaceRoot: { newRoot: '$best' } },
    { $sort: { pinnedAt: -1, createdAt: -1 } },
    { $limit: Number(limit) }
  ]).exec();
}

// Fallback para bloques por room (locked o in-progress)
export async function getBlocksByRoomWithFallback({
  roomId,
  status = null,
  limit = 20,
  preferredLang = 'en'
}) {
  const intervals = [1, 7, 30, 'all'];

  for (let win of intervals) {
    let blocks = [];

    if (win === 'all') {
      // All time: sin filtro de fechas
      blocks = await findByRoomWithLangPref({
        roomId,
        preferredLang,
        status,
        sortBy: 'voteCount',
        limit
      });
    } else {
      const cutoff = new Date(Date.now() - win * 24 * 60 * 60 * 1000);
      blocks = await findByRoomWithLangPref({
        roomId,
        preferredLang,
        status,
        startDate: cutoff,
        endDate: new Date(),
        sortBy: 'voteCount',
        limit
      })
    }

    if (blocks.length > 0) {
      const preferredBlocks = await loadPreferredTranslationVariants(
        blocks,
        preferredLang,
        { roomId, status }
      );
      return { blocks: preferredBlocks, period: win };
    }
  }

  return { blocks: [], period: 'all' }
}

// Fallback para obtener trending tags con actividad
export async function getTrendingTagsWithFallback(options = {}) {
  const {
    limit = 10,
    sortBy = 'totalBlocks',
    minCount = 1,
  } = options;

  const now = Date.now();
  const endNow = new Date();

  const windows = [
    { fromDays: 0, toDays: 1 },
    { fromDays: 1, toDays: 7 },
    { fromDays: 7, toDays: 30 },
    { fromDays: 30, toDays: 365 },
    { fromDays: 365, toDays: null },
  ];

  const target = Number(limit);

  // Pull extra candidates per band so merging still yields a strong top-N
  const BAND_FETCH = Math.max(target * 5, 50);

  const makePipeline = (startDate, endDate, bandLimit) => {
    const stageMatch = publiclyVisibleBlockMatch({ createdAt: { $gte: startDate, $lte: endDate } });
    const stageAfterGroupMatch =
      minCount > 1 ? [{ $match: { totalBlocks: { $gte: minCount } } }] : [];
    const stageSort = { [sortBy]: -1, totalVotes: -1, totalBlocks: -1, _id: 1 };

    return [
      { $match: stageMatch },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          totalBlocks: { $sum: 1 },
          totalVotes: { $sum: '$voteCount' },
        }
      },
      ...stageAfterGroupMatch,
      { $sort: stageSort },
      { $limit: Number(bandLimit) },
    ];
  };

  const totals = new Map(); // tag -> { _id, totalBlocks, totalVotes }
  let maxDaysUsed = 1;
  let usedAllTime = false;

  for (const w of windows) {
    // If we already have a lot of distinct tags, we can stop early.
    // (Still safe: final slice will choose best.)
    if (totals.size >= target * 3) break;

    const startDate = w.toDays == null
      ? new Date(0)
      : new Date(now - w.toDays * 24 * 60 * 60 * 1000);

    const endDate = w.fromDays === 0
      ? endNow
      : new Date(now - w.fromDays * 24 * 60 * 60 * 1000);

    const cacheKey =
      w.toDays == null
        ? `trending-tags-band-all-${BAND_FETCH}-${sortBy}-min${minCount}`
        : `trending-tags-band-${w.fromDays}-${w.toDays}-${BAND_FETCH}-${sortBy}-min${minCount}`;

    const bandTags = await cache.get(
      cacheKey,
      async () => Block.aggregate(makePipeline(startDate, endDate, BAND_FETCH)).exec(),
      [],
      { ttlMs: TTL.trendingTags, jitterMs: JITTER, staleTtlMs: HOME_STALE_TTL }
    );

    if (Array.isArray(bandTags) && bandTags.length > 0) {
      for (const row of bandTags) {
        const key = String(row._id);
        if (!key) continue;

        const prev = totals.get(key) || { _id: row._id, totalBlocks: 0, totalVotes: 0 };
        totals.set(key, {
          _id: row._id,
          totalBlocks: prev.totalBlocks + (row.totalBlocks || 0),
          totalVotes: prev.totalVotes + (row.totalVotes || 0),
        });
      }

      if (w.toDays == null) usedAllTime = true;
      else maxDaysUsed = Math.max(maxDaysUsed, w.toDays);
    }
  }

  const merged = Array.from(totals.values());

  // Final sort and slice
  merged.sort((a, b) => {
    const primary = (b[sortBy] || 0) - (a[sortBy] || 0);
    if (primary !== 0) return primary;
    const votes = (b.totalVotes || 0) - (a.totalVotes || 0);
    if (votes !== 0) return votes;
    const blocks = (b.totalBlocks || 0) - (a.totalBlocks || 0);
    if (blocks !== 0) return blocks;
    return String(a._id).localeCompare(String(b._id));
  });

  const period = usedAllTime
    ? { type: 'all' }
    : { type: 'days', value: maxDaysUsed };

  return { tags: merged.slice(0, target), period };
}


export async function findByUserWithLangPref({
  username,
  preferredLang = 'en',
  sortBy = 'createdAt',
  sortDir = -1,
  skip = 0,
  limit = 20,
  publicOnly = true,
  extraMatch = null
}) {
  const userMatch = {
    $or: [{ creator: username }, { collaborators: username }]
  };
  const scopedMatch = extraMatch
    ? { $and: [userMatch, extraMatch] }
    : userMatch;
  const matchStage = publicOnly ? publiclyVisibleBlockMatch(scopedMatch) : scopedMatch;

  const sortStage = { [sortBy]: sortDir };
  if (sortBy !== 'createdAt') {
    sortStage.createdAt = -1;
  }

  const pipeline = [
    { $match: matchStage },
    { $sort: sortStage },
    { $group: { _id: "$groupId", docs: { $push: "$$ROOT" } } },
    {
      $project: {
        best: {
          $let: {
            vars: {
              preferred: {
                $filter: {
                  input: "$docs",
                  as: "d",
                  cond: { $eq: ["$$d.lang", preferredLang] }
                }
              }
            },
            in: {
              $cond: [
                { $gt: [{ $size: "$$preferred" }, 0] },
                { $arrayElemAt: ["$$preferred", 0] },
                { $arrayElemAt: ["$docs", 0] }
              ]
            }
          }
        }
      }
    },
    { $replaceRoot: { newRoot: "$best" } },
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit }
  ];

  return await Block.aggregate(pipeline).exec();
}

export async function findDraftsByUser({
  username,
  preferredLang = 'en',
  limit = 5
}) {
  if (!username) return [];

  return await findByUserWithLangPref({
    username,
    preferredLang,
    sortBy: 'updatedAt',
    sortDir: -1,
    limit,
    publicOnly: false,
    extraMatch: {
      creator: username,
      status: 'in-progress'
    }
  });
}

// Get all blocks created on a specific date (with caching)
export async function getBlocksByDate(date) {
  return await cache.get(
    `blocks-by-date-${date}`,
    async () => {
      const blocks = await Block.find(publiclyVisibleBlockMatch({
        createdAt: { $gte: new Date(date), $lt: new Date(date + 'T23:59:59.999Z') }
      }))
        .sort({ createdAt: 1 }) // Sort oldest to newest
        .lean(); // Convert Mongoose objects to plain JSON

      return blocks;
    },
    [],
    DEFAULT_TTL
  );
}

// Get all unique dates that have blocks in a given year/month (with caching)
export async function getBlockDatesByYearMonth(year, month, roomId = null) {
  const query = {
    createdAt: {
      $gte: new Date(`${year}-${month}-01T00:00:00.000Z`),
      $lt: new Date(`${year}-${month}-31T23:59:59.999Z`)
    }
  };

  if (roomId) query.roomId = roomId;
  const visibleQuery = publiclyVisibleBlockMatch(query);

  return await cache.get(
    `block-dates-${year}-${month}-${roomId || 'global'}`,
    async () => {
      const blocks = await Block.find(visibleQuery, { createdAt: 1 }).sort({ createdAt: -1 }).lean();
      const uniqueDates = [...new Set(blocks.map(block => block.createdAt.toISOString().split('T')[0]))];
      return uniqueDates;
    },
    [],
    DEFAULT_TTL
  );
}

// Get all year/month combinations with blocks (cached)
export async function getAllBlockYearMonthCombos(roomId = null) {
  const pipeline = [
    { $match: publiclyVisibleBlockMatch() },
    { $project: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, roomId: 1 } }
  ];

  if (roomId) pipeline[0] = { $match: publiclyVisibleBlockMatch({ roomId }) };

  pipeline.push(
    { $group: { _id: { year: '$year', month: '$month' } } },
    { $sort: { '_id.year': -1, '_id.month': -1 } }
  );

  return await cache.get(
    `block-year-month-combos-${roomId || 'global'}`,
    async () => {
      const aggDocs = await Block.aggregate(pipeline).exec();
      return aggDocs.map(doc => ({ year: doc._id.year, month: doc._id.month }));
    },
    [],
    DEFAULT_TTL
  );
}

export async function findByRoomWithLangPref({
  roomId,
  preferredLang = 'en',
  status,
  startDate,
  endDate,
  sortBy = 'createdAt',
  sortDir = -1,
  skip = 0,
  limit = 20
}) {
  const matchStage = publiclyVisibleBlockMatch({ roomId });
  const sortStage = { [sortBy]: sortDir };
  if (sortBy !== 'createdAt') {
    sortStage.createdAt = -1;
  }
  if (status) matchStage.status = status;
  if (startDate || endDate) matchStage.createdAt = {};
  if (startDate) matchStage.createdAt.$gte = new Date(startDate);
  if (endDate) matchStage.createdAt.$lt = new Date(endDate);

  const pipeline = [
    { $match: matchStage },
    { $sort: sortStage },

    // Agrupamos por groupId y metemos todos los docs en un array
    {
      $group: {
        _id: '$groupId',
        docs: { $push: '$$ROOT' }
      }
    },

    // Elegimos “best fit”
    {
      $project: {
        best: {
          $let: {
            vars: {
              preferred: {
                $filter: {
                  input: '$docs',
                  as: 'd',
                  cond: { $eq: ['$$d.lang', preferredLang] }
                }
              }
            },
            in: {
              $cond: [
                { $gt: [{ $size: '$$preferred' }, 0] },
                { $arrayElemAt: ['$$preferred', 0] },   // usamos la traducción
                { $arrayElemAt: ['$docs', 0] }          // si no, la primera
              ]
            }
          }
        }
      }
    },

    { $replaceRoot: { newRoot: '$best' } },
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit }
  ];

  return await Block.aggregate(pipeline).exec();
}

export async function findByDateWithLangPref({
  date,               // 'YYYY-MM-DD'
  preferredLang = 'en',
  sortBy = 'voteCount',
  limit = 50
}) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  const sortStage = { [sortBy]: -1 };
  if (sortBy !== 'createdAt') {
    sortStage.createdAt = -1;
  }

  const pipeline = [
    { $match: publiclyVisibleBlockMatch({ createdAt: { $gte: start, $lt: end } }) },
    { $sort: sortStage },
    { $group: { _id: '$groupId', docs: { $push: '$$ROOT' } } },
    {
      $project: {
        best: {
          $let: {
            vars: {
              preferred: {
                $filter: {
                  input: '$docs',
                  as: 'd',
                  cond: { $eq: ['$$d.lang', preferredLang] }
                }
              }
            },
            in: {
              $cond: [
                { $gt: [{ $size: '$$preferred' }, 0] },
                { $arrayElemAt: ['$$preferred', 0] },
                { $arrayElemAt: ['$docs', 0] }
              ]
            }
          }
        }
      }
    },
    { $replaceRoot: { newRoot: '$best' } },
    { $sort: sortStage },
    { $limit: limit }
  ];

  return Block.aggregate(pipeline).exec();
}

async function findTopGlobalWithLangPref({ preferredLang, lockedOnly, limit, startDate, endDate }) {
  const match = publiclyVisibleBlockMatch({ createdAt: { $gte: startDate, $lt: endDate } });
  if (lockedOnly) match.status = 'locked';

  return Block.aggregate([
    { $match: match },
    { $sort: { voteCount: -1, createdAt: -1 } },
    { $group: { _id: '$groupId', docs: { $push: '$$ROOT' } } },
    {
      $project: {
        best: {
          $let: {
            vars: {
              preferred: {
                $filter: {
                  input: '$docs',
                  as: 'd',
                  cond: { $eq: ['$$d.lang', preferredLang] }
                }
              }
            },
            in: {
              $cond: [
                { $gt: [{ $size: '$$preferred' }, 0] },
                { $arrayElemAt: ['$$preferred', 0] },
                { $arrayElemAt: ['$docs', 0] }
              ]
            }
          }
        }
      }
    },
    { $replaceRoot: { newRoot: '$best' } },
    { $sort: { voteCount: -1, createdAt: -1 } },
    { $limit: limit }
  ]).exec();
}

export async function findByTagWithLangPref({ tag, preferredLang = "en", sortBy = "voteCount", skip = 0, limit = 20 }) {
  const sortStage = { [sortBy]: -1 };
  if (sortBy !== 'createdAt') {
    sortStage.createdAt = -1;
  }
  return Block.aggregate([
    { $match: publiclyVisibleBlockMatch({ tags: tag }) },
    { $sort: sortStage },
    { $group: { _id: "$groupId", docs: { $push: "$$ROOT" } } },
    {
      $project: {
        best: {
          $let: {
            vars: {
              preferred: {
                $filter: {
                  input: "$docs",
                  as: "d",
                  cond: { $eq: ["$$d.lang", preferredLang] }
                }
              }
            },
            in: {
              $cond: [
                { $gt: [{ $size: "$$preferred" }, 0] },
                { $arrayElemAt: ["$$preferred", 0] },
                { $arrayElemAt: ["$docs", 0] }
              ]
            }
          }
        }
      }
    },
    { $replaceRoot: { newRoot: "$best" } },
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit }
  ]).exec();
}

// Get blocks by roomId
export async function getBlocksByRoom(roomId, options = {}) {
  const { status, startDate, endDate, lang, sortBy = 'createdAt' } = options;

  const query = publiclyVisibleBlockMatch({ roomId });
  if (status) query.status = status;
  if (lang) query.lang = lang;

  // Handle date filtering logic
  if (startDate && !endDate) {
    const exclusiveEndDate = new Date(startDate);
    exclusiveEndDate.setDate(exclusiveEndDate.getDate() + 1);
    query.createdAt = { $gte: new Date(startDate), $lt: exclusiveEndDate };
  } else if (!startDate && endDate) {
    throw new Error('Cannot provide endDate without startDate.');
  } else if (startDate && endDate) {
    query.createdAt = { $gte: new Date(startDate), $lt: new Date(endDate) };
  }

  return await Block.find(query).sort({ [sortBy]: -1 });
}

export async function getBlocksByRoomWithUserVotes(roomId, userId, options) {
  const blocks = await getBlocksByRoom(roomId, options);

  return blocks.map((block) => {
    const userVote = block.votes.find((vote) => vote.userId === userId)?.type || null;
    return { ...block.toObject(), userVote };
  });
}

export const saveVote = async (blockId, userId, action) => {
  const increment = action === 'upvote' ? 1 : -1;

  try {
    const block = await Block.findById(blockId);

    if (!block) {
      throw new Error('Block not found');
    }

    // Find existing vote by this user
    const existingVoteIndex = block.votes.findIndex((vote) => vote.userId === userId);

    if (existingVoteIndex >= 0) {
      const existingVote = block.votes[existingVoteIndex];

      if (existingVote.type === action) {
        return block.voteCount; // no-op; user already voted in this direction.
      }

      // Reverse vote direction
      block.votes[existingVoteIndex].type = action;
      block.voteCount += 2 * increment; // Adjust by +2 or -2 depending on the change
    } else {
      // Add new vote
      block.votes.push({ userId, type: action });
      block.voteCount += increment;
    }

    await block.save();
    return block.voteCount;
  } catch (error) {
    throw new Error(`Error saving vote: ${error.message}`);
  }
};

// Update a block by ID
export async function updateBlock(blockId, updates) {
  return await Block.findByIdAndUpdate(blockId, updates, {
    returnDocument: 'after',
    runValidators: true,
    context: 'query'
  });
}

// Delete a block by ID
export async function deleteBlock(blockId) {
  return await Block.findByIdAndDelete(blockId);
}

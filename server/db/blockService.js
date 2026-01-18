import mongoose from 'mongoose';
import Block from './models/Block.js';
import * as cache from '../services/cache.js';

const DEFAULT_TTL = 5000; // Cache for 5 seconds (adjust as needed)

const TTL = {
  globalBlockStats: 60 * 1000,     // 60s
  trendingTags: 120 * 1000,        // 2 min
  totalTags: 10 * 60 * 1000,       // 10 min
  featuredRoom: 60 * 1000,         // 60s
  topBlocks: 60 * 1000             // 60s
};

// optional: spread expirations so you don't get synchronized misses
const JITTER = 10 * 1000; // up to 10s extra

// Create a new block
export async function createBlock(data) {
  if (!data.groupId) data.groupId = new mongoose.Types.ObjectId().toString();
  if (!data.lang) data.lang = 'en';
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

export async function getTranslations(groupId) {
  return await Block.find({ groupId }).select('lang _id title roomId');
}

export async function getGlobalBlockStats() {
  return await cache.get(
    `global-block-stats`,
    async () => {
      // Total blocks globales
      const totalBlocks = await Block.countDocuments({});

      // Colaboraciones en las últimas 24 horas (en lugar del día UTC)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const blocksLast24Hours = await Block.find({ createdAt: { $gte: last24Hours } })
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
    { ttlMs: TTL.globalBlockStats, jitterMs: JITTER }
  );
}

export async function getTotalTags() {
  return await cache.get('total-tags', async () => {
    const result = await Block.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags' } },
      { $count: 'totalTags' }
    ]);
    return result?.[0]?.totalTags ?? 0;
  }, [], { ttlMs: TTL.totalTags, jitterMs: JITTER });
}

export async function getAllTagsWithCounts(timeframe = 'all') {
  return await cache.get(
    `all-tags-with-counts-${timeframe}`,
    async () => {
      const pipeline = [{ $unwind: '$tags' }];

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
          pipeline.unshift({ $match: { createdAt: { $gte: cutoff } } });
        }
      }

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


export async function getTagTrendData(tagName, defaultDays = 30, opts = {}) {
  const { dedupeGroups = true } = opts;
  // Obtener los primeros 20 bloques por fecha ascendente (los más antiguos primero)
  const blocks = await Block.find({ tags: tagName })
    .sort({ createdAt: 1 })
    .limit(20)
    .select('createdAt')
    .lean();

  let days = defaultDays; // valor por defecto de 30 días
  if (blocks.length > 0) {
    const firstDate = new Date(blocks[0].createdAt);
    const lastDate = new Date(blocks[blocks.length - 1].createdAt);
    const diffMs = lastDate - firstDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Si el rango entre el bloque más antiguo y el más reciente es mayor a 30 días,
    // usamos ese rango (redondeado hacia arriba) como nuestro período.
    if (diffDays > 30) {
      days = Math.ceil(diffDays);
    }
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pipeline = dedupeGroups
    ? [
      { $match: { tags: tagName, createdAt: { $gte: cutoff } } },
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
      { $match: { tags: tagName, createdAt: { $gte: cutoff } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];
  return Block.aggregate(pipeline).exec();
}

export async function getFeaturedBlockWithFallback(options = {}) {
  const { preferredLang = 'en' } = options;

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
}

export async function getRandomBlockFromLastYear(options = {}) {
  const { preferredLang = 'en', days = 365 } = options;
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1) Try preferred language
  const preferred = await Block.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end }, lang: preferredLang } },
    { $sample: { size: 1 } },
  ]).exec();

  if (preferred?.[0]) return { block: preferred[0], period: { type: 'days', value: days } };

  // 2) Fallback: any language
  const anyLang = await Block.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
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
          { $match: { createdAt: { $gte: cutoff } } },
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

  const query = {
    updatedAt: { $gte: cutoff },
    $or: [
      { creator: username },
      { collaborators: username }
    ]
  };

  return await cache.get(
    `recent-activity-${username}-${days}d-${options.limit || 10}`,
    async () => {
      const activities = await Block.find(query)
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
  const { lockedOnly = false, limit = 20, preferredLang = "en" } = options;

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
      { ttlMs: TTL.topBlocks, jitterMs: JITTER }
    );

    if (Array.isArray(bandBlocks) && bandBlocks.length > 0) {
      for (const b of bandBlocks) {
        const id = String(b?._id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
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

  return { blocks: collected, period };
}

// Fallback para bloques por room (locked o in-progress)
export async function getBlocksByRoomWithFallback({
  roomId,
  userId = null,
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
      return { blocks, period: win };
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
    const stageMatch = { createdAt: { $gte: startDate, $lte: endDate } };
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
      { ttlMs: TTL.trendingTags, jitterMs: JITTER }
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
  limit = 20
}) {
  const matchStage = {
    $or: [{ creator: username }, { collaborators: username }]
  };

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

// Get all blocks created on a specific date (with caching)
export async function getBlocksByDate(date) {
  return await cache.get(
    `blocks-by-date-${date}`,
    async () => {
      const blocks = await Block.find({ createdAt: { $gte: new Date(date), $lt: new Date(date + 'T23:59:59.999Z') } })
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

  return await cache.get(
    `block-dates-${year}-${month}-${roomId || 'global'}`,
    async () => {
      const blocks = await Block.find(query, { createdAt: 1 }).sort({ createdAt: -1 }).lean();
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
    { $project: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, roomId: 1 } }
  ];

  if (roomId) pipeline.unshift({ $match: { roomId } });

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
  const matchStage = { roomId };
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
    { $match: { createdAt: { $gte: start, $lt: end } } },
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
  const match = { createdAt: { $gte: startDate, $lt: endDate } };
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
    { $match: { tags: tag } },
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

  const query = { roomId };
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
  return await Block.findByIdAndUpdate(blockId, updates, { new: true });
}

// Delete a block by ID
export async function deleteBlock(blockId) {
  return await Block.findByIdAndDelete(blockId);
}

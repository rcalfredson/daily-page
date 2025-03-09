import Block from './models/Block.js';
import * as cache from '../services/cache.js';

const CACHE_TTL = 5000; // Cache for 5 seconds (adjust as needed)

// Create a new block
export async function createBlock(data) {
  const block = new Block(data);
  return await block.save();
}

// Get a block by ID
export async function getBlockById(blockId) {
  return await Block.findById(blockId);
}

export async function getGlobalBlockStats() {
  return await cache.get(
    `global-block-stats`,
    async () => {
      // Total blocks globales
      const totalBlocks = await Block.countDocuments({});

      // Collaborations today:
      const now = new Date();
      const startOfDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      const blocksToday = await Block.find({ createdAt: { $gte: startOfDayUTC } })
        .select('collaborators')
        .lean();

      let collaborationsToday = 0;
      blocksToday.forEach(block => {
        if (Array.isArray(block.collaborators)) {
          collaborationsToday += block.collaborators.length;
        }
      });

      return { totalBlocks, collaborationsToday };
    },
    [],
    CACHE_TTL
  );
}

export async function getFeaturedBlock() {
  return await cache.get(
    `featured-block`,
    async () => {
      const [topBlock] = await getTopBlocksLast24Hours({ lockedOnly: false, limit: 1 });
      return topBlock || null;
    },
    [],
    CACHE_TTL
  );
}

export async function getFeaturedRoomLast24Hours() {
  return await cache.get(
    `featured-room-last-24h`,
    async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pipeline = [
        { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
        { $group: { _id: '$roomId', totalRoomVotes: { $sum: '$voteCount' }, blockCount: { $sum: 1 } } },
        { $sort: { totalRoomVotes: -1 } },
        { $limit: 1 },
      ];
      const [result] = await Block.aggregate(pipeline).exec();
      return result || null;
    },
    [],
    CACHE_TTL
  );
}

// Get top blocks from the last 24 hours, optionally filtering for locked blocks only.
export async function getTopBlocksLast24Hours(options = {}) {
  const { lockedOnly = false, limit = 20 } = options;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const query = { createdAt: { $gte: twentyFourHoursAgo } };
  if (lockedOnly) {
    query.status = 'locked'; // Asumiendo que 'locked' indica bloques completados.
  }
  return await cache.get(
    `top-blocks-last-24h-${lockedOnly}-${limit}`,
    async () => {
      const blocks = await Block.find(query)
        .sort({ voteCount: -1 })
        .limit(limit)
        .lean();
      return blocks;
    },
    [],
    CACHE_TTL
  );
}

export async function getTrendingTagsLast24Hours(options = {}) {
  const { limit = 10, sortBy = 'totalVotes' } = options;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return await cache.get(
    `trending-tags-last-24h-${limit}-${sortBy}`,
    async () => {
      const pipeline = [
        // Solo consideramos bloques de las últimas 24 horas
        { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
        // Separa el array de tags para contarlos individualmente
        { $unwind: '$tags' },
        // Agrupa por el nombre del tag
        {
          $group: {
            _id: '$tags',
            totalBlocks: { $sum: 1 }, // Cuántos bloques usan este tag
            totalVotes: { $sum: '$voteCount' }, // Suma de los votos
          },
        },
        // Ordena, por defecto, según totalBlocks (o totalVotes, si lo prefieres)
        { $sort: { [sortBy]: -1 } },
        // Limita cuántos tags se muestran
        { $limit: limit },
      ];

      return await Block.aggregate(pipeline).exec();
    },
    [],
    CACHE_TTL
  );
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
    CACHE_TTL
  );
}

// Get all unique dates that have blocks in a given year/month (with caching)
export async function getBlockDatesByYearMonth(year, month) {
  return await cache.get(
    `block-dates-${year}-${month}`,
    async () => {
      const blocks = await Block.find(
        {
          createdAt: {
            $gte: new Date(`${year}-${month}-01T00:00:00.000Z`),
            $lt: new Date(`${year}-${month}-31T23:59:59.999Z`)
          }
        },
        { createdAt: 1 } // Only return the createdAt field
      ).sort({ createdAt: -1 }).lean();

      // Extract unique YYYY-MM-DD dates
      const uniqueDates = [...new Set(blocks.map(block => block.createdAt.toISOString().split('T')[0]))];

      return uniqueDates;
    },
    [],
    CACHE_TTL
  );
}

// Get all year/month combinations with blocks (cached)
export async function getAllBlockYearMonthCombos() {
  return await cache.get(
    'block-year-month-combos', // Cache key
    async () => {
      const pipeline = [
        {
          $project: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
        },
        { $group: { _id: { year: '$year', month: '$month' } } },
        { $sort: { '_id.year': -1, '_id.month': -1 } }, // Sort latest first
      ];

      const aggDocs = await Block.aggregate(pipeline).exec();

      // Convert into simple { year, month } objects
      return aggDocs.map(doc => ({ year: doc._id.year, month: doc._id.month }));
    },
    [],
    CACHE_TTL
  );
}

// Get blocks by roomId
export async function getBlocksByRoom(roomId, options = {}) {
  const { status, startDate, endDate, sortBy = 'createdAt' } = options;

  const query = { roomId };
  if (status) query.status = status;

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
        throw new Error('User has already voted in this direction');
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

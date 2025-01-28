import Block from './models/Block.js';

// Create a new block
export async function createBlock(data) {
  const block = new Block(data);
  return await block.save();
}

// Get a block by ID
export async function getBlockById(blockId) {
  return await Block.findById(blockId);
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

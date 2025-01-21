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
export async function getBlocksByRoom(roomId, status = null) {
  const query = { roomId };
  if (status) query.status = status;
  return await Block.find(query).sort({ createdAt: -1 });
}

// Update a block by ID
export async function updateBlock(blockId, updates) {
  return await Block.findByIdAndUpdate(blockId, updates, { new: true });
}

// Delete a block by ID
export async function deleteBlock(blockId) {
  return await Block.findByIdAndDelete(blockId);
}

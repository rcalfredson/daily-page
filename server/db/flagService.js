import Flag from './models/Flag.js';

// Create a new flag
export async function createFlag({ blockId, reason, description, reporter }) {
  const flag = new Flag({ blockId, reason, description, reporter });
  return flag.save();
}

// (Optional) Fetch flags for a block
export async function getFlagsByBlock(blockId) {
  return Flag.find({ blockId }).sort({ createdAt: -1 }).lean();
}

// (Optional) Update flag status
export async function updateFlagStatus(flagId, status) {
  return Flag.findByIdAndUpdate(flagId, { status }, { new: true });
}

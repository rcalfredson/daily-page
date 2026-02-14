import mongoose from 'mongoose';
import blockReactionSchema from '../schemas/BlockReactionSchema.js';

export default mongoose.model('BlockReaction', blockReactionSchema);

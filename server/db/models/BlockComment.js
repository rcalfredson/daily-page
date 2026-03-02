import mongoose from 'mongoose';
import blockCommentSchema from '../schemas/BlockCommentSchema.js';

export default mongoose.model('BlockComment', blockCommentSchema);

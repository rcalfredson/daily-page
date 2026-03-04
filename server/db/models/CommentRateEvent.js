import mongoose from 'mongoose';
import commentRateEventSchema from '../schemas/CommentRateEventSchema.js';

export default mongoose.models.CommentRateEvent ||
  mongoose.model('CommentRateEvent', commentRateEventSchema);

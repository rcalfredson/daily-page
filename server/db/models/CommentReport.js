import mongoose from 'mongoose';
import commentReportSchema from '../schemas/CommentReportSchema.js';

export default mongoose.models.CommentReport ||
  mongoose.model('CommentReport', commentReportSchema);

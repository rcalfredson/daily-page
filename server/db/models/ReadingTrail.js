import mongoose from 'mongoose';
import readingTrailSchema from '../schemas/ReadingTrailSchema.js';

export default mongoose.model('ReadingTrail', readingTrailSchema);

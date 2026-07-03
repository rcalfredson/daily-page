import mongoose from 'mongoose';
import questSchema from '../schemas/QuestSchema.js';

export default mongoose.model('Quest', questSchema);

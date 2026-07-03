import mongoose from 'mongoose';
import questItemSchema from '../schemas/QuestItemSchema.js';

export default mongoose.model('QuestItem', questItemSchema);

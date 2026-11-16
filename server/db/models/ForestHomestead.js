import mongoose from 'mongoose';
import schema from '../schemas/ForestHomesteadSchema.js';
export default mongoose.model('ForestHomestead', schema, 'forest-homesteads');

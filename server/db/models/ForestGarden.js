import mongoose from 'mongoose';
import schema from '../schemas/ForestGardenSchema.js';
export default mongoose.model('ForestGarden', schema, 'forest-gardens');

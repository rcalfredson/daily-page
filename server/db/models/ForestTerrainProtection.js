import mongoose from 'mongoose';
import schema from '../schemas/ForestTerrainProtectionSchema.js';
export default mongoose.model('ForestTerrainProtection', schema, 'forest-terrain-protections');

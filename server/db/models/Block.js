import mongoose from 'mongoose';
import blockSchema from '../schemas/BlockSchema.js';

const Block = mongoose.model('Block', blockSchema,);

export default Block;

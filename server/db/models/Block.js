import mongoose from 'mongoose';
import blockSchema from '../schemas/BlockSchema.js';

const User = mongoose.model('Block', blockSchema,);

export default User;

import mongoose from 'mongoose';
import flagSchema from '../schemas/FlagSchema.js';

const Flag = mongoose.model('Flag', flagSchema);
export default Flag;

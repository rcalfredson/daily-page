import mongoose from 'mongoose';
import forestOwnerWorldSchema from '../schemas/ForestOwnerWorldSchema.js';

const ForestOwnerWorld = mongoose.model(
  'ForestOwnerWorld',
  forestOwnerWorldSchema,
  'forest-owner-worlds'
);

export default ForestOwnerWorld;

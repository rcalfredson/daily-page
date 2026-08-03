import mongoose from 'mongoose';
import forestWritingTreeSchema from '../schemas/ForestWritingTreeSchema.js';

const ForestWritingTree = mongoose.model(
  'ForestWritingTree',
  forestWritingTreeSchema,
  'forest-writing-trees'
);

export default ForestWritingTree;

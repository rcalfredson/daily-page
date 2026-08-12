import mongoose from 'mongoose';
import forestAuthoredObjectSchema from '../schemas/ForestAuthoredObjectSchema.js';

const ForestAuthoredObject = mongoose.model(
  'ForestAuthoredObject',
  forestAuthoredObjectSchema,
  'forest-authored-objects'
);

export default ForestAuthoredObject;

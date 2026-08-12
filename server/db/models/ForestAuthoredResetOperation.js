import mongoose from 'mongoose';
import forestAuthoredResetOperationSchema from '../schemas/ForestAuthoredResetOperationSchema.js';

const ForestAuthoredResetOperation = mongoose.model(
  'ForestAuthoredResetOperation',
  forestAuthoredResetOperationSchema,
  'forest-authored-reset-operations'
);

export default ForestAuthoredResetOperation;

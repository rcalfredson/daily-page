import mongoose from 'mongoose';
import forestOwnerGroupReconciliationJobSchema from '../schemas/ForestOwnerGroupReconciliationJobSchema.js';

const ForestOwnerGroupReconciliationJob = mongoose.model(
  'ForestOwnerGroupReconciliationJob',
  forestOwnerGroupReconciliationJobSchema,
);

export default ForestOwnerGroupReconciliationJob;

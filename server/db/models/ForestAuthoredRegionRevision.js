import mongoose from 'mongoose';
import forestAuthoredRegionRevisionSchema from '../schemas/ForestAuthoredRegionRevisionSchema.js';

const ForestAuthoredRegionRevision = mongoose.model(
  'ForestAuthoredRegionRevision',
  forestAuthoredRegionRevisionSchema,
  'forest-authored-region-revisions'
);

export default ForestAuthoredRegionRevision;

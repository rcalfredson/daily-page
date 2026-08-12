import { Schema } from 'mongoose';

export const FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION = 1;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function safeInteger(minimum = Number.MIN_SAFE_INTEGER) {
  return {
    validator: value => Number.isSafeInteger(value) && value >= minimum,
    message: props => `${props.path} must be a safe integer of at least ${minimum}.`
  };
}

const forestAuthoredRegionRevisionSchema = new Schema({
  schemaVersion: {
    type: Number,
    required: true,
    enum: [FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION],
    default: FOREST_AUTHORED_REGION_REVISION_SCHEMA_VERSION,
    immutable: true
  },
  forestId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 36,
    maxlength: 36,
    match: UUID_V4_PATTERN
  },
  ownerUserId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 24,
    maxlength: 24,
    match: OBJECT_ID_PATTERN
  },
  spatialIndexVersion: {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(1)
  },
  cellX: { type: Number, required: true, immutable: true, validate: safeInteger() },
  cellY: { type: Number, required: true, immutable: true, validate: safeInteger() },
  revision: { type: Number, required: true, default: 1, validate: safeInteger(1) }
}, {
  strict: 'throw',
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

forestAuthoredRegionRevisionSchema.index(
  { ownerUserId: 1, forestId: 1, spatialIndexVersion: 1, cellX: 1, cellY: 1 },
  { unique: true, name: 'unique_forest_authored_region_revision_cell' }
);
forestAuthoredRegionRevisionSchema.index(
  { ownerUserId: 1, _id: 1 },
  { name: 'forest_authored_region_revision_deletion' }
);

export default forestAuthoredRegionRevisionSchema;

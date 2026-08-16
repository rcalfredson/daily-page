import { Schema } from 'mongoose';

export const FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION = 1;
export const FOREST_AUTHORED_RESET_OPERATION_VERSION = 1;
export const FOREST_AUTHORED_RESET_OPERATION_STATUSES = Object.freeze([
  'processing',
  'completed'
]);

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function safeInteger(minimum = Number.MIN_SAFE_INTEGER) {
  return {
    validator: value => Number.isSafeInteger(value) && value >= minimum,
    message: props => `${props.path} must be a safe integer of at least ${minimum}.`
  };
}

const forestAuthoredResetOperationSchema = new Schema({
  schemaVersion: {
    type: Number,
    required: true,
    enum: [FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION],
    default: FOREST_AUTHORED_RESET_OPERATION_SCHEMA_VERSION,
    immutable: true
  },
  operationVersion: {
    type: Number,
    required: true,
    enum: [FOREST_AUTHORED_RESET_OPERATION_VERSION],
    default: FOREST_AUTHORED_RESET_OPERATION_VERSION,
    immutable: true
  },
  resetId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 36,
    maxlength: 36,
    match: UUID_V4_PATTERN
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
  status: {
    type: String,
    required: true,
    enum: FOREST_AUTHORED_RESET_OPERATION_STATUSES,
    default: 'processing'
  },
  afterObjectId: {
    type: String,
    minlength: 36,
    maxlength: 36,
    match: UUID_V4_PATTERN,
    default: null
  },
  affectedObjectCount: {
    type: Number,
    required: true,
    default: 0,
    validate: safeInteger(0)
  },
  authoredObjectSchemaVersion: {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(1)
  },
  spatialIndexVersion: {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(1)
  },
  startedAt: { type: Date, required: true, immutable: true },
  completedAt: { type: Date, default: null }
}, {
  strict: 'throw',
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

forestAuthoredResetOperationSchema.pre('validate', function validateStatus() {
  if (this.status === 'processing' && this.completedAt) {
    this.invalidate('completedAt', 'A processing authored reset cannot be complete.');
  }
  if (this.status === 'completed' && !this.completedAt) {
    this.invalidate('completedAt', 'A completed authored reset requires a completion time.');
  }
  if (this.startedAt && this.completedAt && this.completedAt < this.startedAt) {
    this.invalidate('completedAt', 'An authored reset cannot complete before it starts.');
  }
});

forestAuthoredResetOperationSchema.index(
  { ownerUserId: 1, forestId: 1, resetId: 1 },
  { unique: true, name: 'unique_forest_authored_reset_operation_id' }
);
forestAuthoredResetOperationSchema.index(
  { ownerUserId: 1, forestId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'processing' },
    name: 'unique_forest_authored_reset_processing'
  }
);
forestAuthoredResetOperationSchema.index(
  { status: 1, updatedAt: 1, _id: 1 },
  { name: 'forest_authored_reset_worker' }
);
forestAuthoredResetOperationSchema.index(
  { status: 1, completedAt: 1, _id: 1 },
  { name: 'forest_authored_reset_retention' }
);
forestAuthoredResetOperationSchema.index(
  { ownerUserId: 1, _id: 1 },
  { name: 'forest_authored_reset_deletion' }
);

export default forestAuthoredResetOperationSchema;

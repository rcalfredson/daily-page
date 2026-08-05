import { Schema } from 'mongoose';

export const FOREST_OWNER_GROUP_RECONCILIATION_JOB_SCHEMA_VERSION = 1;
export const FOREST_OWNER_GROUP_RECONCILIATION_JOB_STATUSES = Object.freeze([
  'pending',
  'failed',
]);

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,79}$/;

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

const forestOwnerGroupReconciliationJobSchema = new Schema({
  schemaVersion: {
    type: Number,
    required: true,
    enum: [FOREST_OWNER_GROUP_RECONCILIATION_JOB_SCHEMA_VERSION],
    default: FOREST_OWNER_GROUP_RECONCILIATION_JOB_SCHEMA_VERSION,
    immutable: true,
  },
  ownerUserId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 24,
    maxlength: 24,
    match: OBJECT_ID_PATTERN,
  },
  translationGroupId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 24,
    maxlength: 24,
    match: OBJECT_ID_PATTERN,
  },
  status: {
    type: String,
    required: true,
    enum: FOREST_OWNER_GROUP_RECONCILIATION_JOB_STATUSES,
    default: 'pending',
  },
  requestedRevision: {
    type: Number,
    required: true,
    validate: {
      validator: positiveSafeInteger,
      message: 'requestedRevision must be a positive safe integer.',
    },
  },
  attempts: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: nonNegativeSafeInteger,
      message: 'attempts must be a non-negative safe integer.',
    },
  },
  availableAt: { type: Date, required: true },
  leaseToken: {
    type: String,
    minlength: 22,
    maxlength: 128,
    match: BASE64URL_PATTERN,
    default: null,
  },
  leaseExpiresAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: null },
  lastErrorCode: {
    type: String,
    minlength: 1,
    maxlength: 80,
    match: ERROR_CODE_PATTERN,
    default: null,
  },
}, {
  strict: 'throw',
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } },
});

forestOwnerGroupReconciliationJobSchema.pre('validate', function validateLeaseState() {
  const hasToken = this.leaseToken !== null;
  const hasExpiry = this.leaseExpiresAt !== null;
  if (hasToken !== hasExpiry) {
    this.invalidate('leaseToken', 'A reconciliation lease requires both token and expiry.');
  }
  if (this.status === 'failed' && (hasToken || hasExpiry)) {
    this.invalidate('status', 'A failed reconciliation job cannot retain a lease.');
  }
});

forestOwnerGroupReconciliationJobSchema.index(
  { ownerUserId: 1, translationGroupId: 1 },
  { unique: true, name: 'unique_forest_owner_group_reconciliation_job' },
);
forestOwnerGroupReconciliationJobSchema.index(
  { status: 1, availableAt: 1, leaseExpiresAt: 1, _id: 1 },
  { name: 'forest_owner_group_reconciliation_worker' },
);
forestOwnerGroupReconciliationJobSchema.index(
  { ownerUserId: 1, _id: 1 },
  { name: 'forest_owner_group_reconciliation_deletion' },
);

export default forestOwnerGroupReconciliationJobSchema;

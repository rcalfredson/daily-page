import { Schema } from 'mongoose';

export const ACCOUNT_WRITING_DISPOSITIONS = Object.freeze([
  'delete',
  'deleted-author',
  'anonymous'
]);

export const ACCOUNT_DELETION_PROFILE_MEDIA_STATUSES = Object.freeze([
  'pending',
  'deleted',
  'not-managed',
  'none'
]);

export const ACCOUNT_DELETION_FOREST_CLEANUP_STATUSES = Object.freeze([
  'not-required',
  'pending',
  'completed'
]);

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

const forestCleanupSchema = new Schema({
  status: {
    type: String,
    required: true,
    enum: ACCOUNT_DELETION_FOREST_CLEANUP_STATUSES,
    default: 'not-required'
  },
  attempts: {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: nonNegativeSafeInteger,
      message: 'Forest cleanup attempts must be a non-negative safe integer.'
    }
  },
  lastAttemptAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { _id: false, strict: true });

forestCleanupSchema.pre('validate', function validateForestCleanupState() {
  if (this.status === 'completed' && !this.completedAt) {
    this.invalidate('completedAt', 'Completed forest cleanup requires a completion time.');
  }
  if (this.status !== 'completed' && this.completedAt) {
    this.invalidate('completedAt', 'Incomplete forest cleanup cannot have a completion time.');
  }
});

const accountDeletionRequestSchema = new Schema({
  ownerUserId: { type: String, required: true, unique: true, index: true },
  disposition: {
    type: String,
    required: true,
    enum: ACCOUNT_WRITING_DISPOSITIONS
  },
  status: {
    type: String,
    required: true,
    enum: ['processing', 'completed'],
    index: true
  },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  evidenceExpiresAt: { type: Date, default: null },
  counts: {
    retainedPosts: { type: Number, default: 0 },
    deletedPosts: { type: Number, default: 0 }
  },
  profileMedia: {
    url: { type: String, default: null },
    status: {
      type: String,
      enum: ACCOUNT_DELETION_PROFILE_MEDIA_STATUSES,
      default: 'none'
    },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null }
  },
  forestCleanup: {
    type: forestCleanupSchema,
    required: true,
    default: () => ({})
  }
}, {
  strict: true,
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

accountDeletionRequestSchema.index({ evidenceExpiresAt: 1 }, { expireAfterSeconds: 0 });
accountDeletionRequestSchema.index({ 'profileMedia.status': 1, completedAt: 1 });
accountDeletionRequestSchema.index(
  { 'forestCleanup.status': 1, completedAt: 1 },
  { name: 'account_deletion_forest_cleanup' }
);
accountDeletionRequestSchema.index(
  {
    status: 1,
    evidenceExpiresAt: 1,
    'profileMedia.status': 1,
    'forestCleanup.status': 1,
    completedAt: 1
  },
  { name: 'account_deletion_cleanup_convergence' }
);

export default accountDeletionRequestSchema;

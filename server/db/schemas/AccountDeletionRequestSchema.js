import { Schema } from 'mongoose';

export const ACCOUNT_WRITING_DISPOSITIONS = Object.freeze([
  'delete',
  'deleted-author',
  'anonymous'
]);

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
      enum: ['pending', 'deleted', 'not-managed', 'none'],
      default: 'none'
    },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null }
  }
}, {
  strict: true,
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

accountDeletionRequestSchema.index({ evidenceExpiresAt: 1 }, { expireAfterSeconds: 0 });
accountDeletionRequestSchema.index({ 'profileMedia.status': 1, completedAt: 1 });

export default accountDeletionRequestSchema;

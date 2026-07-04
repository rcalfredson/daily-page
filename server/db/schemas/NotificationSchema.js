// server/db/schemas/NotificationSchema.js
import { Schema } from 'mongoose';

export const QUEST_NOTIFICATION_TYPES = Object.freeze([
  'quest_review_requested',
  'quest_changes_requested',
  'quest_submission_approved',
  'quest_submission_rejected',
  'quest_submission_revoked',
  'quest_claim_expired'
]);

export const NOTIFICATION_TYPES = Object.freeze([
  'block_comment',
  'comment_reply',
  ...QUEST_NOTIFICATION_TYPES
]);

const notificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },       // recipient
    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
      index: true
    },
    actorUserId: { type: String, default: null, index: true },  // initiator; null for system events
    blockId: { type: String, default: null, index: true },
    commentId: { type: String, default: null, index: true },
    questId: { type: String, default: null, index: true },
    questSubmissionId: { type: String, default: null, index: true },
    questItemId: { type: String, default: null, index: true },
    dedupeKey: { type: String, default: null, maxlength: 500 },

    readAt: { type: Date, default: null },
    emailedAt: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now }
  },
  {
    strict: true,
    timestamps: false,
    toObject: { transform: (doc, ret) => { delete ret.__v; } },
    toJSON: { transform: (doc, ret) => { delete ret.__v; } },
  }
);

notificationSchema.pre('validate', function validateNotificationReferences() {
  if (['block_comment', 'comment_reply'].includes(this.type)) {
    if (!this.actorUserId) this.invalidate('actorUserId', 'Comment notifications require an actor.');
    if (!this.blockId) this.invalidate('blockId', 'Comment notifications require a block.');
    if (!this.commentId) this.invalidate('commentId', 'Comment notifications require a comment.');
    return;
  }

  if (QUEST_NOTIFICATION_TYPES.includes(this.type)) {
    if (!this.questId) this.invalidate('questId', 'Quest notifications require a quest.');
    if (!this.dedupeKey) this.invalidate('dedupeKey', 'Quest notifications require a dedupe key.');
    if (this.type !== 'quest_claim_expired' && !this.questSubmissionId) {
      this.invalidate('questSubmissionId', 'Quest workflow notifications require a submission.');
    }
    if (this.type === 'quest_claim_expired' && !this.questSubmissionId && !this.questItemId) {
      this.invalidate('questItemId', 'Quest claim expiry requires a submission or item.');
    }
  }
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    name: 'unique_quest_notification_event',
    partialFilterExpression: { dedupeKey: { $type: 'string' } }
  }
);

export default notificationSchema;

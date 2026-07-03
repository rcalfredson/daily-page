import { Schema } from 'mongoose';

export const QUEST_SUBMISSION_STATUSES = Object.freeze([
  'draft',
  'pending',
  'changes-requested',
  'approved',
  'rejected',
  'withdrawn',
  'revoked'
]);

export const TERMINAL_QUEST_SUBMISSION_STATUSES = Object.freeze([
  'rejected',
  'withdrawn',
  'revoked'
]);

const reviewHistoryEventSchema = new Schema({
  type: { type: String, required: true, trim: true, maxlength: 80 },
  actorType: { type: String, required: true, enum: ['user', 'system'] },
  actorUserId: { type: String, default: null },
  occurredAt: { type: Date, required: true, default: Date.now },
  fromStatus: { type: String, enum: [...QUEST_SUBMISSION_STATUSES, null], default: null },
  toStatus: { type: String, required: true, enum: QUEST_SUBMISSION_STATUSES },
  comment: { type: String, trim: true, maxlength: 4000, default: null },
  blockUpdatedAt: { type: Date, default: null },
  reasonCode: { type: String, trim: true, maxlength: 80, default: null }
}, { _id: true });

reviewHistoryEventSchema.pre('validate', function validateReviewActor() {
  if (this.actorType === 'user' && !this.actorUserId) {
    this.invalidate('actorUserId', 'User review events require actorUserId.');
  }
  if (this.actorType === 'system' && this.actorUserId) {
    this.invalidate('actorUserId', 'System review events cannot have actorUserId.');
  }
});

const questSubmissionSchema = new Schema({
  questId: { type: String, required: true, index: true },
  questItemId: { type: String, default: null, index: true },
  ownerUserId: { type: String, required: true, index: true },
  blockId: { type: String, required: true, index: true },
  blockGroupId: { type: String, required: true, index: true },
  status: { type: String, required: true, enum: QUEST_SUBMISSION_STATUSES, default: 'draft', index: true },
  submittedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  approvedSequence: { type: Number, min: 1, default: null },
  reviewedBlockUpdatedAt: { type: Date, default: null },
  contributorUserIds: { type: [String], default: [] },
  reviewHistory: { type: [reviewHistoryEventSchema], default: [] },
  supersedesSubmissionId: { type: String, default: null },
  replacementSubmissionId: { type: String, default: null }
}, {
  strict: true,
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

questSubmissionSchema.pre('validate', function validateQuestSubmission() {
  if (new Set(this.contributorUserIds || []).size !== (this.contributorUserIds || []).length) {
    this.invalidate('contributorUserIds', 'Quest contributor snapshots must be deduplicated.');
  }

  if (this.status === 'approved') {
    if (!this.approvedAt || !this.approvedSequence || !this.reviewedBlockUpdatedAt) {
      this.invalidate('status', 'Approved quest submissions require approval metadata.');
    }
  }
});

questSubmissionSchema.index({ questId: 1, status: 1, createdAt: -1 });
questSubmissionSchema.index({ ownerUserId: 1, status: 1, updatedAt: -1 });
questSubmissionSchema.index({ questId: 1, blockId: 1, status: 1 });
questSubmissionSchema.index({ questId: 1, questItemId: 1, status: 1 });
questSubmissionSchema.index({ contributorUserIds: 1, status: 1, approvedAt: 1 });
questSubmissionSchema.index({ questId: 1, approvedSequence: 1 });

export default questSubmissionSchema;

import { Schema } from 'mongoose';

const questItemSchema = new Schema({
  questId: { type: String, required: true, index: true },
  key: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minlength: 1,
    maxlength: 160,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  },
  label: { type: String, required: true, trim: true, maxlength: 240 },
  label_i18n: { type: Map, of: String, default: undefined },
  active: { type: Boolean, default: true, index: true },
  reservedByUserId: { type: String, default: null, index: true },
  reservedUntil: { type: Date, default: null, index: true },
  activeSubmissionId: { type: String, default: null, index: true },
  approvedSubmissionId: { type: String, default: null, index: true }
}, {
  strict: true,
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

questItemSchema.pre('validate', function validateQuestItem() {
  const hasClaimant = Boolean(this.reservedByUserId);
  const hasDeadline = Boolean(this.reservedUntil);
  if (hasClaimant !== hasDeadline && !this.activeSubmissionId) {
    this.invalidate('reservedUntil', 'Unattached quest item reservations require both claimant and deadline.');
  }
  if (this.approvedSubmissionId && this.activeSubmissionId !== this.approvedSubmissionId) {
    this.invalidate('approvedSubmissionId', 'Approved submission must also be the active item submission.');
  }
});

questItemSchema.index({ questId: 1, key: 1 }, { unique: true });
questItemSchema.index({ questId: 1, active: 1, approvedSubmissionId: 1 });
questItemSchema.index({ questId: 1, reservedUntil: 1 });

export default questItemSchema;

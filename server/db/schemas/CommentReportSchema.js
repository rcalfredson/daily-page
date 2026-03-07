import { Schema } from 'mongoose';

const commentReportSchema = new Schema(
  {
    commentId: { type: String, required: true, index: true },
    reporterId: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    strict: true,
    timestamps: false,
    toObject: { transform: (doc, ret) => { delete ret.__v; } },
    toJSON: { transform: (doc, ret) => { delete ret.__v; } },
  }
);

// Enforce one report per user per comment
commentReportSchema.index({ commentId: 1, reporterId: 1 }, { unique: true });

// Helpful for counting / review tooling later
commentReportSchema.index({ commentId: 1, createdAt: -1 });

export default commentReportSchema;

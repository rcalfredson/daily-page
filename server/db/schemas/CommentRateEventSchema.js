import { Schema } from 'mongoose';

const commentRateEventSchema = new Schema(
  {
    userId: { type: String, default: null, index: true },
    ipHash: { type: String, required: true, index: true },
    kind: { type: String, enum: ['comment'], required: true, index: true },
    hasUrl: { type: Boolean, default: false, index: true },

    createdAt: { type: Date, default: Date.now }
  },
  {
    strict: true,
    timestamps: false,
    toObject: { transform: (doc, ret) => { delete ret.__v; } },
    toJSON: { transform: (doc, ret) => { delete ret.__v; } }
  }
);

// TTL: automatically delete after 1 day (keeps collection small)
commentRateEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

commentRateEventSchema.index({ userId: 1, kind: 1, createdAt: -1 });
commentRateEventSchema.index({ ipHash: 1, kind: 1, createdAt: -1 });
commentRateEventSchema.index({ ipHash: 1, kind: 1, hasUrl: 1, createdAt: -1 });

export default commentRateEventSchema;

// server/db/schemas/NotificationSchema.js
import { Schema } from 'mongoose';

const notificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },       // recipient
    type: {
      type: String,
      required: true,
      enum: ['block_comment'],
      index: true
    },
    actorUserId: { type: String, required: true, index: true },  // initiator
    blockId: { type: String, required: true, index: true },
    commentId: { type: String, default: null, index: true },

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

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export default notificationSchema;

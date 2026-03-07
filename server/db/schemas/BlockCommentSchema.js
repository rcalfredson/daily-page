// server/db/schemas/BlockCommentSchema.js
import { Schema } from 'mongoose';

const blockCommentSchema = new Schema(
  {
    blockId: { type: String, required: true, index: true }, // block._id (stringified)
    userId: { type: String, required: true, index: true },  // user.id from JWT

    body: { type: String, required: true, trim: true, maxlength: 1500 },

    // For future slices (moderation + UX), safe to include now:
    status: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
      index: true
    },

    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
    hiddenAt: { type: Date, default: null },

    // Optional: if you want to prep for “reply to comment” later without threading UI:
    // replyToCommentId: { type: String, default: null, index: true },
  },
  {
    strict: true,
    timestamps: true,
    toObject: { transform: (doc, ret) => { delete ret.__v; } },
    toJSON: { transform: (doc, ret) => { delete ret.__v; } },
  }
);

// Fast “latest comments for this block”
blockCommentSchema.index({ blockId: 1, createdAt: 1 });

// Optional: show a user’s comment history quickly (profile/admin tooling later)
blockCommentSchema.index({ userId: 1, createdAt: -1 });

// Helpful if you ever query “visible comments only”
blockCommentSchema.index({ blockId: 1, status: 1, createdAt: 1 });

export default blockCommentSchema;

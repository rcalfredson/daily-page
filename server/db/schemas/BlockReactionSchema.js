import { Schema } from 'mongoose';

const blockReactionSchema = new Schema(
  {
    blockId: { type: String, required: true, index: true }, // block._id (stringified)
    userId: { type: String, required: true, index: true },  // user.id from JWT
    type: {
      type: String,
      required: true,
      enum: ['heart', 'leaf', 'wow', 'laugh'],
      index: true
    },
  },
  {
    strict: true,
    timestamps: true,
    toObject: { transform: (doc, ret) => { delete ret.__v; } },
    toJSON: { transform: (doc, ret) => { delete ret.__v; } },
  }
);

// Enforce: one reaction per user per type per block
blockReactionSchema.index({ blockId: 1, userId: 1, type: 1 }, { unique: true });

// Optional but helpful for “recent reactions” features later:
blockReactionSchema.index({ blockId: 1, createdAt: -1 });

export default blockReactionSchema;

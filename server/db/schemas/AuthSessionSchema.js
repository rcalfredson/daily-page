import { Schema } from 'mongoose';

const authSessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  remembered: { type: Boolean, default: false },
  userAgentHash: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  absoluteExpiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null, index: true },
}, {
  toObject: {
    transform: function (doc, ret) { delete ret.__v; }
  },
  toJSON: {
    transform: function (doc, ret) { delete ret.__v; }
  }
});

authSessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 });

export default authSessionSchema;

import { Schema } from 'mongoose';

const usernameReservationSchema = new Schema({
  _id: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  reason: { type: String, enum: ['account-deleted'], required: true }
}, {
  strict: true,
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

usernameReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default usernameReservationSchema;

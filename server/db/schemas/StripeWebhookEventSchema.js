import { Schema } from 'mongoose';

const stripeWebhookEventSchema = new Schema(
  {
    _id: { type: String, required: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  {
    strict: true,
    timestamps: false,
    toObject: { transform: (doc, ret) => { delete ret.__v; } },
    toJSON: { transform: (doc, ret) => { delete ret.__v; } },
  }
);

export default stripeWebhookEventSchema;

import { Schema } from 'mongoose';

const supportSubscriptionSchema = new Schema(
  {
    stripeSubscriptionId: { type: String, required: true, unique: true, index: true },
    stripeCustomerId: { type: String, default: null, index: true },
    stripePriceId: { type: String, required: true, index: true },
    status: { type: String, required: true, index: true },
    currency: { type: String, default: 'usd' },
    amountUsdMonthly: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true, default: 1 },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    latestInvoiceId: { type: String, default: null },
    lastStripeEventId: { type: String, default: null },
  },
  {
    strict: true,
    timestamps: true,
    toObject: { transform: (doc, ret) => { delete ret.__v; } },
    toJSON: { transform: (doc, ret) => { delete ret.__v; } },
  }
);

supportSubscriptionSchema.index({ stripePriceId: 1, status: 1 });

export default supportSubscriptionSchema;

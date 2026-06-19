import mongoose from 'mongoose';
import stripeWebhookEventSchema from '../schemas/StripeWebhookEventSchema.js';

export default mongoose.models.StripeWebhookEvent ||
  mongoose.model('StripeWebhookEvent', stripeWebhookEventSchema);

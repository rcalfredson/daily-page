import mongoose from 'mongoose';
import supportSubscriptionSchema from '../schemas/SupportSubscriptionSchema.js';

export default mongoose.models.SupportSubscription ||
  mongoose.model('SupportSubscription', supportSubscriptionSchema);

// server/db/models/Notification.js
import mongoose from 'mongoose';
import notificationSchema from '../schemas/NotificationSchema.js';

export default mongoose.models.Notification ||
  mongoose.model('Notification', notificationSchema);

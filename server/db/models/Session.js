import mongoose from 'mongoose';
import sessionSchema from '../schemas/SessionSchema.js';

const Session = mongoose.model('Session', sessionSchema, 'session-data');

export default Session;

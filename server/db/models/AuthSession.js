import mongoose from 'mongoose';
import authSessionSchema from '../schemas/AuthSessionSchema.js';

const AuthSession = mongoose.model('AuthSession', authSessionSchema, 'auth-sessions');

export default AuthSession;

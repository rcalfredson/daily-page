import mongoose from 'mongoose';
import userSchema from '../schemas/UserSchema.js';

const User = mongoose.model('User', userSchema, 'users');

export default User;

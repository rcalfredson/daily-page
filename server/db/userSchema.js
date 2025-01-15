import mongoose from 'mongoose';

const { Schema } = mongoose;

// Define the schema
const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: '/assets/img/default-pic.png' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Determine the collection name dynamically
const collectionSuffix = process.env.NODE_ENV === 'production' ? '' : '-test';
const collectionName = `users${collectionSuffix}`;

// Export the model with the dynamic collection name
export default mongoose.model('User', userSchema, collectionName);

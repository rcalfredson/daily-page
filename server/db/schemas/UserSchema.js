import { Schema } from 'mongoose';

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  verificationTokenExpires: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  profilePic: { type: String, default: '/assets/img/default-pic.png' },
  bio: { type: String, default: '' },
  streakLength: { type: Number, default: 0 },
  streakLastUpdatedAt: { type: Date, default: null },
  starredRooms: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  strict: false, toObject: {
    transform: function (doc, ret) { delete ret.__v; }
  },
  toJSON: {
    transform: function (doc, ret) { delete ret.__v; }
  }
});

export default userSchema;

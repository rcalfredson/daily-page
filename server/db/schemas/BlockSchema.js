import { Schema } from 'mongoose';

const blockSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, default: '' },
  roomId: { type: String, required: true, index: true },
  creator: { type: String, required: true },
  collaborators: { type: [String], default: [] },
  type: { type: String, enum: ['public', 'private'], default: 'public' },
  status: { type: String, enum: ['in-progress', 'locked', 'archived'], default: 'in-progress' },
  votes: {
    up: { type: Number, default: 0 },
    down: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lockedAt: { type: Date },
}, {
  strict: false,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } },
});

export default blockSchema;

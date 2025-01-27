import { Schema } from 'mongoose';

const blockSchema = new Schema({
  title: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 100,
    trim: true
  },
  description: { type: String, default: '' },
  tags: { type: [String], default: [], index: true },
  content: { type: String, default: '' },
  roomId: { type: String, required: true, index: true },
  creator: { type: String, required: true },
  editToken: { type: String, required: false },
  collaborators: { type: [String], default: [] },
  type: { type: String, enum: ['public', 'private'], default: 'public' },
  status: {
    type: String,
    enum: ['in-progress', 'locked', 'archived'],
    default: 'in-progress',
    index: true
  },
  votes: {
    up: { type: Number, default: 0 },
    down: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  lockedAt: { type: Date },
}, {
  strict: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } },
});

export default blockSchema;

import { Schema } from 'mongoose';

const flagSchema = new Schema({
  blockId: {
    type: Schema.Types.ObjectId,
    ref: 'Block',
    required: true,
    index: true,
  },
  reason: {
    type: String,
    enum: ['spam','offensive','inappropriate','other'],
    required: true,
  },
  description: {
    type: String,
    default: '',
    maxlength: 1000,
  },
  reporter: {
    // If you have users, you can store userId; otherwise leave optional
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['open','reviewed','dismissed'],
    default: 'open',
  }
}, {
  timestamps: true,
  toJSON: { versionKey: false },
  toObject: { versionKey: false }
});

export default flagSchema;

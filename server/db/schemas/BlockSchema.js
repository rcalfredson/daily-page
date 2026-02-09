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
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  status: {
    type: String,
    enum: ['in-progress', 'locked'],
    default: 'in-progress',
    index: true
  },
  votes: {
    type: [
      {
        userId: { type: String, required: true },
        type: { type: String, enum: ['upvote', 'downvote'], required: true },
      },
    ],
    default: [],
  },
  voteCount: { type: Number, default: 0 },
  lockedAt: { type: Date },

  groupId: {
    type: String,
    required: true,
    index: true,
  },
  lang: {
    type: String,       // ISO 639-1
    required: true,
    index: true,
    minlength: 2,
    maxlength: 5,
  },

  // 🌍 Translation attribution fields:
  originalAuthor: {
    type: String,  // user._id
    required: false,
  },
  originalBlock: {
    type: String,  // block._id
    required: false,
  },

}, {
  strict: true,
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } },
});

// 🧠 Unique pair: one language per group
blockSchema.index({ groupId: 1, lang: 1 }, { unique: true });

blockSchema.index({ creator: 1, createdAt: -1 });
blockSchema.index({ collaborators: 1, createdAt: -1 });

// Text search index for MVP search
// Notes:
// - default_language: "none" avoids stemming/stopword behavior that can get weird across mixed languages.
// - weights let title/tags punch above their weight.
blockSchema.index(
  { title: 'text', content: 'text', tags: 'text', description: 'text' },
  {
    name: 'block_text_search',
    default_language: 'none',
    weights: { title: 10, tags: 6, description: 4, content: 1 },
  }
);

export default blockSchema;

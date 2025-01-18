import { Schema } from 'mongoose';

const backupSchema = new Schema(
  {
    _id: String,
    ts: Number,
  },
  {
    strict: false, toObject: {
      transform: function (doc, ret) { delete ret.__v; }
    },
    toJSON: {
      transform: function (doc, ret) { delete ret.__v; }
    }
  }
);

export default backupSchema;

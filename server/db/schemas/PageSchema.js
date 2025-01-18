import { Schema } from 'mongoose';

const pageSchema = new Schema({
  date: String,
  room: String,
  year: String,
  month: String,
  day: String,
  content: String,
  lastUpdate: Number
}, {
  strict: false, toObject: {
    transform: function (doc, ret) { delete ret.__v; }
  },
  toJSON: {
    transform: function (doc, ret) { delete ret.__v; }
  }
});

export default pageSchema;

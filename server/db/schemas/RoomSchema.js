import { Schema } from 'mongoose';

const roomSchema = new Schema({
  _id: String,
  topic: String,
  name: String,
  description: String,
  name_i18n: { type: Map, of: String, default: undefined },
  description_i18n: { type: Map, of: String, default: undefined }
}, {
  strict: false, toObject: {
    transform: function (doc, ret) { delete ret.__v; }
  },
  toJSON: {
    transform: function (doc, ret) { delete ret.__v; }
  }
});

export default roomSchema;

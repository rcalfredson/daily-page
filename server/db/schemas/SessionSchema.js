import { Schema } from 'mongoose';

const sessionSchema = new Schema({
  _id: String,
  peers: {
    type: Object,
    default: {}
  }
}, {
  strict: false, toObject: {
    transform: function (doc, ret) { delete ret.__v; }
  },
  toJSON: {
    transform: function (doc, ret) { delete ret.__v; }
  }
});

export default sessionSchema;

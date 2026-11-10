import { Schema } from 'mongoose';
import { GARDEN_CAPACITY, CUTTING_CAPACITY } from '../../../public/js/forest-garden-rules.js';
const integer = { validator: Number.isSafeInteger, message: 'Expected safe integer.' };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const plant = new Schema({
  plantId: { type: String, required: true, match: uuid },
  worldX: { type: Number, required: true, min: -1e9, max: 1e9, validate: integer },
  worldY: { type: Number, required: true, min: -1e9, max: 1e9, validate: integer },
  plantedAt: { type: Date, required: true },
  readyAt: { type: Date, required: true }
}, { _id: false, strict: 'throw' });
const schema = new Schema({
  schemaVersion: { type: Number, required: true, enum: [1] },
  ownerUserId: { type: String, required: true, match: /^[a-f0-9]{24}$/, immutable: true },
  forestId: { type: String, required: true, match: uuid, immutable: true },
  revision: { type: Number, required: true, min: 1, validate: integer },
  cuttings: { type: Number, required: true, min: 0, max: CUTTING_CAPACITY, validate: integer },
  plants: { type: [plant], required: true, validate: {
    validator: v => v.length <= GARDEN_CAPACITY && new Set(v.map(p => p.plantId)).size === v.length,
    message: 'Garden capacity or duplicate identity.'
  } },
  lastCommand: { type: String, required: true, match: /^[A-Za-z0-9_-]{43}$/ },
  changedAt: { type: Date, required: true }
}, { strict: 'throw', versionKey: false });
schema.index({ ownerUserId: 1, forestId: 1 }, { unique: true, name: 'forest_garden_owner' });
export default schema;

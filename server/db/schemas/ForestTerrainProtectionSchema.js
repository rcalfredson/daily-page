import { Schema } from 'mongoose';

const integer = { validator: Number.isSafeInteger, message: 'Expected a safe integer.' };
const forestTerrainProtectionSchema = new Schema({
  schemaVersion: { type: Number, required: true, enum: [1], immutable: true },
  ownerUserId: { type: String, required: true, match: /^[a-f0-9]{24}$/, immutable: true },
  forestId: { type: String, required: true, match: /^[a-f0-9-]{36}$/, immutable: true },
  activationId: { type: String, required: true, match: /^[a-f0-9-]{36}$/, immutable: true },
  sourceKey: { type: String, required: true, maxlength: 90, immutable: true },
  x: { type: Number, required: true, validate: integer, immutable: true },
  y: { type: Number, required: true, validate: integer, immutable: true },
  radius: { type: Number, required: true, min: 24, max: 120, immutable: true },
  districtX: { type: Number, required: true, validate: integer, immutable: true },
  districtY: { type: Number, required: true, validate: integer, immutable: true }
}, { strict: 'throw' });
forestTerrainProtectionSchema.index(
  { ownerUserId: 1, forestId: 1, activationId: 1, sourceKey: 1 },
  { unique: true, name: 'forest_terrain_protection_identity' }
);
forestTerrainProtectionSchema.index(
  { ownerUserId: 1, forestId: 1, activationId: 1, districtX: 1, districtY: 1, sourceKey: 1 },
  { name: 'forest_terrain_protection_district' }
);
export default forestTerrainProtectionSchema;

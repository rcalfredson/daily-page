import { Schema } from 'mongoose';
import { validateHomestead, HOMESTEAD_UUID } from '../../services/forestHomesteadRecord.js';

const identity = { type: String, required: true, match: HOMESTEAD_UUID, immutable: true };
const data = { type: Schema.Types.Mixed, required: true };
const schema = new Schema({
  schemaVersion: { type: Number, required: true, enum: [1, 2, 3] },
  catalogVersion: { type: Number, required: true, enum: [1] },
  ownerUserId: { type: String, required: true, match: /^[a-f0-9]{24}$/, immutable: true },
  forestId: identity, layoutId: identity, homeId: identity, cartId: identity,
  layout: { ...data, immutable: true }, homeDesign: data, cartDesign: { type: Schema.Types.Mixed }, parking: data,
  holdings: data, cartCommitment: data,
  starterSuppliesClaimed: { type: Boolean },
  companion: { type: Schema.Types.Mixed },
  orchard: { type: Schema.Types.Mixed },
  revision: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  receipts: data, changedAt: { type: Date, required: true }
}, { strict: 'throw', versionKey: false, minimize: false });
schema.pre('validate', function validateRecord() {
  validateHomestead(this.toObject(), { ownerUserId: this.ownerUserId, forestId: this.forestId });
});
schema.index({ ownerUserId: 1, forestId: 1 }, { unique: true, name: 'forest_homestead_owner' });
schema.index({ ownerUserId: 1 }, { name: 'forest_homestead_deletion' });
export default schema;

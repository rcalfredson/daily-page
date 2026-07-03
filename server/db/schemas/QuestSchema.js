import { Schema } from 'mongoose';

export const QUEST_STATUSES = Object.freeze(['draft', 'active', 'completed', 'archived']);
export const QUEST_TYPES = Object.freeze(['count', 'set']);
export const DEFAULT_QUEST_RESERVATION_HOURS = 168;
export const DEFAULT_MEDAL_THRESHOLDS = Object.freeze({
  bronze: 0.25,
  silver: 0.5,
  gold: 0.75
});

const badgeAssetPattern = /^\/assets\/img\/quests\/[a-zA-Z0-9/_-]+\.svg$/;

const medalThresholdSchema = new Schema({
  bronze: { type: Number, required: true, min: 0, max: 1, default: 0.25 },
  silver: { type: Number, required: true, min: 0, max: 1, default: 0.5 },
  gold: { type: Number, required: true, min: 0, max: 1, default: 0.75 }
}, { _id: false });

const questSchema = new Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 100,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  },
  type: { type: String, required: true, enum: QUEST_TYPES, immutable: true, index: true },
  status: { type: String, required: true, enum: QUEST_STATUSES, default: 'draft', index: true },
  name_i18n: { type: Map, of: String, required: true },
  description_i18n: { type: Map, of: String, required: true },
  instructions_i18n: { type: Map, of: String, required: true },
  administratorUserId: { type: String, required: true, trim: true, index: true },
  allowedRoomIds: {
    type: [String],
    required: true,
    validate: {
      validator(value) {
        return Array.isArray(value) && value.length > 0 &&
          value.every(Boolean) && new Set(value).size === value.length;
      },
      message: 'Quest allowedRoomIds must be a non-empty, deduplicated list.'
    }
  },
  defaultRoomId: { type: String, required: true, trim: true },
  badgeAssetPath: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator(value) {
        return badgeAssetPattern.test(value) && !value.includes('..');
      },
      message: 'Quest badges must be SVG files under /assets/img/quests/.'
    }
  },
  acceptingSubmissionsAfterCompletion: { type: Boolean, default: false },
  reservationDurationHours: {
    type: Number,
    default: DEFAULT_QUEST_RESERVATION_HOURS,
    min: 1,
    max: 24 * 365,
    validate: { validator: Number.isInteger, message: 'Reservation duration must be an integer.' }
  },
  medalThresholds: {
    type: medalThresholdSchema,
    default: () => ({ ...DEFAULT_MEDAL_THRESHOLDS })
  },
  targetCount: {
    type: Number,
    min: 1,
    validate: { validator: Number.isInteger, message: 'Quest targetCount must be an integer.' },
    default: undefined
  },
  approvalSequenceCounter: { type: Number, min: 0, default: 0, select: false }
}, {
  strict: true,
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

function mapValue(map, key) {
  return typeof map?.get === 'function' ? map.get(key) : map?.[key];
}

questSchema.pre('validate', function validateQuest() {
  for (const field of ['name_i18n', 'description_i18n', 'instructions_i18n']) {
    if (!String(mapValue(this[field], 'en') || '').trim()) {
      this.invalidate(field, `${field} must include a non-empty English value.`);
    }
  }

  if (!this.allowedRoomIds?.includes(this.defaultRoomId)) {
    this.invalidate('defaultRoomId', 'Quest defaultRoomId must be included in allowedRoomIds.');
  }

  if (this.type === 'count' && !Number.isInteger(this.targetCount)) {
    this.invalidate('targetCount', 'Count quests require a positive integer targetCount.');
  }
  if (this.type === 'set' && this.targetCount !== undefined) {
    this.invalidate('targetCount', 'Set quests derive their target from active quest items.');
  }

  const thresholds = this.medalThresholds;
  if (thresholds && !(thresholds.bronze < thresholds.silver && thresholds.silver < thresholds.gold)) {
    this.invalidate('medalThresholds', 'Quest medal thresholds must increase from bronze to gold.');
  }
});

questSchema.index({ status: 1, createdAt: -1 });
questSchema.index({ administratorUserId: 1, status: 1 });

export default questSchema;

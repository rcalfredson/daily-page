import { Schema } from 'mongoose';

export const FOREST_AUTHORED_OBJECT_SCHEMA_VERSION = 1;
export const FOREST_AUTHORED_OBJECT_IDENTITY_VERSION = 1;
export const FOREST_AUTHORED_OBJECT_KINDS = Object.freeze(['personal-marker']);
export const FOREST_AUTHORED_OBJECT_STATES = Object.freeze(['active', 'removed']);
export const FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION = 1;
export const FOREST_AUTHORED_MARKER_APPEARANCE_ID = 'quiet-waymarker';
export const FOREST_AUTHORED_MARKER_APPEARANCE_VERSION = 1;
export const FOREST_AUTHORED_COORDINATE_LIMIT = 1_000_000_000;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function safeInteger(minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER) {
  return {
    validator: value => (
      Number.isSafeInteger(value)
      && value >= minimum
      && value <= maximum
    ),
    message: props => `${props.path} must be a safe integer from ${minimum} through ${maximum}.`
  };
}

function versionField() {
  return {
    type: Number,
    required: true,
    validate: safeInteger(1)
  };
}

const placementSchema = new Schema({
  worldX: {
    type: Number,
    required: true,
    validate: safeInteger(-FOREST_AUTHORED_COORDINATE_LIMIT, FOREST_AUTHORED_COORDINATE_LIMIT)
  },
  worldY: {
    type: Number,
    required: true,
    validate: safeInteger(-FOREST_AUTHORED_COORDINATE_LIMIT, FOREST_AUTHORED_COORDINATE_LIMIT)
  }
}, { _id: false, strict: 'throw' });

const placementIndexSchema = new Schema({
  version: {
    type: Number,
    required: true,
    validate: safeInteger(1)
  },
  cellX: { type: Number, required: true, validate: safeInteger() },
  cellY: { type: Number, required: true, validate: safeInteger() }
}, { _id: false, strict: 'throw' });

const worldVersionEvidenceSchema = new Schema({
  ownerWorldSchemaVersion: versionField(),
  placementPolicyVersion: versionField(),
  environmentPolicyVersion: versionField(),
  environmentSchemaVersion: versionField(),
  worldGenerationVersion: versionField()
}, { _id: false, strict: 'throw' });

const appearanceSchema = new Schema({
  id: {
    type: String,
    required: true,
    enum: [FOREST_AUTHORED_MARKER_APPEARANCE_ID],
    immutable: true
  },
  version: {
    type: Number,
    required: true,
    enum: [FOREST_AUTHORED_MARKER_APPEARANCE_VERSION],
    immutable: true
  }
}, { _id: false, strict: 'throw' });

const creationFingerprintSchema = new Schema({
  version: {
    type: Number,
    required: true,
    enum: [FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION],
    immutable: true
  },
  digest: {
    type: String,
    required: true,
    immutable: true,
    minlength: 43,
    maxlength: 43,
    match: SHA256_BASE64URL_PATTERN
  }
}, { _id: false, strict: 'throw' });

const forestAuthoredObjectSchema = new Schema({
  schemaVersion: {
    type: Number,
    required: true,
    enum: [FOREST_AUTHORED_OBJECT_SCHEMA_VERSION],
    default: FOREST_AUTHORED_OBJECT_SCHEMA_VERSION,
    immutable: true
  },
  identityVersion: {
    type: Number,
    required: true,
    enum: [FOREST_AUTHORED_OBJECT_IDENTITY_VERSION],
    default: FOREST_AUTHORED_OBJECT_IDENTITY_VERSION,
    immutable: true
  },
  objectId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 36,
    maxlength: 36,
    match: UUID_V4_PATTERN
  },
  forestId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 36,
    maxlength: 36,
    match: UUID_V4_PATTERN
  },
  ownerUserId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 24,
    maxlength: 24,
    match: OBJECT_ID_PATTERN
  },
  kind: {
    type: String,
    required: true,
    enum: FOREST_AUTHORED_OBJECT_KINDS,
    immutable: true
  },
  state: {
    type: String,
    required: true,
    enum: FOREST_AUTHORED_OBJECT_STATES,
    default: 'active'
  },
  placement: { type: placementSchema, required: true },
  placementIndex: { type: placementIndexSchema, required: true },
  worldVersionEvidence: {
    type: worldVersionEvidenceSchema,
    required: true
  },
  appearance: { type: appearanceSchema, required: true, immutable: true },
  creationFingerprint: {
    type: creationFingerprintSchema,
    required: true,
    immutable: true
  },
  recordRevision: {
    type: Number,
    required: true,
    default: 1,
    validate: safeInteger(1)
  },
  changedAt: { type: Date, required: true },
  removedAt: { type: Date, default: null },
  purgeEligibleAt: { type: Date, default: null }
}, {
  strict: 'throw',
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

forestAuthoredObjectSchema.pre('validate', function validateLifecycle() {
  const removed = this.state === 'removed';
  if (removed !== Boolean(this.removedAt) || removed !== Boolean(this.purgeEligibleAt)) {
    this.invalidate(
      'state',
      'Removed authored objects require removal and purge timestamps; active objects forbid them.'
    );
  }
  if (removed && this.purgeEligibleAt <= this.removedAt) {
    this.invalidate('purgeEligibleAt', 'Tombstone purge eligibility must follow removal.');
  }
  if (this.changedAt && this.removedAt && this.changedAt.getTime() !== this.removedAt.getTime()) {
    this.invalidate('changedAt', 'Removal must be the authored object\'s latest user-visible change.');
  }
});

forestAuthoredObjectSchema.index(
  { ownerUserId: 1, forestId: 1, objectId: 1 },
  { unique: true, name: 'unique_forest_authored_object_owner_forest_id' }
);
forestAuthoredObjectSchema.index(
  {
    ownerUserId: 1,
    forestId: 1,
    state: 1,
    'placementIndex.version': 1,
    'placementIndex.cellX': 1,
    'placementIndex.cellY': 1,
    objectId: 1
  },
  { name: 'forest_authored_object_spatial_read' }
);
forestAuthoredObjectSchema.index(
  {
    ownerUserId: 1,
    forestId: 1,
    state: 1,
    'placementIndex.cellX': 1,
    'placementIndex.cellY': 1,
    objectId: 1
  },
  { name: 'forest_authored_object_collision_neighborhood' }
);
forestAuthoredObjectSchema.index(
  { state: 1, purgeEligibleAt: 1, _id: 1 },
  { name: 'forest_authored_object_tombstone_purge' }
);
forestAuthoredObjectSchema.index(
  { ownerUserId: 1, forestId: 1, objectId: 1, createdAt: 1 },
  { name: 'forest_authored_object_diagnostic_export' }
);
forestAuthoredObjectSchema.index(
  { ownerUserId: 1, _id: 1 },
  { name: 'forest_authored_object_deletion' }
);

export default forestAuthoredObjectSchema;

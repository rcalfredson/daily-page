import { Schema } from 'mongoose';

export const FOREST_WRITING_TREE_SCHEMA_VERSION = 1;
export const FOREST_WRITING_TREE_IDENTITY_VERSION = 1;
export const FOREST_WRITING_TREE_SOURCE_STATES = Object.freeze(['active', 'inactive']);
export const FOREST_WRITING_TREE_CREATION_SEASONS = Object.freeze([
  'spring',
  'summer',
  'autumn',
  'winter',
  'unknown'
]);

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const FINGERPRINT_PATTERN = /^[a-z0-9@._:-]+$/i;

function safeInteger(minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER) {
  return {
    validator: value => (
      Number.isSafeInteger(value)
      && value >= minimum
      && value <= maximum
    ),
    message: props => (
      `${props.path} must be a safe integer from ${minimum} through ${maximum}.`
    )
  };
}

function versionField() {
  return {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(1)
  };
}

function mutableVersionField() {
  return {
    type: Number,
    required: true,
    validate: safeInteger(1)
  };
}

function codeField({ nullable = false } = {}) {
  return {
    type: String,
    required: !nullable,
    trim: true,
    minlength: 1,
    maxlength: 80,
    match: CODE_PATTERN,
    default: nullable ? null : undefined
  };
}

const foundingSourceSchema = new Schema({
  blockId: {
    type: String,
    required: true,
    lowercase: true,
    minlength: 24,
    maxlength: 24,
    match: OBJECT_ID_PATTERN
  },
  createdAt: { type: Date, required: true }
}, { _id: false, strict: 'throw' });

const placementSchema = new Schema({
  policyVersion: versionField(),
  slot: { type: Number, required: true, validate: safeInteger(0) },
  worldX: { type: Number, required: true, validate: safeInteger() },
  worldY: { type: Number, required: true, validate: safeInteger() }
}, { _id: false, strict: 'throw' });

const placementIndexSchema = new Schema({
  version: mutableVersionField(),
  cellX: { type: Number, required: true, validate: safeInteger() },
  cellY: { type: Number, required: true, validate: safeInteger() }
}, { _id: false, strict: 'throw' });

const originatingEnvironmentSchema = new Schema({
  policyVersion: versionField(),
  schemaVersion: versionField(),
  worldGenerationVersion: versionField(),
  regionId: codeField(),
  habitatId: codeField(),
  groundSurfaceId: codeField(),
  transitionState: codeField()
}, { _id: false, strict: 'throw' });

const projectionSchema = new Schema({
  revision: versionField(),
  schemaVersion: versionField(),
  mappingVersion: versionField(),
  specimenSeed: {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(0, 0xFFFFFFFF)
  },
  phenotypeId: codeField(),
  phenotypeAssetVersion: versionField(),
  creationSeason: {
    type: String,
    required: true,
    enum: FOREST_WRITING_TREE_CREATION_SEASONS
  },
  foliagePaletteId: codeField({ nullable: true }),
  projectionFingerprint: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 240,
    match: FINGERPRINT_PATTERN
  },
  visualFingerprint: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 200,
    match: FINGERPRINT_PATTERN
  }
}, { _id: false, strict: 'throw' });

const policyEvidenceSchema = new Schema({
  ownerWritingPolicyVersion: versionField(),
  ownerVariantSelectionVersion: versionField(),
  writingLifecyclePolicyVersion: versionField()
}, { _id: false, strict: 'throw' });

const forestWritingTreeSchema = new Schema({
  schemaVersion: {
    type: Number,
    required: true,
    enum: [FOREST_WRITING_TREE_SCHEMA_VERSION],
    default: FOREST_WRITING_TREE_SCHEMA_VERSION,
    immutable: true
  },
  writingTreeId: {
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
  translationGroupId: {
    type: String,
    required: true,
    immutable: true,
    lowercase: true,
    minlength: 24,
    maxlength: 24,
    match: OBJECT_ID_PATTERN
  },
  identityVersion: {
    type: Number,
    required: true,
    enum: [FOREST_WRITING_TREE_IDENTITY_VERSION],
    default: FOREST_WRITING_TREE_IDENTITY_VERSION,
    immutable: true
  },
  sourceState: {
    type: String,
    required: true,
    enum: FOREST_WRITING_TREE_SOURCE_STATES,
    default: 'active'
  },
  sourceStateChangedAt: { type: Date, required: true },
  hiddenFromForest: { type: Boolean, required: true, default: false },
  inclusionChangedAt: { type: Date, default: null },
  foundingSource: {
    type: foundingSourceSchema,
    required: true,
    immutable: true
  },
  placement: {
    type: placementSchema,
    required: true,
    immutable: true
  },
  placementIndex: {
    type: placementIndexSchema,
    required: true
  },
  originatingEnvironment: {
    type: originatingEnvironmentSchema,
    required: true,
    immutable: true
  },
  projection: {
    type: projectionSchema,
    required: true,
    immutable: true
  },
  policyEvidence: {
    type: policyEvidenceSchema,
    required: true,
    immutable: true
  },
  lastEligibleReconciliationEpoch: {
    type: Number,
    required: true,
    default: 0,
    validate: safeInteger(0)
  },
  recordRevision: {
    type: Number,
    required: true,
    default: 1,
    validate: safeInteger(1)
  }
}, {
  strict: 'throw',
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

forestWritingTreeSchema.pre('validate', function validateInclusionState() {
  if (this.hiddenFromForest && !this.inclusionChangedAt) {
    this.invalidate('inclusionChangedAt', 'A hidden writing tree requires an inclusion timestamp.');
  }
});

forestWritingTreeSchema.index(
  { ownerUserId: 1, translationGroupId: 1 },
  { unique: true, name: 'unique_forest_writing_tree_owner_group' }
);
forestWritingTreeSchema.index(
  { writingTreeId: 1 },
  { unique: true, name: 'unique_forest_writing_tree_id' }
);
forestWritingTreeSchema.index(
  { forestId: 1, 'placement.slot': 1 },
  { unique: true, name: 'unique_forest_writing_tree_placement_slot' }
);
forestWritingTreeSchema.index(
  {
    ownerUserId: 1,
    sourceState: 1,
    hiddenFromForest: 1,
    'placementIndex.cellX': 1,
    'placementIndex.cellY': 1,
    writingTreeId: 1
  },
  { name: 'forest_writing_tree_spatial_read' }
);
forestWritingTreeSchema.index(
  { ownerUserId: 1, lastEligibleReconciliationEpoch: 1, writingTreeId: 1 },
  { name: 'forest_writing_tree_reconciliation_epoch' }
);
forestWritingTreeSchema.index(
  { ownerUserId: 1, sourceState: 1, writingTreeId: 1 },
  { name: 'forest_writing_tree_lifecycle' }
);

export default forestWritingTreeSchema;

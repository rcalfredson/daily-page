import { Schema } from 'mongoose';

export const FOREST_OWNER_WORLD_SCHEMA_VERSION = 1;
export const FOREST_OWNER_WORLD_ROLES = Object.freeze(['primary']);
export const FOREST_OWNER_WORLD_STATUSES = Object.freeze(['active', 'deleting']);
export const FOREST_OWNER_RECONCILIATION_STATES = Object.freeze(['idle', 'running']);
export const FOREST_OWNER_RECONCILIATION_PHASES = Object.freeze([
  'owner-blocks',
  'unseen-trees'
]);

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function safeInteger(minimum = Number.MIN_SAFE_INTEGER) {
  return {
    validator: value => Number.isSafeInteger(value) && value >= minimum,
    message: props => `${props.path} must be a safe integer of at least ${minimum}.`
  };
}

const reconciliationSchema = new Schema({
  epoch: {
    type: Number,
    required: true,
    default: 0,
    validate: safeInteger(0)
  },
  state: {
    type: String,
    required: true,
    enum: FOREST_OWNER_RECONCILIATION_STATES,
    default: 'idle'
  },
  phase: {
    type: String,
    enum: [...FOREST_OWNER_RECONCILIATION_PHASES, null],
    default: null
  },
  blockCursor: {
    type: String,
    minlength: 1,
    maxlength: 256,
    default: null
  },
  treeCursor: {
    type: String,
    minlength: 1,
    maxlength: 256,
    default: null
  },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  leaseToken: {
    type: String,
    minlength: 22,
    maxlength: 128,
    match: BASE64URL_PATTERN,
    default: null
  },
  leaseExpiresAt: { type: Date, default: null }
}, {
  _id: false,
  strict: 'throw'
});

reconciliationSchema.pre('validate', function validateReconciliationState() {
  if (this.state === 'idle') {
    if (this.phase !== null
      || this.blockCursor !== null
      || this.treeCursor !== null
      || this.startedAt !== null
      || this.leaseToken !== null
      || this.leaseExpiresAt !== null) {
      this.invalidate('state', 'Idle forest reconciliation cannot retain active work state.');
    }
    return;
  }

  if (!this.phase || !this.startedAt || !this.leaseToken || !this.leaseExpiresAt) {
    this.invalidate(
      'state',
      'Running forest reconciliation requires a phase, start time, lease token, and lease expiry.'
    );
  }
  if (this.epoch < 1) {
    this.invalidate('epoch', 'Running forest reconciliation requires a positive epoch.');
  }
  if (this.startedAt && this.leaseExpiresAt && this.leaseExpiresAt <= this.startedAt) {
    this.invalidate('leaseExpiresAt', 'Forest reconciliation lease must expire after it starts.');
  }
  if (this.phase === 'owner-blocks' && this.treeCursor !== null) {
    this.invalidate('treeCursor', 'Owner-Block reconciliation cannot retain a tree cursor.');
  }
  if (this.phase === 'unseen-trees' && this.blockCursor !== null) {
    this.invalidate('blockCursor', 'Unseen-tree reconciliation cannot retain a Block cursor.');
  }
});

const forestOwnerWorldSchema = new Schema({
  schemaVersion: {
    type: Number,
    required: true,
    enum: [FOREST_OWNER_WORLD_SCHEMA_VERSION],
    default: FOREST_OWNER_WORLD_SCHEMA_VERSION,
    immutable: true
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
  worldRole: {
    type: String,
    required: true,
    enum: FOREST_OWNER_WORLD_ROLES,
    default: 'primary',
    immutable: true
  },
  status: {
    type: String,
    required: true,
    enum: FOREST_OWNER_WORLD_STATUSES,
    default: 'active'
  },
  worldSeed: {
    type: String,
    required: true,
    immutable: true,
    minlength: 32,
    maxlength: 80,
    match: BASE64URL_PATTERN
  },
  placementPolicyVersion: {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(1)
  },
  nextCandidateSlot: {
    type: Number,
    required: true,
    default: 0,
    validate: safeInteger(0)
  },
  placementRevision: {
    type: Number,
    required: true,
    default: 1,
    validate: safeInteger(1)
  },
  environmentPolicyVersion: {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(1)
  },
  environmentSchemaVersion: {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(1)
  },
  worldGenerationVersion: {
    type: Number,
    required: true,
    immutable: true,
    validate: safeInteger(1)
  },
  reconciliation: {
    type: reconciliationSchema,
    required: true,
    default: () => ({})
  }
}, {
  strict: 'throw',
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

forestOwnerWorldSchema.pre('validate', function validateWorldState() {
  if (this.status === 'deleting' && this.reconciliation?.state !== 'idle') {
    this.invalidate('status', 'A deleting owner world cannot run reconciliation.');
  }
});

forestOwnerWorldSchema.index(
  { ownerUserId: 1, worldRole: 1 },
  { unique: true, name: 'unique_forest_owner_world_role' }
);
forestOwnerWorldSchema.index(
  { forestId: 1 },
  { unique: true, name: 'unique_forest_owner_world_id' }
);
forestOwnerWorldSchema.index(
  { status: 1, 'reconciliation.leaseExpiresAt': 1 },
  { name: 'forest_owner_world_reconciliation_lease' }
);
forestOwnerWorldSchema.index(
  { ownerUserId: 1 },
  { name: 'forest_owner_world_deletion' }
);
forestOwnerWorldSchema.index(
  {
    status: 1,
    worldRole: 1,
    'reconciliation.state': 1,
    'reconciliation.leaseExpiresAt': 1,
    ownerUserId: 1
  },
  { name: 'forest_owner_convergence_running' }
);
forestOwnerWorldSchema.index(
  {
    status: 1,
    worldRole: 1,
    'reconciliation.state': 1,
    'reconciliation.completedAt': 1,
    ownerUserId: 1
  },
  { name: 'forest_owner_convergence_due' }
);

export default forestOwnerWorldSchema;

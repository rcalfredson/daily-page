// Durable format identifiers are independent of whichever wire protocol is newest.
export const FOREST_AUTHORED_OBJECT_SCHEMA_VERSION = 1;
export const FOREST_AUTHORED_LINKED_OBJECT_SCHEMA_VERSION = 2;
export const FOREST_AUTHORED_OBJECT_FINGERPRINT_VERSION = 1;
export const FOREST_AUTHORED_LINKED_FINGERPRINT_VERSION = 2;
export const FOREST_AUTHORED_WRITING_LINK_VERSION = 1;
export const FOREST_AUTHORED_OBJECT_SCHEMA_VERSIONS = Object.freeze([1, 2]);

const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export class ForestAuthoredObjectFormatError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ForestAuthoredObjectFormatError';
    this.code = code;
  }
}

function invalid() {
  throw new ForestAuthoredObjectFormatError('INVALID_AUTHORED_OBJECT_FORMAT');
}

export function canonicalForestWritingLink(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const fields = Object.keys(value);
  if (fields.length !== 2 || !fields.includes('version') || !fields.includes('writingTreeId')) invalid();
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid();
  if (value.version !== FOREST_AUTHORED_WRITING_LINK_VERSION) {
    throw new ForestAuthoredObjectFormatError('UNSUPPORTED_AUTHORED_WRITING_LINK_VERSION');
  }
  if (typeof value.writingTreeId !== 'string' || !UUID_V4_PATTERN.test(value.writingTreeId)) invalid();
  return Object.freeze({ version: 1, writingTreeId: value.writingTreeId.toLowerCase() });
}

// Only the discriminating format is checked here. Each boundary must still validate common
// identity, world compatibility, placement, lifecycle, revision and timestamp evidence.
export function readForestAuthoredObjectFormat(value) {
  const object = typeof value?.toObject === 'function' ? value.toObject() : value;
  if (!object || typeof object !== 'object' || Array.isArray(object)) invalid();
  if (!Number.isSafeInteger(object.schemaVersion) || object.schemaVersion < 1) invalid();
  if (!FOREST_AUTHORED_OBJECT_SCHEMA_VERSIONS.includes(object.schemaVersion)) {
    throw new ForestAuthoredObjectFormatError('UNSUPPORTED_AUTHORED_OBJECT_SCHEMA');
  }
  if (object.creationFingerprint?.version !== object.schemaVersion) invalid();
  if (object.schemaVersion === 1) {
    if (Object.hasOwn(object, 'writingLink')) invalid();
    return Object.freeze({ schemaVersion: 1, fingerprintVersion: 1, writingLink: null });
  }
  const link = canonicalForestWritingLink(object.writingLink);
  if (link.writingTreeId !== object.writingLink.writingTreeId) invalid();
  return Object.freeze({ schemaVersion: 2, fingerprintVersion: 2, writingLink: link });
}

export function forestAuthoredObjectHasSupportedFormat(object) {
  try {
    readForestAuthoredObjectFormat(object);
    return true;
  } catch {
    return false;
  }
}

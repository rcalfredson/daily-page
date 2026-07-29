export const FOREST_OWNER_WRITING_POLICY_VERSION = 2;

export const FOREST_WRITING_CLASSIFICATIONS = Object.freeze({
  ELIGIBLE: 'eligible',
  INELIGIBLE: 'ineligible',
  UNRESOLVED: 'unresolved'
});

export const FOREST_WRITING_REASON_CODES = Object.freeze({
  ELIGIBLE_OWNER_BLOCK: 'eligible-owner-block',
  UNSUPPORTED_RECORD_TYPE: 'unsupported-record-type',
  LEGACY_OWNERSHIP_UNRESOLVED: 'legacy-ownership-unresolved',
  INVALID_RECORD_OWNER: 'invalid-record-owner',
  NON_LIVE_AUTHORSHIP: 'non-live-authorship',
  UNSUPPORTED_AUTHORSHIP_STATE: 'unsupported-authorship-state',
  OWNER_MISMATCH: 'owner-mismatch',
  INVALID_BLOCK_IDENTITY: 'invalid-block-identity',
  INVALID_GROUP_IDENTITY: 'invalid-group-identity',
  INVALID_LANGUAGE: 'invalid-language',
  UNSUPPORTED_STATUS: 'unsupported-status',
  UNSUPPORTED_VISIBILITY: 'unsupported-visibility',
  OWNER_TRANSLATION_AVAILABLE: 'owner-translation-available',
  PUBLIC_TRANSLATION_DISCOVERABLE: 'public-translation-discoverable',
  LOCKED_UNLISTED_TRANSLATION_DISCOVERABLE:
    'locked-unlisted-translation-discoverable',
  UNLISTED_IN_PROGRESS_TRANSLATION_HIDDEN:
    'unlisted-in-progress-translation-hidden'
});

export const FOREST_TRANSLATION_DISCOVERY = Object.freeze({
  AVAILABLE: 'available',
  HIDDEN: 'hidden',
  UNRESOLVED: 'unresolved'
});

const RECORD_FIELDS = Object.freeze([
  'recordType', 'blockId', 'userId', 'authorshipState', 'groupId', 'status', 'visibility', 'lang'
]);
const INPUT_FIELDS = Object.freeze(['authenticatedOwnerId', 'record']);
const SUPPORTED_AUTHORSHIP_STATES = Object.freeze(['live', 'deleted-author', 'anonymous']);
const SUPPORTED_STATUSES = Object.freeze(['in-progress', 'locked']);
const SUPPORTED_VISIBILITIES = Object.freeze(['public', 'unlisted']);
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2})?$/i;

function exactObject(value, allowedFields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const extra = Object.keys(value).filter(field => !allowedFields.includes(field));
  if (extra.length) throw new Error(`${label} contains unsupported fields: ${extra.join(', ')}.`);
}

function canonicalObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value)
    ? value.toLowerCase()
    : null;
}

function validLanguage(value) {
  return typeof value === 'string'
    && value.length >= 2
    && value.length <= 5
    && LANGUAGE_PATTERN.test(value);
}

function authorshipState(record) {
  return record.authorshipState === undefined ? 'live' : record.authorshipState;
}

function decision(classification, reasonCode, logicalIdentity = null) {
  return {
    policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
    classification,
    reasonCode,
    logicalIdentity
  };
}

function validateInput(input) {
  exactObject(input, INPUT_FIELDS, 'Forest owner-writing policy input');
  exactObject(input.record, RECORD_FIELDS, 'Forest owner-writing record');
  const authenticatedOwnerId = canonicalObjectId(input.authenticatedOwnerId);
  if (!authenticatedOwnerId) {
    throw new Error('authenticatedOwnerId must be an ObjectId-shaped string.');
  }
  return { authenticatedOwnerId, record: input.record };
}

function classifyRecordShape(record) {
  if (record.recordType !== 'Block') {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE,
      FOREST_WRITING_REASON_CODES.UNSUPPORTED_RECORD_TYPE
    );
  }
  if (!canonicalObjectId(record.blockId)) {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      FOREST_WRITING_REASON_CODES.INVALID_BLOCK_IDENTITY
    );
  }
  if (!canonicalObjectId(record.groupId)) {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      FOREST_WRITING_REASON_CODES.INVALID_GROUP_IDENTITY
    );
  }
  if (!validLanguage(record.lang)) {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      FOREST_WRITING_REASON_CODES.INVALID_LANGUAGE
    );
  }
  if (!SUPPORTED_STATUSES.includes(record.status)) {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      FOREST_WRITING_REASON_CODES.UNSUPPORTED_STATUS
    );
  }
  if (!SUPPORTED_VISIBILITIES.includes(record.visibility)) {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      FOREST_WRITING_REASON_CODES.UNSUPPORTED_VISIBILITY
    );
  }
  if (!SUPPORTED_AUTHORSHIP_STATES.includes(authorshipState(record))) {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      FOREST_WRITING_REASON_CODES.UNSUPPORTED_AUTHORSHIP_STATE
    );
  }
  return null;
}

export function classifyForestOwnerWriting(input) {
  const { authenticatedOwnerId, record } = validateInput(input);
  const shapeDecision = classifyRecordShape(record);
  if (shapeDecision) return shapeDecision;

  if (authorshipState(record) !== 'live') {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE,
      FOREST_WRITING_REASON_CODES.NON_LIVE_AUTHORSHIP
    );
  }
  if (record.userId === undefined || record.userId === null || record.userId === '') {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      FOREST_WRITING_REASON_CODES.LEGACY_OWNERSHIP_UNRESOLVED
    );
  }
  const recordOwnerId = canonicalObjectId(record.userId);
  if (!recordOwnerId) {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      FOREST_WRITING_REASON_CODES.INVALID_RECORD_OWNER
    );
  }
  if (recordOwnerId !== authenticatedOwnerId) {
    return decision(
      FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE,
      FOREST_WRITING_REASON_CODES.OWNER_MISMATCH
    );
  }

  return decision(
    FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE,
    FOREST_WRITING_REASON_CODES.ELIGIBLE_OWNER_BLOCK,
    {
      ownerUserId: authenticatedOwnerId,
      translationGroupId: canonicalObjectId(record.groupId)
    }
  );
}

export function classifyForestTranslationDiscovery(input) {
  const { authenticatedOwnerId, record } = validateInput(input);
  const shapeDecision = classifyRecordShape(record);
  if (shapeDecision) {
    return {
      policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
      classification: shapeDecision.classification === FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED
        ? FOREST_TRANSLATION_DISCOVERY.UNRESOLVED
        : FOREST_TRANSLATION_DISCOVERY.HIDDEN,
      reasonCode: shapeDecision.reasonCode
    };
  }

  const retainedAuthorship = authorshipState(record) !== 'live';
  const hasRecordOwner = record.userId !== undefined
    && record.userId !== null
    && record.userId !== '';
  if (retainedAuthorship && hasRecordOwner) {
    return {
      policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
      classification: FOREST_TRANSLATION_DISCOVERY.UNRESOLVED,
      reasonCode: FOREST_WRITING_REASON_CODES.INVALID_RECORD_OWNER
    };
  }
  if (!retainedAuthorship && !hasRecordOwner) {
    return {
      policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
      classification: FOREST_TRANSLATION_DISCOVERY.UNRESOLVED,
      reasonCode: FOREST_WRITING_REASON_CODES.LEGACY_OWNERSHIP_UNRESOLVED
    };
  }
  const recordOwnerId = retainedAuthorship ? null : canonicalObjectId(record.userId);
  if (!retainedAuthorship && !recordOwnerId) {
    return {
      policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
      classification: FOREST_TRANSLATION_DISCOVERY.UNRESOLVED,
      reasonCode: FOREST_WRITING_REASON_CODES.INVALID_RECORD_OWNER
    };
  }
  if (recordOwnerId === authenticatedOwnerId) {
    return {
      policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
      classification: FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
      reasonCode: FOREST_WRITING_REASON_CODES.OWNER_TRANSLATION_AVAILABLE
    };
  }
  if (record.visibility === 'public') {
    return {
      policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
      classification: FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
      reasonCode: FOREST_WRITING_REASON_CODES.PUBLIC_TRANSLATION_DISCOVERABLE
    };
  }
  if (record.status === 'locked') {
    return {
      policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
      classification: FOREST_TRANSLATION_DISCOVERY.AVAILABLE,
      reasonCode: FOREST_WRITING_REASON_CODES.LOCKED_UNLISTED_TRANSLATION_DISCOVERABLE
    };
  }
  return {
    policyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
    classification: FOREST_TRANSLATION_DISCOVERY.HIDDEN,
    reasonCode: FOREST_WRITING_REASON_CODES.UNLISTED_IN_PROGRESS_TRANSLATION_HIDDEN
  };
}

import Block from '../db/models/Block.js';
import {
  classifyForestOwnerWriting,
  FOREST_OWNER_WRITING_POLICY_VERSION,
  FOREST_WRITING_CLASSIFICATIONS,
} from './forestOwnerWritingPolicy.js';

export const FOREST_OWNER_GROUP_EVIDENCE_VERSION = 1;
export const FOREST_OWNER_GROUP_EVIDENCE_DEFAULT_ROW_LIMIT = 100;
export const FOREST_OWNER_GROUP_EVIDENCE_MAX_ROW_LIMIT = 100;

export const FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS = Object.freeze({
  ELIGIBLE: 'eligible',
  INELIGIBLE: 'ineligible',
  UNRESOLVED: 'unresolved',
});

export const FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES = Object.freeze({
  ELIGIBLE_OWNER_VARIANT: 'eligible-owner-variant',
  NO_ELIGIBLE_OWNER_VARIANT: 'no-eligible-owner-variant',
  INVALID_CREATION_DATE: 'invalid-creation-date',
  INVALID_ROOM_IDENTITY: 'invalid-room-identity',
  ROW_LIMIT_EXCEEDED: 'owner-group-row-limit-exceeded',
});

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2})?$/i;
const ROOM_PATTERN = /^[\s\S]{1,120}$/;
const BLOCK_PROJECTION = Object.freeze({
  _id: 1,
  userId: 1,
  authorshipState: 1,
  groupId: 1,
  lang: 1,
  status: 1,
  visibility: 1,
  createdAt: 1,
  roomId: 1,
});

function canonicalObjectId(value, label) {
  const normalized = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a canonical ObjectId string.`);
  }
  return normalized;
}

function validateLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1
    || value > FOREST_OWNER_GROUP_EVIDENCE_MAX_ROW_LIMIT) {
    throw new Error(
      `rowLimit must be an integer from 1 through ${FOREST_OWNER_GROUP_EVIDENCE_MAX_ROW_LIMIT}.`,
    );
  }
  return value;
}

function policyRecord(block) {
  return {
    recordType: 'Block',
    blockId: String(block?._id || ''),
    userId: block?.userId === undefined || block?.userId === null
      ? block?.userId
      : String(block.userId),
    ...(block?.authorshipState === undefined
      ? {}
      : { authorshipState: block.authorshipState }),
    groupId: block?.groupId === undefined || block?.groupId === null
      ? block?.groupId
      : String(block.groupId),
    status: block?.status,
    visibility: block?.visibility,
    lang: block?.lang,
  };
}

function classifyBlock(block, ownerUserId) {
  const decision = classifyForestOwnerWriting({
    authenticatedOwnerId: ownerUserId,
    record: policyRecord(block),
  });
  if (decision.classification !== FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE) {
    return decision;
  }
  if (!(block.createdAt instanceof Date) || Number.isNaN(block.createdAt.getTime())) {
    return {
      ...decision,
      classification: FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      reasonCode: FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES.INVALID_CREATION_DATE,
    };
  }
  if (typeof block.roomId !== 'string'
    || block.roomId.length === 0
    || block.roomId.length > 120) {
    return {
      ...decision,
      classification: FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED,
      reasonCode: FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES.INVALID_ROOM_IDENTITY,
    };
  }
  return decision;
}

function founder(block, ownerUserId, translationGroupId) {
  return Object.freeze({
    blockId: String(block._id),
    ownerUserId,
    translationGroupId,
    authorshipState: block.authorshipState || 'live',
    lang: block.lang,
    status: block.status,
    visibility: block.visibility,
    createdAt: block.createdAt.toISOString(),
    roomId: block.roomId,
  });
}

function result(classification, reasonCode, foundingVariant = null, diagnostics = {}) {
  return Object.freeze({
    evidenceVersion: FOREST_OWNER_GROUP_EVIDENCE_VERSION,
    ownerWritingPolicyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
    classification,
    reasonCode,
    foundingVariant,
    diagnostics: Object.freeze(diagnostics),
  });
}

function eligibleFilter(ownerUserId, translationGroupId) {
  return {
    userId: ownerUserId,
    groupId: translationGroupId,
    $and: [
      {
        $or: [
          { authorshipState: 'live' },
          { authorshipState: { $exists: false } },
        ],
      },
      { lang: { $regex: LANGUAGE_PATTERN } },
      { status: { $in: ['in-progress', 'locked'] } },
      { visibility: { $in: ['public', 'unlisted'] } },
      { createdAt: { $type: 'date' } },
      { roomId: { $regex: ROOM_PATTERN } },
    ],
  };
}

export function buildForestOwnerGroupEvidenceReader({
  BlockModel = Block,
  rowLimit = FOREST_OWNER_GROUP_EVIDENCE_DEFAULT_ROW_LIMIT,
} = {}) {
  if (!BlockModel?.findOne || !BlockModel?.find) {
    throw new Error('BlockModel.findOne and BlockModel.find must be available.');
  }
  const maximumRows = validateLimit(rowLimit);

  return async function readForestOwnerGroupEvidence({
    ownerUserId,
    translationGroupId,
    session,
  }) {
    const owner = canonicalObjectId(ownerUserId, 'ownerUserId');
    const group = canonicalObjectId(translationGroupId, 'translationGroupId');
    if (!session) throw new Error('Forest owner-group evidence requires a transaction session.');

    const eligibleBlock = await BlockModel.findOne(
      eligibleFilter(owner, group),
      BLOCK_PROJECTION,
    ).sort({ createdAt: 1, _id: 1 }).session(session).lean();
    if (eligibleBlock) {
      const decision = classifyBlock(eligibleBlock, owner);
      if (decision.classification !== FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE) {
        return result(
          FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.UNRESOLVED,
          decision.reasonCode,
          null,
          { scannedBlockCount: 1, rowLimitReached: false },
        );
      }
      return result(
        FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.ELIGIBLE,
        FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES.ELIGIBLE_OWNER_VARIANT,
        founder(eligibleBlock, owner, group),
        { scannedBlockCount: 1, rowLimitReached: false },
      );
    }

    const rows = await BlockModel.find(
      { userId: owner, groupId: group },
      BLOCK_PROJECTION,
    ).sort({ _id: 1 }).limit(maximumRows + 1).session(session).lean();
    if (!Array.isArray(rows) || rows.length > maximumRows + 1) {
      throw new Error('Owner-group evidence query returned an invalid bounded result.');
    }
    const scanned = rows.slice(0, maximumRows);
    for (const block of scanned) {
      const decision = classifyBlock(block, owner);
      if (decision.classification === FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED) {
        return result(
          FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.UNRESOLVED,
          decision.reasonCode,
          null,
          { scannedBlockCount: scanned.length, rowLimitReached: false },
        );
      }
      if (decision.classification === FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE) {
        return result(
          FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.UNRESOLVED,
          'eligible-owner-variant-missed-by-indexed-query',
          null,
          { scannedBlockCount: scanned.length, rowLimitReached: false },
        );
      }
    }
    if (rows.length > maximumRows) {
      return result(
        FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.UNRESOLVED,
        FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES.ROW_LIMIT_EXCEEDED,
        null,
        { scannedBlockCount: scanned.length, rowLimitReached: true },
      );
    }
    return result(
      FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.INELIGIBLE,
      FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES.NO_ELIGIBLE_OWNER_VARIANT,
      null,
      { scannedBlockCount: scanned.length, rowLimitReached: false },
    );
  };
}

export const readForestOwnerGroupEvidence = buildForestOwnerGroupEvidenceReader();

export { BLOCK_PROJECTION as FOREST_OWNER_GROUP_EVIDENCE_BLOCK_PROJECTION };

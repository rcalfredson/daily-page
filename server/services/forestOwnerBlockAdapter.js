import mongoose from 'mongoose';

import Block from '../db/models/Block.js';
import {
  classifyForestOwnerWriting,
  FOREST_OWNER_WRITING_POLICY_VERSION,
  FOREST_WRITING_CLASSIFICATIONS
} from './forestOwnerWritingPolicy.js';

export const FOREST_OWNER_BLOCK_ADAPTER_VERSION = 1;
export const FOREST_OWNER_BLOCK_CURSOR_VERSION = 1;
export const FOREST_OWNER_BLOCK_DEFAULT_PAGE_SIZE = 50;
export const FOREST_OWNER_BLOCK_MAX_PAGE_SIZE = 100;

export const FOREST_OWNER_BLOCK_ADAPTER_REASON_CODES = Object.freeze({
  INVALID_CREATION_DATE: 'invalid-creation-date',
  INVALID_ROOM_IDENTITY: 'invalid-room-identity'
});

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const ROOM_ID_MAX_LENGTH = 120;
const CURSOR_MAX_LENGTH = 256;
const BLOCK_PROJECTION = Object.freeze({
  _id: 1,
  userId: 1,
  authorshipState: 1,
  groupId: 1,
  lang: 1,
  status: 1,
  visibility: 1,
  createdAt: 1,
  roomId: 1
});

function canonicalObjectId(value, label) {
  const normalized = String(value || '');
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    throw new Error(`${label} must be an ObjectId-shaped value.`);
  }
  return normalized.toLowerCase();
}

function resolvePageSize(value) {
  if (value === undefined) return FOREST_OWNER_BLOCK_DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(value) || value < 1 || value > FOREST_OWNER_BLOCK_MAX_PAGE_SIZE) {
    throw new Error(
      `limit must be an integer from 1 through ${FOREST_OWNER_BLOCK_MAX_PAGE_SIZE}.`
    );
  }
  return value;
}

function encodeCursor(blockId) {
  return Buffer.from(JSON.stringify({
    version: FOREST_OWNER_BLOCK_CURSOR_VERSION,
    afterBlockId: canonicalObjectId(blockId, 'Cursor Block identity')
  })).toString('base64url');
}

function decodeCursor(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > CURSOR_MAX_LENGTH) {
    throw new Error('cursor must be a bounded opaque string.');
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('invalid shape');
    }
    const fields = Object.keys(decoded);
    if (fields.length !== 2
      || !fields.includes('version')
      || !fields.includes('afterBlockId')
      || decoded.version !== FOREST_OWNER_BLOCK_CURSOR_VERSION) {
      throw new Error('unsupported cursor');
    }
    return canonicalObjectId(decoded.afterBlockId, 'Cursor Block identity');
  } catch {
    throw new Error('cursor is invalid or unsupported.');
  }
}

async function fetchMongoBlockPage({
  ownerUserId,
  afterBlockId,
  limit
}) {
  const filter = {
    userId: ownerUserId,
    ...(afterBlockId
      ? { _id: { $gt: new mongoose.Types.ObjectId(afterBlockId) } }
      : {})
  };

  return Block.find(filter, BLOCK_PROJECTION)
    .sort({ _id: 1 })
    .limit(limit)
    .lean()
    .exec();
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
    lang: block?.lang
  };
}

function validCreationDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function validRoomId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= ROOM_ID_MAX_LENGTH;
}

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

function eligibleSummary(block, decision) {
  return {
    blockId: String(block._id),
    ownerUserId: decision.logicalIdentity.ownerUserId,
    translationGroupId: decision.logicalIdentity.translationGroupId,
    authorshipState: block.authorshipState || 'live',
    lang: block.lang,
    status: block.status,
    visibility: block.visibility,
    createdAt: block.createdAt.toISOString(),
    roomId: block.roomId
  };
}

export function buildForestOwnerBlockAdapter({
  fetchBlockPage = fetchMongoBlockPage
} = {}) {
  if (typeof fetchBlockPage !== 'function') {
    throw new Error('fetchBlockPage must be a function.');
  }

  return async function listForestOwnerBlockPage({
    authenticatedOwnerId,
    cursor = null,
    limit
  }) {
    const ownerUserId = canonicalObjectId(
      authenticatedOwnerId,
      'authenticatedOwnerId'
    );
    const pageSize = resolvePageSize(limit);
    const afterBlockId = decodeCursor(cursor);
    const rows = await fetchBlockPage({
      ownerUserId,
      afterBlockId,
      limit: pageSize + 1,
      projection: BLOCK_PROJECTION,
      sort: Object.freeze({ _id: 1 })
    });
    if (!Array.isArray(rows) || rows.length > pageSize + 1) {
      throw new Error('Forest owner Block page reader returned an invalid bounded result.');
    }

    const scanned = rows.slice(0, pageSize);
    const eligibleBlocks = [];
    const reasonCounts = {};
    const classificationCounts = {
      [FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE]: 0,
      [FOREST_WRITING_CLASSIFICATIONS.INELIGIBLE]: 0,
      [FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED]: 0
    };

    for (const block of scanned) {
      const decision = classifyForestOwnerWriting({
        authenticatedOwnerId: ownerUserId,
        record: policyRecord(block)
      });
      let classification = decision.classification;
      let reasonCode = decision.reasonCode;

      if (classification === FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE
        && !validCreationDate(block.createdAt)) {
        classification = FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED;
        reasonCode = FOREST_OWNER_BLOCK_ADAPTER_REASON_CODES.INVALID_CREATION_DATE;
      } else if (classification === FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE
        && !validRoomId(block.roomId)) {
        classification = FOREST_WRITING_CLASSIFICATIONS.UNRESOLVED;
        reasonCode = FOREST_OWNER_BLOCK_ADAPTER_REASON_CODES.INVALID_ROOM_IDENTITY;
      }

      increment(classificationCounts, classification);
      if (classification === FOREST_WRITING_CLASSIFICATIONS.ELIGIBLE) {
        eligibleBlocks.push(eligibleSummary(block, decision));
      } else {
        increment(reasonCounts, reasonCode);
      }
    }

    return {
      adapterVersion: FOREST_OWNER_BLOCK_ADAPTER_VERSION,
      ownerWritingPolicyVersion: FOREST_OWNER_WRITING_POLICY_VERSION,
      page: {
        scannedBlockCount: scanned.length,
        eligibleBlockCount: eligibleBlocks.length,
        classificationCounts,
        reasonCounts,
        nextCursor: rows.length > pageSize && scanned.length
          ? encodeCursor(scanned.at(-1)._id)
          : null
      },
      eligibleBlocks
    };
  };
}

export const listForestOwnerBlockPage = buildForestOwnerBlockAdapter();

export { BLOCK_PROJECTION };

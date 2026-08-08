import mongoose from 'mongoose';

import Block from '../db/models/Block.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  FOREST_OWNER_WORLD_SCHEMA_VERSION
} from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION
} from '../db/schemas/ForestWritingTreeSchema.js';
import { canonicalBlockPath } from '../utils/canonical.js';
import { selectForestOwnerVariants } from './forestOwnerVariantSelection.js';

export const FOREST_OWNER_NON_CANVAS_READ_VERSION = 2;
export const FOREST_OWNER_NON_CANVAS_CURSOR_VERSION = 3;
export const FOREST_OWNER_NON_CANVAS_DEFAULT_PAGE_SIZE = 25;
export const FOREST_OWNER_NON_CANVAS_MAX_PAGE_SIZE = 50;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_V4_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2})?$/i;
const CURSOR_MAX_LENGTH = 256;
const ROOM_ID_MAX_LENGTH = 120;

const TREE_PROJECTION = Object.freeze({
  _id: 0,
  schemaVersion: 1,
  identityVersion: 1,
  writingTreeId: 1,
  forestId: 1,
  ownerUserId: 1,
  translationGroupId: 1,
  sourceState: 1,
  hiddenFromForest: 1,
  inclusionChangedAt: 1,
  foundingSource: 1,
  placement: 1,
  projection: 1,
  recordRevision: 1
});

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
  title: 1
});

export class ForestOwnerNonCanvasReadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerNonCanvasReadError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerNonCanvasReadError(code, message);
}

function canonicalObjectId(value, label) {
  const normalized = String(value || '');
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    fail('INVALID_FOREST_READ_INPUT', `${label} must be an ObjectId-shaped value.`);
  }
  return normalized.toLowerCase();
}

function canonicalLanguage(value) {
  if (typeof value !== 'string'
    || value.length < 2
    || value.length > 5
    || !LANGUAGE_PATTERN.test(value)) {
    fail('INVALID_FOREST_READ_INPUT', 'preferredContentLang is invalid.');
  }
  return value.toLowerCase();
}

function pageSize(value) {
  if (value === undefined || value === null || value === '') {
    return FOREST_OWNER_NON_CANVAS_DEFAULT_PAGE_SIZE;
  }
  const normalized = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  if (!Number.isInteger(normalized)
    || normalized < 1
    || normalized > FOREST_OWNER_NON_CANVAS_MAX_PAGE_SIZE) {
    fail(
      'INVALID_FOREST_READ_INPUT',
      `limit must be an integer from 1 through ${FOREST_OWNER_NON_CANVAS_MAX_PAGE_SIZE}.`
    );
  }
  return normalized;
}

function inclusionState(value) {
  if (!['visible', 'hidden'].includes(value)) {
    fail('INVALID_FOREST_READ_INPUT', 'inclusion must be visible or hidden.');
  }
  return value;
}

function encodeCursor(tree, direction, inclusion) {
  return Buffer.from(JSON.stringify({
    version: FOREST_OWNER_NON_CANVAS_CURSOR_VERSION,
    direction,
    inclusion,
    anchorPlacementSlot: tree.placement.slot,
    anchorWritingTreeId: tree.writingTreeId
  })).toString('base64url');
}

function decodeCursor(value, inclusion = 'visible') {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > CURSOR_MAX_LENGTH) {
    fail('INVALID_FOREST_READ_INPUT', 'cursor must be a bounded opaque string.');
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const fields = decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? Object.keys(decoded)
      : [];
    if (decoded?.version === 1 && inclusion === 'visible'
      && fields.length === 3
      && fields.includes('afterPlacementSlot')
      && fields.includes('afterWritingTreeId')
      && Number.isSafeInteger(decoded.afterPlacementSlot)
      && decoded.afterPlacementSlot >= 0
      && UUID_V4_PATTERN.test(decoded.afterWritingTreeId || '')) {
      return {
        version: FOREST_OWNER_NON_CANVAS_CURSOR_VERSION,
        direction: 'after',
        inclusion: 'visible',
        anchorPlacementSlot: decoded.afterPlacementSlot,
        anchorWritingTreeId: decoded.afterWritingTreeId
      };
    }
    if (decoded?.version === 2 && inclusion === 'visible'
      && fields.length === 4
      && ['after', 'before'].includes(decoded.direction)
      && Number.isSafeInteger(decoded.anchorPlacementSlot)
      && decoded.anchorPlacementSlot >= 0
      && UUID_V4_PATTERN.test(decoded.anchorWritingTreeId || '')) {
      return { ...decoded, version: FOREST_OWNER_NON_CANVAS_CURSOR_VERSION, inclusion };
    }
    if (fields.length !== 5
      || !fields.includes('version')
      || !fields.includes('direction')
      || !fields.includes('inclusion')
      || !fields.includes('anchorPlacementSlot')
      || !fields.includes('anchorWritingTreeId')
      || decoded.version !== FOREST_OWNER_NON_CANVAS_CURSOR_VERSION
      || !['after', 'before'].includes(decoded.direction)
      || decoded.inclusion !== inclusion
      || !Number.isSafeInteger(decoded.anchorPlacementSlot)
      || decoded.anchorPlacementSlot < 0
      || !UUID_V4_PATTERN.test(decoded.anchorWritingTreeId || '')) {
      throw new Error('unsupported cursor');
    }
    return decoded;
  } catch {
    fail('INVALID_FOREST_READ_INPUT', 'cursor is invalid or unsupported.');
  }
}

function eligibleBlockMatch(ownerUserId, groupIds) {
  return {
    userId: ownerUserId,
    groupId: { $in: groupIds },
    $or: [
      { authorshipState: 'live' },
      { authorshipState: { $exists: false } }
    ],
    status: { $in: ['in-progress', 'locked'] },
    visibility: { $in: ['public', 'unlisted'] },
    lang: { $type: 'string', $regex: LANGUAGE_PATTERN },
    createdAt: { $type: 'date' },
    roomId: { $type: 'string' }
  };
}

function validTree(tree, world, ownerUserId, inclusion) {
  return tree?.schemaVersion === FOREST_WRITING_TREE_SCHEMA_VERSION
    && tree?.identityVersion === FOREST_WRITING_TREE_IDENTITY_VERSION
    && UUID_V4_PATTERN.test(tree?.writingTreeId || '')
    && UUID_V4_PATTERN.test(tree?.forestId || '')
    && tree?.ownerUserId === ownerUserId
    && tree?.forestId === world.forestId
    && tree?.sourceState === 'active'
    && tree?.hiddenFromForest === (inclusion === 'hidden')
    && (tree.hiddenFromForest ? tree.inclusionChangedAt instanceof Date : true)
    && Number.isSafeInteger(tree?.recordRevision)
    && tree.recordRevision >= 1
    && OBJECT_ID_PATTERN.test(tree?.translationGroupId || '')
    && OBJECT_ID_PATTERN.test(tree?.foundingSource?.blockId || '')
    && Number.isSafeInteger(tree?.placement?.slot)
    && tree.placement.slot >= 0
    && Number.isSafeInteger(tree?.placement?.worldX)
    && Number.isSafeInteger(tree?.placement?.worldY)
    && typeof tree?.projection?.phenotypeId === 'string'
    && Number.isSafeInteger(tree?.projection?.phenotypeAssetVersion)
    && typeof tree?.projection?.creationSeason === 'string'
    && (tree?.projection?.foliagePaletteId === null
      || typeof tree?.projection?.foliagePaletteId === 'string');
}

function validBlock(block, ownerUserId, translationGroupId) {
  return block
    && String(block.userId || '').toLowerCase() === ownerUserId
    && String(block.groupId || '').toLowerCase() === translationGroupId
    && (block.authorshipState === undefined || block.authorshipState === 'live')
    && ['in-progress', 'locked'].includes(block.status)
    && ['public', 'unlisted'].includes(block.visibility)
    && typeof block.lang === 'string'
    && block.lang.length <= 5
    && LANGUAGE_PATTERN.test(block.lang)
    && block.createdAt instanceof Date
    && !Number.isNaN(block.createdAt.getTime())
    && typeof block.roomId === 'string'
    && block.roomId.length > 0
    && block.roomId.length <= ROOM_ID_MAX_LENGTH
    && typeof block.title === 'string'
    && block.title.length > 0;
}

function variant(block) {
  return {
    blockId: String(block._id),
    ownerUserId: String(block.userId),
    translationGroupId: String(block.groupId),
    authorshipState: block.authorshipState || 'live',
    lang: block.lang,
    status: block.status,
    visibility: block.visibility,
    createdAt: block.createdAt.toISOString(),
    roomId: block.roomId
  };
}

function blockKey(block) {
  return String(block?._id || '').toLowerCase();
}

async function queryRows(query) {
  const leanQuery = query.lean();
  return typeof leanQuery.exec === 'function' ? leanQuery.exec() : leanQuery;
}

function treeFilter({ ownerUserId, forestId, cursor, inclusion }) {
  const operator = cursor?.direction === 'before' ? '$lt' : '$gt';
  return {
    ownerUserId,
    forestId,
    sourceState: 'active',
    hiddenFromForest: inclusion === 'hidden',
    ...(cursor ? {
      $or: [
        { 'placement.slot': { [operator]: cursor.anchorPlacementSlot } },
        {
          'placement.slot': cursor.anchorPlacementSlot,
          writingTreeId: { [operator]: cursor.anchorWritingTreeId }
        }
      ]
    } : {})
  };
}

export function buildForestOwnerNonCanvasReadService({
  ForestOwnerWorldModel = ForestOwnerWorld,
  ForestWritingTreeModel = ForestWritingTree,
  BlockModel = Block
} = {}) {
  return async function listForestOwnerWritingTrees({
    ownerUserId: ownerValue,
    preferredContentLang = 'en',
    inclusion: inclusionValue = 'visible',
    cursor = null,
    limit
  }) {
    const ownerUserId = canonicalObjectId(ownerValue, 'ownerUserId');
    const language = canonicalLanguage(preferredContentLang);
    const resolvedLimit = pageSize(limit);
    const inclusion = inclusionState(inclusionValue);
    const decodedCursor = decodeCursor(cursor, inclusion);

    const world = await queryRows(ForestOwnerWorldModel.findOne({
      ownerUserId,
      worldRole: 'primary'
    }));
    if (!world) {
      return {
        readVersion: FOREST_OWNER_NON_CANVAS_READ_VERSION,
        status: 'not-established',
        trees: [],
        page: {
          returnedTreeCount: 0,
          omittedUnavailableCount: 0,
          previousCursor: null,
          nextCursor: null
        }
      };
    }
    if (world.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
      || world.ownerUserId !== ownerUserId
      || world.worldRole !== 'primary'
      || !UUID_V4_PATTERN.test(world.forestId || '')) {
      fail('FOREST_READ_UNAVAILABLE', 'The owner world has an unsupported identity or version.');
    }
    if (world.status !== 'active') {
      fail('FOREST_READ_UNAVAILABLE', 'The owner world is unavailable.');
    }
    if (world.reconciliation?.state === 'running') {
      return {
        readVersion: FOREST_OWNER_NON_CANVAS_READ_VERSION,
        status: 'reconciling',
        trees: [],
        page: {
          returnedTreeCount: 0,
          omittedUnavailableCount: 0,
          previousCursor: null,
          nextCursor: null
        }
      };
    }
    if (world.reconciliation?.state !== 'idle') {
      fail('FOREST_READ_UNAVAILABLE', 'The owner world has unsupported reconciliation state.');
    }

    const readingBackward = decodedCursor?.direction === 'before';
    const sortDirection = readingBackward ? -1 : 1;
    const treeQuery = ForestWritingTreeModel.find(
      treeFilter({ ownerUserId, forestId: world.forestId, cursor: decodedCursor, inclusion }),
      TREE_PROJECTION
    ).sort({ 'placement.slot': sortDirection, writingTreeId: sortDirection })
      .limit(resolvedLimit + 1);
    const rows = await queryRows(treeQuery);
    if (!Array.isArray(rows) || rows.length > resolvedLimit + 1) {
      fail('FOREST_READ_UNAVAILABLE', 'The writing-tree page was not bounded.');
    }
    const pageRows = rows.slice(0, resolvedLimit);
    if (readingBackward) pageRows.reverse();
    if (pageRows.some(tree => !validTree(tree, world, ownerUserId, inclusion))) {
      fail('FOREST_READ_UNAVAILABLE', 'The writing-tree page contains unsupported state.');
    }

    const groupIds = pageRows.map(tree => tree.translationGroupId);
    if (!groupIds.length) {
      return {
        readVersion: FOREST_OWNER_NON_CANVAS_READ_VERSION,
        status: 'ready',
        trees: [],
        page: {
          returnedTreeCount: 0,
          omittedUnavailableCount: 0,
          previousCursor: null,
          nextCursor: null
        }
      };
    }

    const eligibleMatch = eligibleBlockMatch(ownerUserId, groupIds);
    const foundingIds = pageRows.map(
      tree => new mongoose.Types.ObjectId(tree.foundingSource.blockId)
    );
    const [preferredRows, foundingRows, earliestRows] = await Promise.all([
      queryRows(BlockModel.find(
        { ...eligibleMatch, lang: language },
        BLOCK_PROJECTION
      )),
      queryRows(BlockModel.find(
        { ...eligibleMatch, _id: { $in: foundingIds } },
        BLOCK_PROJECTION
      )),
      BlockModel.aggregate([
        { $match: eligibleMatch },
        { $sort: { groupId: 1, createdAt: 1, _id: 1 } },
        { $group: { _id: '$groupId', block: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$block' } },
        { $project: BLOCK_PROJECTION }
      ])
    ]);
    if (![preferredRows, foundingRows, earliestRows].every(Array.isArray)
      || preferredRows.length > groupIds.length
      || foundingRows.length > groupIds.length
      || earliestRows.length > groupIds.length) {
      fail('FOREST_READ_UNAVAILABLE', 'The current writing candidate read was not bounded.');
    }

    const candidatesByGroup = new Map();
    for (const block of [...preferredRows, ...foundingRows, ...earliestRows]) {
      const groupId = String(block?.groupId || '').toLowerCase();
      if (!candidatesByGroup.has(groupId)) candidatesByGroup.set(groupId, new Map());
      candidatesByGroup.get(groupId).set(blockKey(block), block);
    }

    const trees = [];
    let omittedUnavailableCount = 0;
    for (const tree of pageRows) {
      const groupCandidates = [...(candidatesByGroup.get(tree.translationGroupId)?.values() || [])]
        .filter(block => validBlock(block, ownerUserId, tree.translationGroupId));
      const selection = selectForestOwnerVariants({
        ownerUserId,
        translationGroupId: tree.translationGroupId,
        preferredContentLang: language,
        capturedFoundingBlockId: tree.foundingSource.blockId,
        variants: groupCandidates.map(variant)
      });
      if (!selection.displayVariant) {
        omittedUnavailableCount += 1;
        continue;
      }
      const displayBlock = groupCandidates.find(
        block => blockKey(block) === selection.displayVariant.blockId
      );
      if (!displayBlock) {
        omittedUnavailableCount += 1;
        continue;
      }
      trees.push({
        writingTreeId: tree.writingTreeId,
        inclusion: {
          hidden: tree.hiddenFromForest,
          changedAt: tree.inclusionChangedAt?.toISOString?.() || null,
          recordRevision: tree.recordRevision
        },
        placement: {
          worldX: tree.placement.worldX,
          worldY: tree.placement.worldY
        },
        projection: {
          phenotypeId: tree.projection.phenotypeId,
          phenotypeAssetVersion: tree.projection.phenotypeAssetVersion,
          creationSeason: tree.projection.creationSeason,
          foliagePaletteId: tree.projection.foliagePaletteId
        },
        writing: {
          title: displayBlock.title,
          roomId: selection.displayVariant.roomId,
          lang: selection.displayVariant.lang,
          status: selection.displayVariant.status,
          visibility: selection.displayVariant.visibility,
          createdAt: selection.displayVariant.createdAt,
          path: canonicalBlockPath(
            selection.displayVariant.roomId,
            selection.displayVariant.blockId
          )
        },
        displayReason: selection.displayReason
      });
    }

    return {
      readVersion: FOREST_OWNER_NON_CANVAS_READ_VERSION,
      status: 'ready',
      trees,
      page: {
        returnedTreeCount: trees.length,
        omittedUnavailableCount,
        previousCursor: pageRows.length && (
          readingBackward ? rows.length > resolvedLimit : Boolean(decodedCursor)
        )
          ? encodeCursor(pageRows[0], 'before', inclusion)
          : null,
        nextCursor: pageRows.length && (
          readingBackward ? Boolean(decodedCursor) : rows.length > resolvedLimit
        )
          ? encodeCursor(pageRows.at(-1), 'after', inclusion)
          : null
      }
    };
  };
}

export const listForestOwnerWritingTrees = buildForestOwnerNonCanvasReadService();

export { decodeCursor as decodeForestOwnerNonCanvasCursor };

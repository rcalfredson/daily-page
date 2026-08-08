import mongoose from 'mongoose';

import Block from '../db/models/Block.js';
import ForestOwnerWorld from '../db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import {
  FOREST_OWNER_WORLD_SCHEMA_VERSION,
} from '../db/schemas/ForestOwnerWorldSchema.js';
import {
  FOREST_WRITING_TREE_CREATION_SEASONS,
  FOREST_WRITING_TREE_IDENTITY_VERSION,
  FOREST_WRITING_TREE_SCHEMA_VERSION,
} from '../db/schemas/ForestWritingTreeSchema.js';
import { canonicalBlockPath } from '../utils/canonical.js';
import {
  classifyForestTranslationDiscovery,
  FOREST_TRANSLATION_DISCOVERY,
} from './forestOwnerWritingPolicy.js';
import { selectForestOwnerVariants } from './forestOwnerVariantSelection.js';
import {
  FOREST_POST_TREE_MAPPING_VERSION,
  FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION,
} from './forestPostTreeProjection.js';
import { FOREST_WRITING_TREE_PROJECTION_REVISION } from './forestWritingTreeCreation.js';
import { resolveForestPhenotype } from './forest/v3/phenotype.js';

export const FOREST_OWNER_TREE_INSPECTION_VERSION = 1;
export const FOREST_OWNER_TREE_INSPECTION_CURSOR_VERSION = 1;
export const FOREST_OWNER_TREE_INSPECTION_DEFAULT_PAGE_SIZE = 12;
export const FOREST_OWNER_TREE_INSPECTION_MAX_PAGE_SIZE = 25;

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
  foundingSource: 1,
  projection: 1,
  recordRevision: 1,
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
  title: 1,
});

export class ForestOwnerTreeInspectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerTreeInspectionError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerTreeInspectionError(code, message);
}

function canonicalObjectId(value, field) {
  const normalized = String(value || '').toLowerCase();
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    fail('INVALID_TREE_INSPECTION_INPUT', `${field} must be a canonical ObjectId string.`);
  }
  return normalized;
}

function canonicalTreeId(value) {
  const normalized = String(value || '').toLowerCase();
  if (!UUID_V4_PATTERN.test(normalized)) {
    fail('INVALID_TREE_INSPECTION_INPUT', 'writingTreeId must be a canonical UUIDv4 string.');
  }
  return normalized;
}

function canonicalLanguage(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.length < 2
    || normalized.length > 5
    || !LANGUAGE_PATTERN.test(normalized)) {
    fail('INVALID_TREE_INSPECTION_INPUT', 'preferredContentLang is invalid.');
  }
  return normalized;
}

function pageSize(value) {
  if (value === undefined || value === null || value === '') {
    return FOREST_OWNER_TREE_INSPECTION_DEFAULT_PAGE_SIZE;
  }
  const normalized = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  if (!Number.isSafeInteger(normalized)
    || normalized < 1
    || normalized > FOREST_OWNER_TREE_INSPECTION_MAX_PAGE_SIZE) {
    fail(
      'INVALID_TREE_INSPECTION_INPUT',
      `limit must be from 1 through ${FOREST_OWNER_TREE_INSPECTION_MAX_PAGE_SIZE}.`,
    );
  }
  return normalized;
}

function encodeCursor(writingTreeId, blockId) {
  return Buffer.from(JSON.stringify({
    version: FOREST_OWNER_TREE_INSPECTION_CURSOR_VERSION,
    writingTreeId,
    afterBlockId: blockId,
  })).toString('base64url');
}

function decodeCursor(value, writingTreeId) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > CURSOR_MAX_LENGTH) {
    fail('INVALID_TREE_INSPECTION_INPUT', 'cursor must be a bounded opaque string.');
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const fields = decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? Object.keys(decoded)
      : [];
    if (fields.length !== 3
      || !fields.includes('version')
      || !fields.includes('writingTreeId')
      || !fields.includes('afterBlockId')
      || decoded.version !== FOREST_OWNER_TREE_INSPECTION_CURSOR_VERSION
      || decoded.writingTreeId !== writingTreeId
      || !OBJECT_ID_PATTERN.test(decoded.afterBlockId || '')) {
      throw new Error('unsupported cursor');
    }
    return decoded.afterBlockId.toLowerCase();
  } catch {
    fail('INVALID_TREE_INSPECTION_INPUT', 'cursor is invalid for this writing tree.');
  }
}

async function rows(query) {
  const lean = query.lean();
  return typeof lean.exec === 'function' ? lean.exec() : lean;
}

function validateWorld(world, ownerUserId) {
  if (!world) fail('TREE_INSPECTION_NOT_FOUND', 'The owner world is unavailable.');
  if (world.schemaVersion !== FOREST_OWNER_WORLD_SCHEMA_VERSION
    || world.ownerUserId !== ownerUserId
    || world.worldRole !== 'primary'
    || !UUID_V4_PATTERN.test(world.forestId || '')) {
    fail('TREE_INSPECTION_UNAVAILABLE', 'The owner world uses unsupported identity.');
  }
  if (world.status !== 'active') {
    fail('TREE_INSPECTION_NOT_FOUND', 'The owner world is unavailable.');
  }
  if (world.reconciliation?.state === 'running') return 'reconciling';
  if (world.reconciliation?.state !== 'idle') {
    fail('TREE_INSPECTION_UNAVAILABLE', 'The owner world has unsupported reconciliation state.');
  }
  return 'ready';
}

function validateTree(tree, world, ownerUserId, writingTreeId) {
  const phenotype = resolveForestPhenotype(tree?.projection?.phenotypeId);
  const season = tree?.projection?.creationSeason;
  const paletteId = tree?.projection?.foliagePaletteId;
  const expectedPaletteId = season === 'unknown'
    ? null
    : phenotype?.postTreeMeaning?.creationSeasonPaletteIds?.[season];
  const expectedVisualFingerprint = [
    `mapping-v${FOREST_POST_TREE_MAPPING_VERSION}`,
    paletteId ? `foliage-${paletteId}` : 'foliage-seed-selected',
  ].join(':');
  if (!tree) fail('TREE_INSPECTION_NOT_FOUND', 'The writing tree is unavailable.');
  if (tree.schemaVersion !== FOREST_WRITING_TREE_SCHEMA_VERSION
    || tree.identityVersion !== FOREST_WRITING_TREE_IDENTITY_VERSION
    || tree.writingTreeId !== writingTreeId
    || tree.forestId !== world.forestId
    || tree.ownerUserId !== ownerUserId
    || tree.sourceState !== 'active'
    || tree.hiddenFromForest !== false
    || !Number.isSafeInteger(tree.recordRevision)
    || tree.recordRevision < 1
    || !OBJECT_ID_PATTERN.test(tree.translationGroupId || '')
    || !OBJECT_ID_PATTERN.test(tree.foundingSource?.blockId || '')
    || tree.projection?.revision !== FOREST_WRITING_TREE_PROJECTION_REVISION
    || tree.projection?.schemaVersion !== FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION
    || tree.projection?.mappingVersion !== FOREST_POST_TREE_MAPPING_VERSION
    || !Number.isSafeInteger(tree.projection?.specimenSeed)
    || tree.projection.specimenSeed < 0
    || tree.projection.specimenSeed > 0xFFFFFFFF
    || !phenotype
    || phenotype.assetVersion !== tree.projection?.phenotypeAssetVersion
    || !FOREST_WRITING_TREE_CREATION_SEASONS.includes(season)
    || paletteId !== expectedPaletteId
    || tree.projection?.visualFingerprint !== expectedVisualFingerprint
    || typeof tree.projection?.projectionFingerprint !== 'string'
    || !tree.projection.projectionFingerprint.length) {
    fail('TREE_INSPECTION_UNAVAILABLE', 'The writing tree uses unsupported identity.');
  }
  return phenotype;
}

function ownerBlockMatch(ownerUserId, translationGroupId) {
  return {
    userId: ownerUserId,
    groupId: translationGroupId,
    $or: [
      { authorshipState: 'live' },
      { authorshipState: { $exists: false } },
    ],
    status: { $in: ['in-progress', 'locked'] },
    visibility: { $in: ['public', 'unlisted'] },
    lang: { $type: 'string', $regex: LANGUAGE_PATTERN },
    createdAt: { $type: 'date' },
    roomId: { $type: 'string', $ne: '' },
    title: { $type: 'string', $ne: '' },
  };
}

function validWritingBlock(block, translationGroupId) {
  return block
    && OBJECT_ID_PATTERN.test(String(block._id || ''))
    && String(block.groupId || '').toLowerCase() === translationGroupId
    && typeof block.lang === 'string'
    && block.lang.length <= 5
    && LANGUAGE_PATTERN.test(block.lang)
    && ['in-progress', 'locked'].includes(block.status)
    && ['public', 'unlisted'].includes(block.visibility)
    && block.createdAt instanceof Date
    && !Number.isNaN(block.createdAt.getTime())
    && typeof block.roomId === 'string'
    && block.roomId.length > 0
    && block.roomId.length <= ROOM_ID_MAX_LENGTH
    && typeof block.title === 'string'
    && block.title.length > 0;
}

function ownerVariant(block) {
  return {
    blockId: String(block._id).toLowerCase(),
    ownerUserId: String(block.userId).toLowerCase(),
    translationGroupId: String(block.groupId).toLowerCase(),
    authorshipState: block.authorshipState || 'live',
    lang: block.lang.toLowerCase(),
    status: block.status,
    visibility: block.visibility,
    createdAt: block.createdAt.toISOString(),
    roomId: block.roomId,
  };
}

function discoveryRecord(block) {
  return {
    recordType: 'Block',
    blockId: String(block._id).toLowerCase(),
    ...(block.userId === undefined ? {} : { userId: String(block.userId).toLowerCase() }),
    ...(block.authorshipState === undefined ? {} : { authorshipState: block.authorshipState }),
    groupId: String(block.groupId || '').toLowerCase(),
    status: block.status,
    visibility: block.visibility,
    lang: typeof block.lang === 'string' ? block.lang.toLowerCase() : block.lang,
  };
}

function emptyInspection(status) {
  return {
    inspectionVersion: FOREST_OWNER_TREE_INSPECTION_VERSION,
    status,
    tree: null,
    writing: null,
    translations: [],
    page: { returnedTranslationCount: 0, nextCursor: null },
  };
}

export function buildForestOwnerTreeInspectionService({
  ForestOwnerWorldModel = ForestOwnerWorld,
  ForestWritingTreeModel = ForestWritingTree,
  BlockModel = Block,
} = {}) {
  return async function inspectForestOwnerTree({
    ownerUserId: ownerValue,
    writingTreeId: treeValue,
    preferredContentLang = 'en',
    cursor = null,
    limit,
  }) {
    const ownerUserId = canonicalObjectId(ownerValue, 'ownerUserId');
    const writingTreeId = canonicalTreeId(treeValue);
    const preferredLanguage = canonicalLanguage(preferredContentLang);
    const resolvedLimit = pageSize(limit);
    const afterBlockId = decodeCursor(cursor, writingTreeId);
    const world = await rows(ForestOwnerWorldModel.findOne({
      ownerUserId,
      worldRole: 'primary',
    }));
    const worldStatus = validateWorld(world, ownerUserId);
    if (worldStatus === 'reconciling') return emptyInspection('reconciling');

    const tree = await rows(ForestWritingTreeModel.findOne({
      ownerUserId,
      forestId: world.forestId,
      writingTreeId,
      sourceState: 'active',
      hiddenFromForest: false,
    }, TREE_PROJECTION));
    const phenotype = validateTree(tree, world, ownerUserId, writingTreeId);
    const ownerMatch = ownerBlockMatch(ownerUserId, tree.translationGroupId);
    const preferredQuery = BlockModel.find({
      ...ownerMatch,
      lang: preferredLanguage,
    }, BLOCK_PROJECTION).sort({ createdAt: 1, _id: 1 }).limit(1);
    const foundingQuery = BlockModel.find({
      ...ownerMatch,
      _id: new mongoose.Types.ObjectId(tree.foundingSource.blockId),
    }, BLOCK_PROJECTION).limit(1);
    const earliestQuery = BlockModel.find(ownerMatch, BLOCK_PROJECTION)
      .sort({ createdAt: 1, _id: 1 }).limit(1);
    const translationQuery = BlockModel.find({
      groupId: tree.translationGroupId,
      ...(afterBlockId ? { _id: { $gt: new mongoose.Types.ObjectId(afterBlockId) } } : {}),
    }, BLOCK_PROJECTION).sort({ _id: 1 }).limit(resolvedLimit + 1);
    const [preferredRows, foundingRows, earliestRows, translationRows] = await Promise.all([
      rows(preferredQuery),
      rows(foundingQuery),
      rows(earliestQuery),
      rows(translationQuery),
    ]);
    if (![preferredRows, foundingRows, earliestRows, translationRows].every(Array.isArray)
      || preferredRows.length > 1
      || foundingRows.length > 1
      || earliestRows.length > 1
      || translationRows.length > resolvedLimit + 1) {
      fail('TREE_INSPECTION_UNAVAILABLE', 'The writing inspection read was not bounded.');
    }

    const candidates = new Map();
    for (const block of [...preferredRows, ...foundingRows, ...earliestRows]) {
      if (validWritingBlock(block, tree.translationGroupId)
        && String(block.userId || '').toLowerCase() === ownerUserId
        && (block.authorshipState === undefined || block.authorshipState === 'live')) {
        candidates.set(String(block._id).toLowerCase(), block);
      }
    }
    const selection = selectForestOwnerVariants({
      ownerUserId,
      translationGroupId: tree.translationGroupId,
      preferredContentLang: preferredLanguage,
      capturedFoundingBlockId: tree.foundingSource.blockId,
      variants: [...candidates.values()].map(ownerVariant),
    });
    const displayBlock = candidates.get(selection.displayVariant?.blockId);
    if (!displayBlock) {
      fail('TREE_INSPECTION_NOT_FOUND', 'The writing tree has no current owner writing.');
    }

    const pageRows = translationRows.slice(0, resolvedLimit);
    const translations = [];
    for (const block of pageRows) {
      if (!validWritingBlock(block, tree.translationGroupId)) continue;
      let discovery;
      try {
        discovery = classifyForestTranslationDiscovery({
          authenticatedOwnerId: ownerUserId,
          record: discoveryRecord(block),
        });
      } catch {
        continue;
      }
      if (discovery.classification !== FOREST_TRANSLATION_DISCOVERY.AVAILABLE) continue;
      translations.push({
        lang: block.lang.toLowerCase(),
        title: block.title,
        path: canonicalBlockPath(block.roomId, String(block._id).toLowerCase()),
        ownerAuthored: String(block.userId || '').toLowerCase() === ownerUserId
          && (block.authorshipState === undefined || block.authorshipState === 'live'),
      });
    }
    const hasNextPage = translationRows.length > resolvedLimit && pageRows.length > 0;

    return {
      inspectionVersion: FOREST_OWNER_TREE_INSPECTION_VERSION,
      status: 'ready',
      tree: {
        id: tree.writingTreeId,
        phenotypeId: phenotype.id,
        creationSeason: tree.projection.creationSeason,
        recordRevision: tree.recordRevision,
      },
      writing: {
        title: displayBlock.title,
        lang: selection.displayVariant.lang,
        createdAt: selection.displayVariant.createdAt,
        path: canonicalBlockPath(
          selection.displayVariant.roomId,
          selection.displayVariant.blockId,
        ),
      },
      translations,
      page: {
        returnedTranslationCount: translations.length,
        nextCursor: hasNextPage
          ? encodeCursor(writingTreeId, String(pageRows.at(-1)._id).toLowerCase())
          : null,
      },
    };
  };
}

export const inspectForestOwnerTree = buildForestOwnerTreeInspectionService();

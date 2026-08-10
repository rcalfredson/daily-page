import Block from './models/Block.js';
import { publiclyVisibleBlockMatch } from './blockService.js';
import { resolvePostTranslation } from '../services/postTranslationResolver.js';

const ROOM_EDITORIAL_FIELDS = [
  '_id',
  'title',
  'roomId',
  'lang',
  'groupId',
  'originalBlock',
  'sourceLanguage',
  'status',
  'visibility',
  'createdAt',
  'editorial.clusterKey',
  'editorial.guideTitle',
  'editorial.role',
  'editorial.sequence'
].join(' ');

const CLUSTER_ROLES = {
  pillar: 0,
  texture: 1,
  companion: 2
};

function toId(value) {
  return value ? String(value) : null;
}

function readGuideTitle(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function roleLabel(role) {
  if (!role) return null;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function compareClusterBlocks(a, b) {
  const aRole = CLUSTER_ROLES[a.editorial?.role] ?? Number.POSITIVE_INFINITY;
  const bRole = CLUSTER_ROLES[b.editorial?.role] ?? Number.POSITIVE_INFINITY;
  if (aRole !== bRole) return aRole - bRole;

  const aSeq = Number.isInteger(a.editorial?.sequence) ? a.editorial.sequence : Number.POSITIVE_INFINITY;
  const bSeq = Number.isInteger(b.editorial?.sequence) ? b.editorial.sequence : Number.POSITIVE_INFINITY;
  if (aSeq !== bSeq) return aSeq - bSeq;

  const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (aCreated !== bCreated) return aCreated - bCreated;

  return String(a.title || '').localeCompare(String(b.title || ''));
}

function compareClusterSummaries(a, b) {
  if (a.hasPillar !== b.hasPillar) return a.hasPillar ? -1 : 1;
  return compareClusterBlocks(a.sortBlock, b.sortBlock);
}

function dedupeTranslations(blocks, preferredLang) {
  const byGroup = new Map();

  for (const block of blocks) {
    const key = block.groupId || toId(block._id);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(block);
  }

  return Array.from(byGroup.values())
    .map(family => resolvePostTranslation(family, preferredLang)?.record)
    .filter(Boolean);
}

function resolveClusterLabel(blocks, entryPoint) {
  const guideTitle = blocks
    .map((block) => readGuideTitle(block.editorial?.guideTitle))
    .find(Boolean);

  return guideTitle || entryPoint?.title || null;
}

function toEntryPoint(block) {
  if (!block?._id || !block?.roomId) return null;

  return {
    id: toId(block._id),
    roomId: block.roomId,
    title: block.title || 'Untitled',
    lang: block.lang || null,
    role: block.editorial?.role || null,
    roleLabel: roleLabel(block.editorial?.role),
    sequence: Number.isInteger(block.editorial?.sequence) ? block.editorial.sequence : null
  };
}

export async function getRoomEditorialClusters(options = {}) {
  const {
    roomId,
    preferredLang = 'en',
    maxClusters = 4
  } = options;

  if (!roomId) return [];

  const rawBlocks = await Block.find(publiclyVisibleBlockMatch({
    roomId,
    status: 'locked',
    'editorial.clusterKey': { $exists: true, $ne: null }
  }))
    .select(ROOM_EDITORIAL_FIELDS)
    .lean();

  if (!rawBlocks.length) return [];

  const roomBlocks = dedupeTranslations(
    rawBlocks.filter((block) => readGuideTitle(block.editorial?.clusterKey) || block.editorial?.role),
    preferredLang
  );

  const clustersByKey = new Map();

  for (const block of roomBlocks) {
    const clusterKey = readGuideTitle(block.editorial?.clusterKey);
    if (!clusterKey) continue;

    const current = clustersByKey.get(clusterKey) || [];
    current.push(block);
    clustersByKey.set(clusterKey, current);
  }

  const clusters = Array.from(clustersByKey.entries())
    .map(([key, blocks]) => {
      const sortedBlocks = blocks.slice().sort(compareClusterBlocks);
      const pillar = sortedBlocks.find((block) => block.editorial?.role === 'pillar') || null;
      const entryPointBlock = pillar || sortedBlocks[0] || null;

      if (!entryPointBlock) return null;

      const qualifies = Boolean(pillar) || sortedBlocks.length > 1;
      if (!qualifies) return null;

      return {
        key,
        label: resolveClusterLabel(sortedBlocks, entryPointBlock),
        totalItems: sortedBlocks.length,
        hasPillar: Boolean(pillar),
        entryPoint: toEntryPoint(entryPointBlock),
        sortBlock: entryPointBlock
      };
    })
    .filter(Boolean)
    .sort(compareClusterSummaries)
    .slice(0, maxClusters)
    .map((cluster) => {
      const publicCluster = { ...cluster };
      delete publicCluster.sortBlock;
      return publicCluster;
    });

  return clusters;
}

import Block from './models/Block.js';

const REFERENCE_BLOCK_FIELDS = [
  '_id',
  'title',
  'roomId',
  'lang',
  'groupId',
  'status',
  'visibility',
  'createdAt',
  'editorial.guideTitle',
  'editorial.role',
  'editorial.sequence'
].join(' ');

const CLUSTER_ROLES = {
  pillar: 0,
  companion: 1,
  texture: 2
};

function toId(value) {
  return value ? String(value) : null;
}

function uniqueIds(ids = []) {
  return Array.from(new Set(ids.map(toId).filter(Boolean)));
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

function toEditorialLink(block) {
  if (!block?._id || !block?.roomId) return null;

  return {
    id: toId(block._id),
    roomId: block.roomId,
    title: block.title || 'Untitled',
    lang: block.lang || null,
    status: block.status || null,
    role: block.editorial?.role || null,
    roleLabel: roleLabel(block.editorial?.role),
    sequence: Number.isInteger(block.editorial?.sequence) ? block.editorial.sequence : null
  };
}

function compareClusterBlocks(a, b) {
  const aSeq = Number.isInteger(a.editorial?.sequence) ? a.editorial.sequence : Number.POSITIVE_INFINITY;
  const bSeq = Number.isInteger(b.editorial?.sequence) ? b.editorial.sequence : Number.POSITIVE_INFINITY;
  if (aSeq !== bSeq) return aSeq - bSeq;

  const aRole = CLUSTER_ROLES[a.editorial?.role] ?? Number.POSITIVE_INFINITY;
  const bRole = CLUSTER_ROLES[b.editorial?.role] ?? Number.POSITIVE_INFINITY;
  if (aRole !== bRole) return aRole - bRole;

  const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return aCreated - bCreated;
}

async function fetchReferenceBlocks(referenceIds) {
  if (!referenceIds.length) return [];
  return Block.find({ _id: { $in: referenceIds } })
    .select(REFERENCE_BLOCK_FIELDS)
    .lean();
}

async function fetchPreferredTranslations(groupIds, lang, roomId) {
  if (!groupIds.length || !lang) return [];
  return Block.find({
    groupId: { $in: groupIds },
    lang,
    roomId,
    visibility: 'public'
  })
    .select(REFERENCE_BLOCK_FIELDS)
    .lean();
}

async function fetchClusterBlocks(clusterKey, roomId, lang, currentBlockId) {
  if (!clusterKey || !roomId || !lang) return [];
  return Block.find({
    roomId,
    lang,
    visibility: 'public',
    'editorial.clusterKey': clusterKey,
    _id: { $ne: currentBlockId }
  })
    .select(REFERENCE_BLOCK_FIELDS)
    .lean();
}

function resolveClusterLabel({
  currentBlock,
  primaryPillar,
  clusterBlocks
}) {
  const candidates = [
    readGuideTitle(currentBlock?.editorial?.guideTitle),
    readGuideTitle(primaryPillar?.editorial?.guideTitle),
    ...clusterBlocks.map((item) => readGuideTitle(item?.editorial?.guideTitle)),
    primaryPillar?.title || null,
    clusterBlocks.find((item) => item?.editorial?.role === 'pillar')?.title || null,
    clusterBlocks[0]?.title || null,
    currentBlock?.title || null
  ];

  return candidates.find(Boolean) || null;
}

export async function getBlockEditorialContext(block, options = {}) {
  const editorial = block?.editorial;
  if (!editorial || typeof editorial !== 'object') return null;

  const roomId = block.roomId;
  const lang = block.lang || 'en';
  const blockId = toId(block._id);
  const role = editorial.role || null;
  const sequence = Number.isInteger(editorial.sequence) ? editorial.sequence : null;
  const clusterKey = typeof editorial.clusterKey === 'string' ? editorial.clusterKey.trim() : null;
  const referenceIds = uniqueIds([
    editorial.primaryPillarBlockId,
    ...(Array.isArray(editorial.relatedBlockIds) ? editorial.relatedBlockIds : [])
  ]).filter((id) => id !== blockId);

  const [rawReferenceBlocks, rawClusterBlocks] = await Promise.all([
    fetchReferenceBlocks(referenceIds),
    fetchClusterBlocks(clusterKey, roomId, lang, blockId)
  ]);

  const referenceBlocksById = new Map(rawReferenceBlocks.map((item) => [toId(item._id), item]));
  const translationGroupIds = uniqueIds(
    rawReferenceBlocks
      .filter((item) => item.roomId === roomId && item.visibility === 'public' && item.lang !== lang)
      .map((item) => item.groupId)
  );

  const preferredTranslations = await fetchPreferredTranslations(translationGroupIds, lang, roomId);
  const preferredTranslationsByGroup = new Map(
    preferredTranslations.map((item) => [item.groupId, item])
  );

  function resolveReference(id) {
    const rawBlock = referenceBlocksById.get(toId(id));
    if (!rawBlock || rawBlock.roomId !== roomId || rawBlock.visibility !== 'public') return null;
    if (rawBlock.lang === lang) return rawBlock;
    return preferredTranslationsByGroup.get(rawBlock.groupId) || null;
  }

  const resolvedPrimaryPillar = resolveReference(editorial.primaryPillarBlockId);
  const relatedBlocks = [];
  const seenRelatedIds = new Set();

  for (const relatedId of Array.isArray(editorial.relatedBlockIds) ? editorial.relatedBlockIds : []) {
    const resolved = resolveReference(relatedId);
    const resolvedId = toId(resolved?._id);
    if (!resolvedId || seenRelatedIds.has(resolvedId) || resolvedId === toId(resolvedPrimaryPillar?._id)) {
      continue;
    }

    seenRelatedIds.add(resolvedId);
    relatedBlocks.push(resolved);
  }

  const clusterItems = rawClusterBlocks
    .slice()
    .sort(compareClusterBlocks)
    .map(toEditorialLink)
    .filter(Boolean)
    .filter((item) => item.id !== toId(resolvedPrimaryPillar?._id))
    .filter((item) => !seenRelatedIds.has(item.id))
    .slice(0, options.maxClusterItems || 6);

  const primaryPillar =
    role === 'pillar'
      ? null
      : toEditorialLink(resolvedPrimaryPillar);

  const related = relatedBlocks
    .map(toEditorialLink)
    .filter(Boolean);

  const clusterLabel = resolveClusterLabel({
    currentBlock: block,
    primaryPillar: resolvedPrimaryPillar,
    clusterBlocks: rawClusterBlocks
  });

  const cluster =
    clusterKey && (clusterItems.length || role || primaryPillar)
      ? {
          key: clusterKey,
          label: clusterLabel,
          totalItems: rawClusterBlocks.length + 1,
          nearby: clusterItems
        }
      : null;

  const context = {
    role: role
      ? {
          key: role,
          label: roleLabel(role),
          sequence
        }
      : null,
    primaryPillar,
    related,
    cluster
  };

  return context.role || context.primaryPillar || context.related.length || context.cluster
    ? context
    : null;
}

import Block from './models/Block.js';
import { publiclyVisibleBlockMatch } from './blockService.js';
import * as cache from '../services/cache.js';
import { extractSearchTerms, rankBlockRecommendations } from '../recommendations/contentRanker.js';

const CANDIDATE_FIELDS = [
  '_id',
  'groupId',
  'roomId',
  'lang',
  'title',
  'description',
  'content',
  'tags',
  'creator',
  'voteCount',
  'createdAt'
].join(' ');

const CANDIDATE_LIMIT = 80;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_STALE_TTL_MS = 60 * 60 * 1000;

function recommendationCacheKey(block, limit) {
  return `block-recommendations-${block._id}-${new Date(block.updatedAt || 0).getTime()}-${limit}`;
}

async function calculateBlockRecommendations(block, limit) {
  const candidates = await fetchCandidates(block);
  return rankBlockRecommendations(block, candidates, { limit }).map(toViewModel);
}

function cacheOptions() {
  return { ttlMs: CACHE_TTL_MS, jitterMs: 60 * 1000, staleTtlMs: CACHE_STALE_TTL_MS };
}

function recommendationMatch(block) {
  return publiclyVisibleBlockMatch({
    _id: { $ne: block._id },
    groupId: { $ne: block.groupId },
    lang: block.lang || 'en'
  });
}

function mergeCandidates(...groups) {
  const byId = new Map();
  for (const candidate of groups.flat()) {
    if (candidate?._id) byId.set(String(candidate._id), candidate);
  }
  return Array.from(byId.values());
}

async function fetchCandidates(block) {
  const baseMatch = recommendationMatch(block);
  const searchTerms = extractSearchTerms(block);
  const affinity = [];

  if (block.roomId) affinity.push({ roomId: block.roomId });
  if (Array.isArray(block.tags) && block.tags.length) affinity.push({ tags: { $in: block.tags } });

  const textPromise = searchTerms.length
    ? Block.find({
        $and: [
          baseMatch,
          { $text: { $search: searchTerms.join(' ') } }
        ]
      })
      .select({ ...Object.fromEntries(CANDIDATE_FIELDS.split(' ').map((field) => [field, 1])), textScore: { $meta: 'textScore' } })
      .sort({ textScore: { $meta: 'textScore' }, voteCount: -1 })
      .limit(CANDIDATE_LIMIT)
      .lean()
    : Promise.resolve([]);

  const affinityPromise = Block.find({
    $and: [
      baseMatch,
      affinity.length ? { $or: affinity } : {}
    ]
  })
    .select(CANDIDATE_FIELDS)
    .sort({ voteCount: -1, updatedAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .lean();

  const [textCandidates, affinityCandidates] = await Promise.all([textPromise, affinityPromise]);
  return mergeCandidates(textCandidates, affinityCandidates);
}

function toViewModel(block) {
  const description = String(block.description || '').replace(/\s+/g, ' ').trim();
  return {
    id: String(block._id),
    roomId: block.roomId,
    lang: block.lang || 'en',
    title: block.title,
    description: description.slice(0, 180),
    tags: (block.tags || []).slice(0, 3),
    creator: block.creator,
    createdAt: block.createdAt,
    score: block.recommendationScore
  };
}

export async function getBlockRecommendations(block, options = {}) {
  if (!block?._id) return [];
  const limit = options.limit || 5;
  const cacheKey = recommendationCacheKey(block, limit);

  return cache.get(
    cacheKey,
    calculateBlockRecommendations,
    [block, limit],
    cacheOptions()
  );
}

// Optional recommendations must never hold up the main post response. A cache
// miss starts the same deduplicated calculation used by the hydration endpoint
// and reports null so the view can render a loading shell.
export function getBlockRecommendationsNonBlocking(block, options = {}) {
  if (!block?._id) return [];
  const limit = options.limit || 5;
  const cacheKey = recommendationCacheKey(block, limit);

  const recommendations = cache.getNonBlocking(
    cacheKey,
    calculateBlockRecommendations,
    [block, limit],
    cacheOptions()
  );

  return recommendations === undefined ? null : recommendations;
}

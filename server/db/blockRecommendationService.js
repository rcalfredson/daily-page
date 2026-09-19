import Block from './models/Block.js';
import * as cache from '../services/cache.js';
import { getHomeDiscoveryCandidates } from '../services/homeDiscovery.js';
import {
  extractSearchTerms,
  rankBlockRecommendations,
  rankElsewhereRecommendations
} from '../recommendations/contentRanker.js';

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
  'authorshipState',
  'voteCount',
  'createdAt'
].join(' ');

const CANDIDATE_LIMIT = 80;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_STALE_TTL_MS = 60 * 60 * 1000;
const RELATED_LIMIT = 3;
const ELSEWHERE_LIMIT = 2;

function emptyRecommendationLanes() {
  return { related: [], elsewhere: [] };
}

function recommendationCacheKey(block, relatedLimit, elsewhereLimit) {
  return [
    'block-recommendation-lanes-v2',
    block._id,
    new Date(block.updatedAt || 0).getTime(),
    relatedLimit,
    elsewhereLimit
  ].join('-');
}

async function calculateBlockRecommendationLanes(block, relatedLimit, elsewhereLimit) {
  const [relatedCandidates, discoveryCandidates] = await Promise.all([
    fetchRelatedCandidates(block),
    getHomeDiscoveryCandidates({ preferredLang: block.lang || 'en' })
  ]);
  const related = rankBlockRecommendations(block, relatedCandidates, {
    limit: relatedLimit
  });
  const elsewhere = rankElsewhereRecommendations(block, discoveryCandidates, {
    limit: elsewhereLimit,
    excludeGroups: related.map(candidate => candidate.groupId || candidate._id)
  });

  return {
    related: related.map(toViewModel),
    elsewhere: elsewhere.map(toViewModel)
  };
}

function cacheOptions() {
  return { ttlMs: CACHE_TTL_MS, jitterMs: 60 * 1000, staleTtlMs: CACHE_STALE_TTL_MS };
}

export function buildRelatedRecommendationMatch(block) {
  return {
    _id: { $ne: block._id },
    groupId: { $ne: block.groupId },
    lang: block.lang || 'en',
    visibility: 'public',
    status: 'locked'
  };
}

function mergeCandidates(...groups) {
  const byId = new Map();
  for (const candidate of groups.flat()) {
    if (candidate?._id) byId.set(String(candidate._id), candidate);
  }
  return Array.from(byId.values());
}

async function fetchRelatedCandidates(block) {
  const baseMatch = buildRelatedRecommendationMatch(block);
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
    authorshipState: block.authorshipState,
    createdAt: block.createdAt,
    score: block.recommendationScore
  };
}

export async function getBlockRecommendationLanes(block, options = {}) {
  if (!block?._id) return emptyRecommendationLanes();
  const relatedLimit = options.relatedLimit || RELATED_LIMIT;
  const elsewhereLimit = options.elsewhereLimit || ELSEWHERE_LIMIT;
  const cacheKey = recommendationCacheKey(block, relatedLimit, elsewhereLimit);

  return cache.get(
    cacheKey,
    calculateBlockRecommendationLanes,
    [block, relatedLimit, elsewhereLimit],
    cacheOptions()
  );
}

// Optional recommendations must never hold up the main post response. A cache
// miss starts the same deduplicated calculation used by the hydration endpoint
// and reports null so the view can render a loading shell.
export function getBlockRecommendationLanesNonBlocking(block, options = {}) {
  if (!block?._id) return emptyRecommendationLanes();
  const relatedLimit = options.relatedLimit || RELATED_LIMIT;
  const elsewhereLimit = options.elsewhereLimit || ELSEWHERE_LIMIT;
  const cacheKey = recommendationCacheKey(block, relatedLimit, elsewhereLimit);

  const recommendations = cache.getNonBlocking(
    cacheKey,
    calculateBlockRecommendationLanes,
    [block, relatedLimit, elsewhereLimit],
    cacheOptions()
  );

  return recommendations === undefined ? null : recommendations;
}

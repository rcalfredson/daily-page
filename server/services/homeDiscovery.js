import Block from '../db/models/Block.js';
import { localeFamilySelectionStages } from '../db/blockService.js';
import * as cache from './cache.js';

export const HOME_DISCOVERY_POOL_LIMIT = 600;
export const HOME_DISCOVERY_SHELF_LIMIT = 6;

const DISCOVERY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DISCOVERY_CACHE_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_DISCOVERY_CONTENT_LENGTH = 200;
const MIN_DISCOVERY_DESCRIPTION_LENGTH = 40;
const DISCOVERY_ROTATION_JITTER = 5;

function normalizedText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function candidateId(candidate) {
  return String(candidate?._id || candidate?.groupId || '');
}

function candidateGroup(candidate) {
  return String(candidate?.groupId || candidate?._id || '');
}

function normalizedTags(candidate) {
  return new Set(
    (candidate?.tags || [])
      .map(tag => normalizedText(tag).toLocaleLowerCase())
      .filter(Boolean)
  );
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicJitter(seed, candidate) {
  return (stableHash(`${seed}:${candidateGroup(candidate)}`) / 0xffffffff)
    * DISCOVERY_ROTATION_JITTER;
}

function ageScore(createdAt, now) {
  const timestamp = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  const ageInDays = Math.max(0, (now.getTime() - timestamp) / 86400000);
  return Math.exp(-ageInDays / 1460);
}

function candidateQuality(candidate, now) {
  const descriptionLength = normalizedText(candidate?.description).length;
  const contentLength = Number(candidate?.contentLength) || 0;
  const tagCount = Array.isArray(candidate?.tags) ? candidate.tags.length : 0;
  const votes = Math.max(0, Number(candidate?.familyVoteCount ?? candidate?.voteCount) || 0);
  const role = candidate?.editorial?.role;

  return (
    (descriptionLength >= MIN_DISCOVERY_DESCRIPTION_LENGTH ? 3 : 0)
    + (candidate?.bannerImage?.url ? 2 : 0)
    + Math.min(2, tagCount * 0.5)
    + (contentLength >= 1000 ? 2 : contentLength >= MIN_DISCOVERY_CONTENT_LENGTH ? 1 : 0)
    + (role === 'pillar' ? 4 : role === 'companion' ? 2 : role === 'texture' ? 1 : 0)
    + Math.min(3, Math.log1p(votes))
    + ageScore(candidate?.familyCreatedAt || candidate?.createdAt, now)
  );
}

function tagOverlap(candidate, selected) {
  const candidateTags = normalizedTags(candidate);
  if (!candidateTags.size || !selected.length) return 0;

  const selectedTags = new Set(selected.flatMap(item => [...normalizedTags(item)]));
  const shared = [...candidateTags].filter(tag => selectedTags.has(tag)).length;
  return shared / candidateTags.size;
}

function isEligibleDiscoveryCandidate(candidate) {
  const contentLength = Number(candidate?.contentLength) || 0;
  const descriptionLength = normalizedText(candidate?.description).length;
  return Boolean(
    candidateId(candidate)
    && candidateGroup(candidate)
    && normalizedText(candidate?.title)
    && normalizedText(candidate?.roomId)
    && (
      contentLength >= MIN_DISCOVERY_CONTENT_LENGTH
      || descriptionLength >= MIN_DISCOVERY_DESCRIPTION_LENGTH
    )
  );
}

export function homeDiscoveryDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function buildHomeDiscoveryCandidatePipeline(preferredLang, limit = HOME_DISCOVERY_POOL_LIMIT) {
  return [
    {
      $match: {
        visibility: 'public',
        status: 'locked'
      }
    },
    {
      $project: {
        _id: 1,
        groupId: 1,
        roomId: 1,
        lang: 1,
        title: 1,
        description: 1,
        tags: 1,
        bannerImage: 1,
        creator: 1,
        authorshipState: 1,
        voteCount: 1,
        createdAt: 1,
        originalBlock: 1,
        editorial: 1,
        contentLength: {
          $strLenCP: { $ifNull: ['$content', ''] }
        }
      }
    },
    ...localeFamilySelectionStages(preferredLang),
    { $sort: { familyCreatedAt: -1, _id: 1 } },
    { $limit: limit }
  ];
}

export async function getHomeDiscoveryCandidates({
  preferredLang = 'en',
  limit = HOME_DISCOVERY_POOL_LIMIT
} = {}) {
  const cacheKey = `home-discovery-candidates-${preferredLang}-${limit}`;
  return cache.get(
    cacheKey,
    async () => Block.aggregate(
      buildHomeDiscoveryCandidatePipeline(preferredLang, limit)
    ).exec(),
    [],
    {
      ttlMs: DISCOVERY_CACHE_TTL_MS,
      jitterMs: 15 * 60 * 1000,
      staleTtlMs: DISCOVERY_CACHE_STALE_TTL_MS
    }
  );
}

export function selectHomeDiscoveryPosts(candidates, {
  limit = HOME_DISCOVERY_SHELF_LIMIT,
  now = new Date()
} = {}) {
  if (!Number.isInteger(limit) || limit <= 0) return [];

  const seed = homeDiscoveryDateKey(now);
  const eligible = [];
  const seenGroups = new Set();

  for (const candidate of candidates || []) {
    const group = candidateGroup(candidate);
    if (!isEligibleDiscoveryCandidate(candidate) || seenGroups.has(group)) continue;
    seenGroups.add(group);
    eligible.push(candidate);
  }

  const selected = [];
  const selectedIds = new Set();
  const selectedRooms = new Set();

  while (selected.length < limit) {
    const unusedRoomCandidates = eligible.filter(candidate => (
      !selectedIds.has(candidateId(candidate))
      && !selectedRooms.has(String(candidate.roomId))
    ));
    const remainingCandidates = eligible.filter(candidate => !selectedIds.has(candidateId(candidate)));
    const pool = unusedRoomCandidates.length ? unusedRoomCandidates : remainingCandidates;
    if (!pool.length) break;

    const next = pool
      .map(candidate => ({
        candidate,
        score: candidateQuality(candidate, now)
          + deterministicJitter(seed, candidate)
          - (tagOverlap(candidate, selected) * 4)
      }))
      .sort((a, b) => b.score - a.score || candidateId(a.candidate).localeCompare(candidateId(b.candidate)))[0]
      .candidate;

    selected.push(next);
    selectedIds.add(candidateId(next));
    selectedRooms.add(String(next.roomId));
  }

  return selected;
}

export async function getHomeDiscoveryShelf({
  preferredLang = 'en',
  limit = HOME_DISCOVERY_SHELF_LIMIT,
  candidateLimit = HOME_DISCOVERY_POOL_LIMIT,
  now = new Date()
} = {}) {
  const candidates = await getHomeDiscoveryCandidates({
    preferredLang,
    limit: candidateLimit
  });
  return selectHomeDiscoveryPosts(candidates, { limit, now });
}

const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
const MAX_FIELD_TOKENS = 1200;

// These are deliberately conservative. Keeping meaningful words is more useful
// than aggressive, English-only stemming on a multilingual site.
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'me', 'my', 'not', 'of', 'on', 'or', 'our', 'she', 'so', 'than', 'that',
  'the', 'their', 'them', 'there', 'they', 'this', 'to', 'up', 'us', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'you', 'your'
]);

const FIELD_WEIGHTS = Object.freeze({
  title: 4,
  tags: 5,
  description: 2,
  content: 1
});

function tokenize(value, limit = MAX_FIELD_TOKENS) {
  const matches = String(value || '').toLocaleLowerCase().match(TOKEN_PATTERN) || [];
  return matches
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .slice(0, limit);
}

function weightedTermFrequency(block) {
  const frequencies = new Map();
  const fields = {
    title: block?.title,
    tags: Array.isArray(block?.tags) ? block.tags.join(' ') : '',
    description: block?.description,
    content: block?.content
  };

  for (const [field, value] of Object.entries(fields)) {
    for (const token of tokenize(value)) {
      frequencies.set(token, (frequencies.get(token) || 0) + FIELD_WEIGHTS[field]);
    }
  }

  return frequencies;
}

function documentFrequencies(termMaps) {
  const frequencies = new Map();
  for (const terms of termMaps) {
    for (const token of terms.keys()) {
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }
  }
  return frequencies;
}

function vectorize(terms, frequencies, documentCount) {
  const vector = new Map();
  for (const [token, frequency] of terms) {
    const inverseDocumentFrequency = Math.log((documentCount + 1) / ((frequencies.get(token) || 0) + 1)) + 1;
    vector.set(token, (1 + Math.log(frequency)) * inverseDocumentFrequency);
  }
  return vector;
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const value of a.values()) magnitudeA += value * value;
  for (const value of b.values()) magnitudeB += value * value;
  if (!magnitudeA || !magnitudeB) return 0;

  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [token, value] of smaller) {
    dotProduct += value * (larger.get(token) || 0);
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function normalizedTags(block) {
  return new Set((block?.tags || []).map((tag) => String(tag).trim().toLocaleLowerCase()).filter(Boolean));
}

function tagSimilarity(a, b) {
  const aTags = normalizedTags(a);
  const bTags = normalizedTags(b);
  if (!aTags.size || !bTags.size) return 0;
  const overlap = Array.from(aTags).filter((tag) => bTags.has(tag)).length;
  return overlap / new Set([...aTags, ...bTags]).size;
}

function freshnessScore(createdAt, now) {
  const timestamp = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  const ageInDays = Math.max(0, (now.getTime() - timestamp) / 86400000);
  return Math.exp(-ageInDays / 730);
}

function qualityScore(voteCount) {
  const votes = Number(voteCount) || 0;
  return 1 / (1 + Math.exp(-votes / 5));
}

function idOf(block) {
  return block?._id ? String(block._id) : null;
}

function groupOf(block) {
  return block?.groupId ? String(block.groupId) : idOf(block);
}

export function extractSearchTerms(block, limit = 14) {
  return Array.from(weightedTermFrequency(block).entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

export function rankBlockRecommendations(source, candidates, options = {}) {
  const limit = options.limit || 5;
  const now = options.now || new Date();
  const sourceId = idOf(source);
  const sourceGroup = groupOf(source);
  const seenGroups = new Set();
  const eligible = [];

  for (const candidate of candidates || []) {
    const candidateId = idOf(candidate);
    const candidateGroup = groupOf(candidate);
    if (!candidateId || candidateId === sourceId || candidateGroup === sourceGroup || seenGroups.has(candidateGroup)) {
      continue;
    }
    seenGroups.add(candidateGroup);
    eligible.push(candidate);
  }

  if (!eligible.length) return [];

  const termMaps = [source, ...eligible].map(weightedTermFrequency);
  const frequencies = documentFrequencies(termMaps);
  const vectors = termMaps.map((terms) => vectorize(terms, frequencies, termMaps.length));
  const sourceVector = vectors[0];

  return eligible
    .map((candidate, index) => {
      const semantic = cosineSimilarity(sourceVector, vectors[index + 1]);
      const tags = tagSimilarity(source, candidate);
      const sameRoom = source?.roomId && source.roomId === candidate.roomId ? 1 : 0;
      const freshness = freshnessScore(candidate.createdAt, now);
      const quality = qualityScore(candidate.voteCount);
      const score = semantic * 0.76 + tags * 0.12 + sameRoom * 0.06 + freshness * 0.03 + quality * 0.03;

      return { candidate, score, semantic, tags };
    })
    .filter((result) => result.semantic > 0 || result.tags > 0 || result.candidate.roomId === source?.roomId)
    .sort((a, b) => b.score - a.score || new Date(b.candidate.createdAt || 0) - new Date(a.candidate.createdAt || 0))
    .slice(0, limit)
    .map(({ candidate, score }) => ({
      ...candidate,
      recommendationScore: score
    }));
}

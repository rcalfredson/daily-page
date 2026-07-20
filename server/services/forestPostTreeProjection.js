import { FOREST_PHENOTYPES } from './forest/v3/phenotype.js';
import { createRandom, hashSeed } from './forest/v3/random.js';

export const FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION = 1;
export const FOREST_POST_TREE_MAPPING_VERSION = 1;
export const FOREST_POST_TREE_HABITATS = Object.freeze(['neutral-grove', 'rocky-edge']);

const POST_FIELDS = Object.freeze([
  'id', 'createdAt', 'roomId', 'wordCount', 'collaboratorCount', 'translationCount',
  'commentCount', 'reactionCount', 'questApproved'
]);
const CONTEXT_FIELDS = Object.freeze(['habitat']);
const MUTABLE_COUNTS = Object.freeze([
  'wordCount', 'collaboratorCount', 'translationCount', 'commentCount', 'reactionCount'
]);

function exactObject(value, allowedFields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const extra = Object.keys(value).filter(field => !allowedFields.includes(field));
  if (extra.length) throw new Error(`${label} contains unsupported fields: ${extra.join(', ')}.`);
}

function boundedString(value, field, maximum, { required = false } = {}) {
  if (value === undefined && !required) return;
  if (typeof value !== 'string' || !value.length || value.length > maximum) {
    throw new Error(`${field} must be a non-empty string of at most ${maximum} characters.`);
  }
}

function validatePost(post) {
  exactObject(post, POST_FIELDS, 'Forest post projection input');
  boundedString(post.id, 'id', 128, { required: true });
  boundedString(post.roomId, 'roomId', 120);
  if (post.createdAt !== undefined) {
    boundedString(post.createdAt, 'createdAt', 32);
    const parsed = new Date(post.createdAt);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== post.createdAt) {
      throw new Error('createdAt must be an exact ISO-8601 UTC timestamp.');
    }
  }
  for (const field of MUTABLE_COUNTS) {
    if (post[field] !== undefined
      && (!Number.isSafeInteger(post[field]) || post[field] < 0 || post[field] > 1000000)) {
      throw new Error(`${field} must be a safe integer from 0 through 1000000.`);
    }
  }
  if (post.questApproved !== undefined && typeof post.questApproved !== 'boolean') {
    throw new Error('questApproved must be boolean when provided.');
  }
}

function validateContext(context) {
  exactObject(context, CONTEXT_FIELDS, 'Forest generation context');
  if (!FOREST_POST_TREE_HABITATS.includes(context.habitat)) {
    throw new Error(`habitat must be one of: ${FOREST_POST_TREE_HABITATS.join(', ')}.`);
  }
}

function creationSeason(createdAt) {
  if (createdAt === undefined) return 'unknown';
  const month = new Date(createdAt).getUTCMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function canonicalPhenotypes(phenotypes, habitat) {
  if (!Array.isArray(phenotypes) || !phenotypes.length) {
    throw new Error('Forest post projection requires registered phenotypes.');
  }
  const ordered = phenotypes.slice().sort((first, second) => first.id.localeCompare(second.id));
  if (new Set(ordered.map(({ id }) => id)).size !== ordered.length) {
    throw new Error('Forest post projection phenotype ids must be unique.');
  }
  for (const phenotype of ordered) {
    if (typeof phenotype.id !== 'string' || !Number.isInteger(phenotype.assetVersion)
      || !(phenotype.postTreeMeaning?.habitatWeights?.[habitat] > 0)) {
      throw new Error(`Phenotype ${phenotype.id || '(unknown)'} has no bounded ${habitat} meaning.`);
    }
  }
  return ordered;
}

export function selectForestPostTreePhenotype(postId, habitat, phenotypes = FOREST_PHENOTYPES) {
  const ordered = canonicalPhenotypes(phenotypes, habitat);
  const total = ordered.reduce((sum, phenotype) => (
    sum + phenotype.postTreeMeaning.habitatWeights[habitat]
  ), 0);
  let choice = createRandom(hashSeed([
    `forest-post-tree-mapping-v${FOREST_POST_TREE_MAPPING_VERSION}`,
    'phenotype', postId, habitat
  ].join(':')))() * total;
  for (const phenotype of ordered) {
    choice -= phenotype.postTreeMeaning.habitatWeights[habitat];
    if (choice < 0) return phenotype;
  }
  return ordered.at(-1);
}

function explanationForSeason(season) {
  if (season === 'unknown') {
    return 'No creation timestamp was supplied, so the specimen kept its seed-selected natural tint.';
  }
  return `${season[0].toUpperCase()}${season.slice(1)} creation left a restrained permanent foliage tint.`;
}

function fingerprint(parts) {
  return parts.join(':');
}

export function projectPostToForestTree(post, context) {
  validatePost(post);
  validateContext(context);
  const phenotype = selectForestPostTreePhenotype(post.id, context.habitat);
  const seed = hashSeed([
    `forest-post-tree-mapping-v${FOREST_POST_TREE_MAPPING_VERSION}`, 'specimen', post.id
  ].join(':'));
  const season = creationSeason(post.createdAt);
  const foliagePaletteId = season === 'unknown' ? null
    : phenotype.postTreeMeaning.creationSeasonPaletteIds[season];
  if (foliagePaletteId !== null
    && !phenotype.foliagePalettes.some(({ id }) => id === foliagePaletteId)) {
    throw new Error(`Phenotype ${phenotype.id} does not own palette ${foliagePaletteId}.`);
  }
  const visualFingerprint = fingerprint([
    `mapping-v${FOREST_POST_TREE_MAPPING_VERSION}`,
    foliagePaletteId ? `foliage-${foliagePaletteId}` : 'foliage-seed-selected'
  ]);
  const projectionFingerprint = fingerprint([
    visualFingerprint, `seed-${seed}`, `${phenotype.id}@${phenotype.assetVersion}`,
    `habitat-${context.habitat}`, `season-${season}`
  ]);

  return {
    schemaVersion: FOREST_POST_TREE_PROJECTION_SCHEMA_VERSION,
    mappingVersion: FOREST_POST_TREE_MAPPING_VERSION,
    specimen: { seed, source: 'stable-writing-identity' },
    phenotype: { id: phenotype.id, version: phenotype.assetVersion },
    habitat: { id: context.habitat, influence: 'soft-bias' },
    permanentTraits: { creationSeason: season, foliagePaletteId },
    surroundings: {},
    explanations: [
      {
        token: 'stable-writing-identity',
        text: 'Stable writing identity selected this specimen seed.'
      },
      {
        token: 'habitat-soft-bias',
        text: context.habitat === 'rocky-edge'
          ? 'Rocky-edge habitat favored highland forms without requiring one species.'
          : 'Neutral-grove habitat softly favored familiar grove forms without excluding any species.'
      },
      { token: 'creation-season-tint', text: explanationForSeason(season) }
    ],
    identity: { projectionFingerprint, visualFingerprint }
  };
}

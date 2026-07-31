export const FOREST_OWNER_VARIANT_SELECTION_VERSION = 1;

export const FOREST_OWNER_VARIANT_DISPLAY_REASONS = Object.freeze({
  PREFERRED_OWNER_LANGUAGE: 'preferred-owner-language',
  FOUNDING_OWNER_VARIANT: 'founding-owner-variant',
  EARLIEST_OWNER_FALLBACK: 'earliest-owner-fallback',
  NO_OWNER_VARIANT: 'no-owner-variant'
});

export const FOREST_OWNER_VARIANT_FOUNDING_REASONS = Object.freeze({
  HISTORICAL_EARLIEST_OWNER_VARIANT: 'historical-earliest-owner-variant',
  CAPTURED_FOUNDING_VARIANT: 'captured-founding-variant'
});

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2})?$/i;
const STATE_FIELDS = Object.freeze([
  'selectionVersion',
  'ownerUserId',
  'translationGroupId',
  'preferredContentLang',
  'capturedFoundingBlockId',
  'consideredVariantCount',
  'earliestOwnerVariant',
  'preferredOwnerVariant',
  'currentFoundingVariant'
]);
const VARIANT_FIELDS = Object.freeze([
  'blockId',
  'ownerUserId',
  'translationGroupId',
  'authorshipState',
  'lang',
  'status',
  'visibility',
  'createdAt',
  'roomId'
]);

function exactObject(value, allowedFields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const extra = Object.keys(value).filter(field => !allowedFields.includes(field));
  if (extra.length) throw new Error(`${label} contains unsupported fields: ${extra.join(', ')}.`);
}

function canonicalObjectId(value, label) {
  const normalized = String(value || '');
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    throw new Error(`${label} must be an ObjectId-shaped value.`);
  }
  return normalized.toLowerCase();
}

function canonicalLanguage(value, label) {
  if (typeof value !== 'string'
    || value.length < 2
    || value.length > 5
    || !LANGUAGE_PATTERN.test(value)) {
    throw new Error(`${label} must be a supported language-shaped value.`);
  }
  return value.toLowerCase();
}

function exactIsoDate(value, label) {
  if (typeof value !== 'string' || value.length > 32) {
    throw new Error(`${label} must be an exact ISO-8601 UTC timestamp.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 UTC timestamp.`);
  }
  return value;
}

function copyVariant(variant) {
  return Object.fromEntries(VARIANT_FIELDS.map(field => [field, variant[field]]));
}

function validateVariant(variant, state) {
  exactObject(variant, VARIANT_FIELDS, 'Forest owner variant');
  const blockId = canonicalObjectId(variant.blockId, 'variant.blockId');
  const ownerUserId = canonicalObjectId(variant.ownerUserId, 'variant.ownerUserId');
  const translationGroupId = canonicalObjectId(
    variant.translationGroupId,
    'variant.translationGroupId'
  );
  if (ownerUserId !== state.ownerUserId) {
    throw new Error('Forest owner variant does not belong to the selected owner.');
  }
  if (translationGroupId !== state.translationGroupId) {
    throw new Error('Forest owner variant does not belong to the selected translation group.');
  }
  if (variant.authorshipState !== 'live') {
    throw new Error('Forest owner variant must have live authorship.');
  }
  const lang = canonicalLanguage(variant.lang, 'variant.lang');
  exactIsoDate(variant.createdAt, 'variant.createdAt');
  if (!['in-progress', 'locked'].includes(variant.status)) {
    throw new Error('Forest owner variant has an unsupported status.');
  }
  if (!['public', 'unlisted'].includes(variant.visibility)) {
    throw new Error('Forest owner variant has an unsupported visibility.');
  }
  if (typeof variant.roomId !== 'string'
    || !variant.roomId.length
    || variant.roomId.length > 120) {
    throw new Error('Forest owner variant has an invalid room identity.');
  }
  return {
    ...copyVariant(variant),
    blockId,
    ownerUserId,
    translationGroupId,
    lang
  };
}

function earlierVariant(left, right) {
  if (!left) return right;
  if (!right) return left;
  const dateOrder = left.createdAt.localeCompare(right.createdAt);
  if (dateOrder !== 0) return dateOrder < 0 ? left : right;
  return left.blockId.localeCompare(right.blockId) <= 0 ? left : right;
}

function validateState(state) {
  exactObject(state, STATE_FIELDS, 'Forest owner variant selection state');
  if (state.selectionVersion !== FOREST_OWNER_VARIANT_SELECTION_VERSION) {
    throw new Error('Forest owner variant selection state has an unsupported version.');
  }
  canonicalObjectId(state.ownerUserId, 'state.ownerUserId');
  canonicalObjectId(state.translationGroupId, 'state.translationGroupId');
  canonicalLanguage(state.preferredContentLang, 'state.preferredContentLang');
  if (state.capturedFoundingBlockId !== null) {
    canonicalObjectId(state.capturedFoundingBlockId, 'state.capturedFoundingBlockId');
  }
  if (!Number.isSafeInteger(state.consideredVariantCount)
    || state.consideredVariantCount < 0) {
    throw new Error('state.consideredVariantCount must be a non-negative safe integer.');
  }
}

export function createForestOwnerVariantSelectionState({
  ownerUserId,
  translationGroupId,
  preferredContentLang,
  capturedFoundingBlockId = null
}) {
  return {
    selectionVersion: FOREST_OWNER_VARIANT_SELECTION_VERSION,
    ownerUserId: canonicalObjectId(ownerUserId, 'ownerUserId'),
    translationGroupId: canonicalObjectId(translationGroupId, 'translationGroupId'),
    preferredContentLang: canonicalLanguage(preferredContentLang, 'preferredContentLang'),
    capturedFoundingBlockId: capturedFoundingBlockId === null
      ? null
      : canonicalObjectId(capturedFoundingBlockId, 'capturedFoundingBlockId'),
    consideredVariantCount: 0,
    earliestOwnerVariant: null,
    preferredOwnerVariant: null,
    currentFoundingVariant: null
  };
}

export function considerForestOwnerVariant(state, variant) {
  validateState(state);
  const candidate = validateVariant(variant, state);
  const preferredOwnerVariant = candidate.lang === state.preferredContentLang
    ? earlierVariant(state.preferredOwnerVariant, candidate)
    : state.preferredOwnerVariant;
  const currentFoundingVariant = candidate.blockId === state.capturedFoundingBlockId
    ? candidate
    : state.currentFoundingVariant;

  return {
    ...state,
    consideredVariantCount: state.consideredVariantCount + 1,
    earliestOwnerVariant: earlierVariant(state.earliestOwnerVariant, candidate),
    preferredOwnerVariant,
    currentFoundingVariant
  };
}

export function finalizeForestOwnerVariantSelection(state) {
  validateState(state);
  const capturedFounding = state.capturedFoundingBlockId !== null;
  const foundingVariant = capturedFounding
    ? state.currentFoundingVariant
    : state.earliestOwnerVariant;
  let displayVariant = null;
  let displayReason = FOREST_OWNER_VARIANT_DISPLAY_REASONS.NO_OWNER_VARIANT;

  if (state.preferredOwnerVariant) {
    displayVariant = state.preferredOwnerVariant;
    displayReason = FOREST_OWNER_VARIANT_DISPLAY_REASONS.PREFERRED_OWNER_LANGUAGE;
  } else if (state.currentFoundingVariant) {
    displayVariant = state.currentFoundingVariant;
    displayReason = FOREST_OWNER_VARIANT_DISPLAY_REASONS.FOUNDING_OWNER_VARIANT;
  } else if (state.earliestOwnerVariant) {
    displayVariant = state.earliestOwnerVariant;
    displayReason = FOREST_OWNER_VARIANT_DISPLAY_REASONS.EARLIEST_OWNER_FALLBACK;
  }

  return {
    selectionVersion: FOREST_OWNER_VARIANT_SELECTION_VERSION,
    ownerUserId: state.ownerUserId,
    translationGroupId: state.translationGroupId,
    active: Boolean(state.earliestOwnerVariant),
    consideredVariantCount: state.consideredVariantCount,
    capturedFoundingBlockId: state.capturedFoundingBlockId,
    foundingVariant,
    foundingSourceAvailable: capturedFounding
      ? Boolean(state.currentFoundingVariant)
      : Boolean(foundingVariant),
    foundingReason: capturedFounding
      ? FOREST_OWNER_VARIANT_FOUNDING_REASONS.CAPTURED_FOUNDING_VARIANT
      : FOREST_OWNER_VARIANT_FOUNDING_REASONS.HISTORICAL_EARLIEST_OWNER_VARIANT,
    displayVariant,
    displayReason
  };
}

export function selectForestOwnerVariants({
  ownerUserId,
  translationGroupId,
  preferredContentLang,
  capturedFoundingBlockId = null,
  variants
}) {
  if (!variants || typeof variants[Symbol.iterator] !== 'function') {
    throw new Error('variants must be iterable.');
  }
  let state = createForestOwnerVariantSelectionState({
    ownerUserId,
    translationGroupId,
    preferredContentLang,
    capturedFoundingBlockId
  });
  for (const variant of variants) state = considerForestOwnerVariant(state, variant);
  return finalizeForestOwnerVariantSelection(state);
}

import mongoose from 'mongoose';

const EDITORIAL_ROLES = new Set(['pillar', 'companion', 'texture']);
const MAX_CLUSTER_KEY_LENGTH = 120;

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeOptionalString(value, fieldName, { maxLength } = {}) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string or null.`);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (maxLength && trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function normalizeOptionalBlockId(value, fieldName) {
  const normalized = normalizeOptionalString(value, fieldName);
  if (normalized === undefined || normalized === null) return normalized;
  if (!mongoose.isValidObjectId(normalized)) {
    throw new Error(`${fieldName} must be a valid block id.`);
  }
  return normalized;
}

function normalizeOptionalSequence(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('editorial.sequence must be a non-negative integer or null.');
  }

  return parsed;
}

function normalizeRelatedBlockIds(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('editorial.relatedBlockIds must be an array of block ids.');
  }

  const seen = new Set();
  const normalized = [];

  for (const item of value) {
    if (item === null || item === undefined) continue;
    if (typeof item !== 'string') {
      throw new Error('editorial.relatedBlockIds must contain only strings.');
    }

    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!mongoose.isValidObjectId(trimmed)) {
      throw new Error('editorial.relatedBlockIds must contain valid block ids.');
    }
    if (seen.has(trimmed)) continue;

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized.length ? normalized : undefined;
}

export function normalizeEditorialInput(editorial) {
  if (editorial === undefined) {
    return { value: undefined, shouldUnset: false };
  }

  if (editorial === null) {
    return { value: undefined, shouldUnset: true };
  }

  if (typeof editorial !== 'object' || Array.isArray(editorial)) {
    throw new Error('editorial must be an object or null.');
  }

  const normalized = {};

  if (hasOwn(editorial, 'clusterKey')) {
    const clusterKey = normalizeOptionalString(editorial.clusterKey, 'editorial.clusterKey', {
      maxLength: MAX_CLUSTER_KEY_LENGTH
    });
    if (clusterKey !== null && clusterKey !== undefined) normalized.clusterKey = clusterKey;
  }

  if (hasOwn(editorial, 'role')) {
    const role = normalizeOptionalString(editorial.role, 'editorial.role');
    if (role !== null && role !== undefined) {
      if (!EDITORIAL_ROLES.has(role)) {
        throw new Error('editorial.role must be pillar, companion, texture, or null.');
      }
      normalized.role = role;
    }
  }

  if (hasOwn(editorial, 'primaryPillarBlockId')) {
    const primaryPillarBlockId = normalizeOptionalBlockId(
      editorial.primaryPillarBlockId,
      'editorial.primaryPillarBlockId'
    );
    if (primaryPillarBlockId !== null && primaryPillarBlockId !== undefined) {
      normalized.primaryPillarBlockId = primaryPillarBlockId;
    }
  }

  if (hasOwn(editorial, 'sequence')) {
    const sequence = normalizeOptionalSequence(editorial.sequence);
    if (sequence !== null && sequence !== undefined) normalized.sequence = sequence;
  }

  if (hasOwn(editorial, 'relatedBlockIds')) {
    const relatedBlockIds = normalizeRelatedBlockIds(editorial.relatedBlockIds);
    if (relatedBlockIds !== undefined) normalized.relatedBlockIds = relatedBlockIds;
  }

  if (!Object.keys(normalized).length) {
    return { value: undefined, shouldUnset: true };
  }

  return { value: normalized, shouldUnset: false };
}

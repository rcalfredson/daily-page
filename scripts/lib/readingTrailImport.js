import mongoose from 'mongoose';
import ReadingTrail from '../../server/db/models/ReadingTrail.js';
import Block from '../../server/db/models/Block.js';
import { isValidBannerImageUrl } from '../../server/db/bannerImage.js';
import {
  assertPublishedTrailLocalesReady,
  inspectReadingTrailLocales
} from '../../server/db/readingTrailDomain.js';

const MANIFEST_FIELDS = new Set([
  'slug',
  'status',
  'sourceLanguage',
  'publishedLocales',
  'title_i18n',
  'description_i18n',
  'coverGroupId',
  'coverImage',
  'items'
]);

const DEFINITION_FIELDS = [...MANIFEST_FIELDS];

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeObject(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  if (Array.isArray(value)) return value.map(normalizeObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeObject(child)])
    );
  }
  return value;
}

function valuesEqual(left, right) {
  return JSON.stringify(normalizeObject(left)) === JSON.stringify(normalizeObject(right));
}

function validateLocalizedObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object keyed by locale.`);
  }
  for (const [locale, text] of Object.entries(value)) {
    requireText(locale, `${field} locale`);
    requireText(text, `${field}.${locale}`);
  }
}

export function validateReadingTrailManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Reading trail manifest must be a JSON object.');
  }
  const unknown = Object.keys(manifest).filter(field => !MANIFEST_FIELDS.has(field));
  if (unknown.length) {
    throw new Error(`Reading trail manifest has unknown field(s): ${unknown.join(', ')}.`);
  }

  requireText(manifest.slug, 'slug');
  requireText(manifest.sourceLanguage, 'sourceLanguage');
  validateLocalizedObject(manifest.title_i18n, 'title_i18n');
  validateLocalizedObject(manifest.description_i18n, 'description_i18n');
  if (!['draft', 'published'].includes(manifest.status || 'draft')) {
    throw new Error('status must be "draft" or "published".');
  }
  if (!Array.isArray(manifest.publishedLocales)) {
    throw new Error('publishedLocales must be an array.');
  }
  if (manifest.coverGroupId !== undefined) requireText(manifest.coverGroupId, 'coverGroupId');
  if (manifest.coverImage !== undefined) {
    if (!manifest.coverImage || typeof manifest.coverImage !== 'object' || Array.isArray(manifest.coverImage)) {
      throw new Error('coverImage must be an object.');
    }
    const unknownCoverFields = Object.keys(manifest.coverImage)
      .filter(field => !['url', 'caption_i18n'].includes(field));
    if (unknownCoverFields.length) {
      throw new Error(`coverImage has unknown field(s): ${unknownCoverFields.join(', ')}.`);
    }
    if (!isValidBannerImageUrl(String(manifest.coverImage.url || '').trim())) {
      throw new Error('coverImage.url must be a valid http or https URL.');
    }
    if (manifest.coverImage.caption_i18n !== undefined) {
      validateLocalizedObject(manifest.coverImage.caption_i18n, 'coverImage.caption_i18n');
    }
  }
  if (manifest.coverGroupId && manifest.coverImage) {
    throw new Error('Reading trail manifests cannot define both coverGroupId and coverImage.');
  }
  if (!Array.isArray(manifest.items) || manifest.items.length < 2) {
    throw new Error('items must contain at least two trail stops.');
  }
  manifest.items.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`items[${index}] must be an object.`);
    }
    const itemUnknown = Object.keys(item).filter(field => !['groupId', 'note_i18n'].includes(field));
    if (itemUnknown.length) {
      throw new Error(`items[${index}] has unknown field(s): ${itemUnknown.join(', ')}.`);
    }
    requireText(item.groupId, `items[${index}].groupId`);
    if (item.note_i18n !== undefined) {
      validateLocalizedObject(item.note_i18n, `items[${index}].note_i18n`);
    }
  });
  return manifest;
}

export function buildReadingTrailImportPlan({ existingTrail, definition }) {
  const changedFields = existingTrail
    ? DEFINITION_FIELDS.filter(field => !valuesEqual(existingTrail[field], definition[field]))
    : [...DEFINITION_FIELDS];
  return {
    action: !existingTrail ? 'create' : changedFields.length ? 'update' : 'unchanged',
    changedFields
  };
}

export function buildReadingTrailDefinitionUpdate(definition, changedFields) {
  const fieldsToSet = changedFields.filter(field => definition[field] !== undefined);
  const fieldsToUnset = changedFields.filter(field => definition[field] === undefined);
  return {
    ...(fieldsToSet.length ? {
      $set: Object.fromEntries(fieldsToSet.map(field => [field, definition[field]]))
    } : {}),
    ...(fieldsToUnset.length ? {
      $unset: Object.fromEntries(fieldsToUnset.map(field => [field, 1]))
    } : {})
  };
}

async function prepareImport({ manifest, session, models }) {
  validateReadingTrailManifest(manifest);
  const definition = {
    ...manifest,
    status: manifest.status || 'draft',
    coverGroupId: manifest.coverImage
      ? undefined
      : (manifest.coverGroupId || manifest.items[0].groupId)
  };
  await new models.ReadingTrail(definition).validate();

  const groupIds = [...new Set([
    ...definition.items.map(item => item.groupId),
    definition.coverGroupId
  ].filter(Boolean))];
  const posts = await models.Block.find(
    { groupId: { $in: groupIds } },
    '_id groupId lang title roomId status visibility bannerImage',
    { session }
  ).lean();
  if (manifest.coverGroupId && !posts.some(post => (
    post.groupId === definition.coverGroupId
    && post.status === 'locked'
    && post.visibility === 'public'
    && post.bannerImage?.url
  ))) {
    throw new Error('coverGroupId must reference a public, completed post family with a banner image.');
  }
  const localeReports = inspectReadingTrailLocales(definition, posts);
  assertPublishedTrailLocalesReady(definition, localeReports);

  const existingTrail = await models.ReadingTrail.findOne(
    { slug: definition.slug },
    null,
    { session }
  ).lean();
  return {
    definition,
    existingTrail,
    localeReports,
    plan: buildReadingTrailImportPlan({ existingTrail, definition })
  };
}

export async function importReadingTrail({
  manifest,
  apply = false,
  models = { ReadingTrail, Block },
  mongooseInstance = mongoose
}) {
  if (!apply) return prepareImport({ manifest, session: null, models });

  const session = await mongooseInstance.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await prepareImport({ manifest, session, models });
      if (result.plan.action === 'create') {
        await models.ReadingTrail.create([result.definition], { session });
      } else if (result.plan.action === 'update') {
        const update = buildReadingTrailDefinitionUpdate(
          result.definition,
          result.plan.changedFields
        );
        await models.ReadingTrail.updateOne(
          { _id: result.existingTrail._id },
          update,
          { session, runValidators: true }
        );
      }
    });
    return result;
  } finally {
    await session.endSession();
  }
}

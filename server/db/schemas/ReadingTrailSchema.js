import { Schema } from 'mongoose';
import { SUPPORTED_UI_LANGS } from '../../services/localeContext.js';
import { isValidBannerImageUrl } from '../bannerImage.js';

export const READING_TRAIL_STATUSES = Object.freeze(['draft', 'published']);

const localizedText = {
  type: Map,
  of: {
    type: String,
    trim: true,
    maxlength: 600
  },
  default: undefined
};

const readingTrailItemSchema = new Schema({
  groupId: { type: String, required: true, trim: true },
  note_i18n: localizedText
}, { _id: false });

const coverImageSchema = new Schema({
  url: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2048,
    validate: {
      validator: isValidBannerImageUrl,
      message: 'Reading trail cover image must use a valid http or https URL.'
    }
  },
  caption_i18n: {
    type: Map,
    of: { type: String, trim: true, maxlength: 300 },
    default: undefined
  }
}, { _id: false });

const readingTrailSchema = new Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 100,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  },
  status: {
    type: String,
    required: true,
    enum: READING_TRAIL_STATUSES,
    default: 'draft',
    index: true
  },
  sourceLanguage: {
    type: String,
    required: true,
    enum: SUPPORTED_UI_LANGS
  },
  publishedLocales: {
    type: [{ type: String, enum: SUPPORTED_UI_LANGS }],
    default: []
  },
  title_i18n: { ...localizedText, required: true },
  description_i18n: { ...localizedText, required: true },
  coverGroupId: { type: String, trim: true, default: undefined },
  coverImage: { type: coverImageSchema, default: undefined },
  items: {
    type: [readingTrailItemSchema],
    required: true,
    validate: {
      validator(value) {
        return Array.isArray(value) && value.length >= 2;
      },
      message: 'Reading trails require at least two items.'
    }
  }
}, {
  strict: true,
  timestamps: true,
  toObject: { transform: (doc, ret) => { delete ret.__v; } },
  toJSON: { transform: (doc, ret) => { delete ret.__v; } }
});

function mapValue(map, key) {
  return typeof map?.get === 'function' ? map.get(key) : map?.[key];
}

function mapEntries(map) {
  if (!map) return [];
  return typeof map.entries === 'function' ? [...map.entries()] : Object.entries(map);
}

function validateLocalizedMap(document, field) {
  const entries = mapEntries(document[field]);
  for (const [locale, value] of entries) {
    if (!SUPPORTED_UI_LANGS.includes(locale)) {
      document.invalidate(field, `${field} contains unsupported locale "${locale}".`);
    } else if (!String(value || '').trim()) {
      document.invalidate(field, `${field}.${locale} must be a non-empty string.`);
    }
  }
}

readingTrailSchema.pre('validate', function validateReadingTrail() {
  validateLocalizedMap(this, 'title_i18n');
  validateLocalizedMap(this, 'description_i18n');

  for (const field of ['title_i18n', 'description_i18n']) {
    if (!String(mapValue(this[field], this.sourceLanguage) || '').trim()) {
      this.invalidate(field, `${field} must include the source language.`);
    }
  }

  if (new Set(this.publishedLocales).size !== this.publishedLocales.length) {
    this.invalidate('publishedLocales', 'Reading trail publishedLocales must be deduplicated.');
  }

  if (this.coverGroupId && this.coverImage?.url) {
    this.invalidate('coverImage', 'Reading trails cannot define both coverGroupId and coverImage.');
  }
  if (this.coverImage?.caption_i18n) {
    const entries = mapEntries(this.coverImage.caption_i18n);
    for (const [locale, value] of entries) {
      if (!SUPPORTED_UI_LANGS.includes(locale)) {
        this.invalidate('coverImage.caption_i18n', `Cover image caption contains unsupported locale "${locale}".`);
      } else if (!String(value || '').trim()) {
        this.invalidate('coverImage.caption_i18n', `Cover image caption ${locale} must be non-empty.`);
      }
    }
    if (entries.length && !String(mapValue(this.coverImage.caption_i18n, this.sourceLanguage) || '').trim()) {
      this.invalidate('coverImage.caption_i18n', 'Cover image caption must include the source language.');
    }
  }
  if (this.status === 'published' && !this.publishedLocales.length) {
    this.invalidate('publishedLocales', 'Published reading trails require at least one published locale.');
  }

  const groupIds = this.items.map(item => item.groupId);
  if (groupIds.some(groupId => !groupId) || new Set(groupIds).size !== groupIds.length) {
    this.invalidate('items', 'Reading trail items must have unique, non-empty groupIds.');
  }

  this.items.forEach((item, index) => {
    const entries = mapEntries(item.note_i18n);
    for (const [locale, value] of entries) {
      if (!SUPPORTED_UI_LANGS.includes(locale)) {
        this.invalidate(`items.${index}.note_i18n`, `Trail item note contains unsupported locale "${locale}".`);
      } else if (!String(value || '').trim()) {
        this.invalidate(`items.${index}.note_i18n`, `Trail item note ${locale} must be non-empty.`);
      }
    }
  });

  for (const locale of this.publishedLocales) {
    for (const field of ['title_i18n', 'description_i18n']) {
      if (!String(mapValue(this[field], locale) || '').trim()) {
        this.invalidate(field, `${field} must include published locale "${locale}".`);
      }
    }
    this.items.forEach((item, index) => {
      if (mapEntries(item.note_i18n).length && !String(mapValue(item.note_i18n, locale) || '').trim()) {
        this.invalidate(
          `items.${index}.note_i18n`,
          `Trail item note must include published locale "${locale}".`
        );
      }
    });
    if (
      mapEntries(this.coverImage?.caption_i18n).length
      && !String(mapValue(this.coverImage.caption_i18n, locale) || '').trim()
    ) {
      this.invalidate(
        'coverImage.caption_i18n',
        `Cover image caption must include published locale "${locale}".`
      );
    }
  }
});

readingTrailSchema.index({ status: 1, publishedLocales: 1, createdAt: -1 });

export default readingTrailSchema;

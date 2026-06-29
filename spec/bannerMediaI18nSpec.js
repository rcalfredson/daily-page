import fs from 'node:fs';
import path from 'node:path';

import { SUPPORTED_UI_LANGS } from '../server/services/localeContext.js';

const blockEditorPaths = [
  'errors.streetViewEmbedUrlInvalid',
  'bannerImage.label',
  'bannerImage.help',
  'bannerImage.kindLabel',
  'bannerImage.kindImage',
  'bannerImage.kindStreetView',
  'bannerImage.urlLabel',
  'bannerImage.urlPlaceholder',
  'bannerImage.captionLabel',
  'bannerImage.captionPlaceholder',
  'bannerImage.save',
  'bannerImage.saved',
  'bannerImage.removed',
  'bannerImage.updateError',
  'toolbar.insertStreetView',
  'toolbar.insertStreetViewHelp',
  'toolbar.insertStreetViewUrlPlaceholder'
];

const createBlockPaths = [
  'form.bannerImage.legend',
  'form.bannerImage.help',
  'form.bannerImage.kindLabel',
  'form.bannerImage.kindImage',
  'form.bannerImage.kindStreetView',
  'form.bannerImage.urlLabel',
  'form.bannerImage.urlPlaceholder',
  'form.bannerImage.captionLabel',
  'form.bannerImage.captionPlaceholder'
];

function readNamespace(lang, namespace) {
  const file = path.join(process.cwd(), 'i18n', lang, `${namespace}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'))[namespace];
}

function getValue(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value?.[key], object);
}

describe('banner media and Street View localization', () => {
  for (const lang of SUPPORTED_UI_LANGS) {
    it(`defines every feature string directly in ${lang}`, () => {
      const blockEditor = readNamespace(lang, 'blockEditor');
      const createBlock = readNamespace(lang, 'createBlock');

      for (const key of blockEditorPaths) {
        const value = getValue(blockEditor, key);
        expect(typeof value).withContext(`blockEditor.${key}`).toBe('string');
        expect(value.trim().length).withContext(`blockEditor.${key}`).toBeGreaterThan(0);
      }

      for (const key of createBlockPaths) {
        const value = getValue(createBlock, key);
        expect(typeof value).withContext(`createBlock.${key}`).toBe('string');
        expect(value.trim().length).withContext(`createBlock.${key}`).toBeGreaterThan(0);
      }
    });
  }
});

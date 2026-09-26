import fs from 'node:fs';
import { SUPPORTED_UI_LANGS } from '../server/services/localeContext.js';
import { textDirForLang } from '../server/services/textDirection.js';

function readBundle(lang, namespace) {
  return JSON.parse(fs.readFileSync(`i18n/${lang}/${namespace}.json`, 'utf8'));
}

function flattenStrings(value, prefix = '', result = {}) {
  for (const [key, child] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenStrings(child, path, result);
    } else {
      result[path] = child;
    }
  }
  return result;
}

function interpolationTokens(value) {
  return (String(value).match(/\{\w+\}/g) || []).sort();
}

function expectTranslationParity(reference, candidate, context) {
  const referenceStrings = flattenStrings(reference);
  const candidateStrings = flattenStrings(candidate);
  expect(Object.keys(candidateStrings).sort())
    .withContext(`${context} has incomplete or unexpected keys`)
    .toEqual(Object.keys(referenceStrings).sort());

  for (const [key, referenceValue] of Object.entries(referenceStrings)) {
    expect(candidateStrings[key]).withContext(`${context}.${key} must be a string`)
      .toEqual(jasmine.any(String));
    expect(candidateStrings[key].trim().length)
      .withContext(`${context}.${key} must not be empty`)
      .toBeGreaterThan(0);
    expect(interpolationTokens(candidateStrings[key]))
      .withContext(`${context}.${key} has mismatched interpolation tokens`)
      .toEqual(interpolationTokens(referenceValue));
  }
}

describe('reading trail interface translations', () => {
  const englishTrails = readBundle('en', 'readingTrails').readingTrails;
  const englishPostTrail = readBundle('en', 'blockView').blockView.trail;

  it('provides complete trail browsing and post navigation copy in every UI language', () => {
    for (const lang of SUPPORTED_UI_LANGS) {
      const trails = readBundle(lang, 'readingTrails').readingTrails;
      const blockView = readBundle(lang, 'blockView').blockView;
      const nav = readBundle(lang, 'nav').nav;

      expectTranslationParity(englishTrails, trails, `${lang}.readingTrails`);
      expectTranslationParity(englishPostTrail, blockView.trail, `${lang}.blockView.trail`);
      expect(nav.trails).withContext(`${lang}.nav.trails must be translated`)
        .toEqual(jasmine.any(String));
      expect(nav.trails.trim().length).withContext(`${lang}.nav.trails must not be empty`)
        .toBeGreaterThan(0);
    }
  });

  it('uses RTL layout for Arabic and Hebrew while preserving LTR for the other final locales', () => {
    expect(textDirForLang('ar')).toBe('rtl');
    expect(textDirForLang('he')).toBe('rtl');
    expect(textDirForLang('zh')).toBe('ltr');
    expect(textDirForLang('hi')).toBe('ltr');
  });
});

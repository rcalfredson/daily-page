// lib/cursorHelper.js
import { ANIMALS } from './cursorNames';
import { generateItemFromHash } from './hashAlgo';

// Safe para SSR porque chequea window
export function getCurrentLang() {
  if (
    typeof window !== 'undefined' &&
    window.I18n &&
    typeof window.I18n.lang === 'function'
  ) {
    return window.I18n.lang();
  }
  return 'en';
}

export function getCursorNameForSite(siteId) {
  const lang = getCurrentLang();
  const langList = ANIMALS[lang];

  const animalsByLang =
    Array.isArray(langList) && langList.length > 0
      ? langList
      : (ANIMALS.en || []);

  return generateItemFromHash(siteId, animalsByLang);
}

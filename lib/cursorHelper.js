// lib/cursorHelper.js
import { ANIMALS } from './cursorNames';
import { generateItemFromHash } from './hashAlgo';
import { getUiLang } from './langContext';

export function getCursorNameForSite(siteId) {
  const lang = getUiLang();
  const langList = ANIMALS[lang];

  const animalsByLang =
    Array.isArray(langList) && langList.length > 0
      ? langList
      : (ANIMALS.en || []);

  return generateItemFromHash(siteId, animalsByLang);
}

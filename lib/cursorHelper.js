// lib/cursorHelper.js
import { ANIMALS } from './cursorNames.js';
import { generateItemFromHash } from './hashAlgo.js';
import { getUiLang } from './langContext.js';

export function getCursorNameForSite(siteId) {
  const lang = getUiLang();
  const langList = ANIMALS[lang];

  const animalsByLang =
    Array.isArray(langList) && langList.length > 0
      ? langList
      : (ANIMALS.en || []);

  return generateItemFromHash(siteId, animalsByLang);
}

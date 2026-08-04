function normalizedLang(value) {
  return String(value || '').trim().toLowerCase();
}

function baseLang(value) {
  return normalizedLang(value).split('-')[0];
}

function compareCandidates(left, right) {
  const leftCreatedAt = new Date(left?.createdAt || 0).getTime();
  const rightCreatedAt = new Date(right?.createdAt || 0).getTime();

  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
  return String(left?._id || '').localeCompare(String(right?._id || ''));
}

/**
 * Select the concrete public post for a language-independent translation-group URL.
 * Candidates are sorted here so the fallback remains stable even if a caller's query
 * does not guarantee document order.
 */
export function selectPublicPostTranslation(candidates, preferredLang) {
  const available = (Array.isArray(candidates) ? candidates : [])
    .filter(candidate => candidate?._id && candidate?.roomId && candidate?.lang)
    .slice()
    .sort(compareCandidates);

  if (!available.length) return null;

  const preferred = normalizedLang(preferredLang);
  const preferredBase = baseLang(preferred);
  const exactPreferred = preferred
    ? available.find(candidate => normalizedLang(candidate.lang) === preferred)
    : null;
  if (exactPreferred) return exactPreferred;

  const basePreferred = preferredBase
    ? available.find(candidate => baseLang(candidate.lang) === preferredBase)
    : null;
  if (basePreferred) return basePreferred;

  const english = available.find(candidate => baseLang(candidate.lang) === 'en');
  if (english) return english;

  const original = available.find(candidate => !candidate.originalBlock);
  return original || available[0];
}

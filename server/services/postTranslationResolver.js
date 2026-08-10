import { isSupportedUiLang } from './localeContext.js';

function normalizedLang(value) {
  return String(value || '').trim().toLowerCase();
}

function baseLang(value) {
  return normalizedLang(value).split('-')[0];
}

function id(value) {
  return value == null ? '' : String(value);
}

function compareCandidates(left, right) {
  const leftCreatedAt = new Date(left?.createdAt || 0).getTime();
  const rightCreatedAt = new Date(right?.createdAt || 0).getTime();

  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
  return id(left?._id).localeCompare(id(right?._id));
}

function diagnostic(code, details = {}) {
  return { code, ...details };
}

/**
 * Resolve one concrete record from a translation family.
 *
 * Source metadata is stored on the canonical source record. During rollout the
 * existing originalBlock relationship remains authoritative for legacy rows.
 */
export function resolvePostTranslation(candidates, requestedLocale) {
  const diagnostics = [];
  const available = (Array.isArray(candidates) ? candidates : [])
    .filter(candidate => candidate?._id && candidate?.lang)
    .slice()
    .sort(compareCandidates);

  if (!available.length) return null;

  const byLanguage = new Map();
  for (const candidate of available) {
    const lang = normalizedLang(candidate.lang);
    if (byLanguage.has(lang)) {
      diagnostics.push(diagnostic('duplicate-language', {
        lang,
        keptBlockId: id(byLanguage.get(lang)._id),
        ignoredBlockId: id(candidate._id)
      }));
      continue;
    }
    byLanguage.set(lang, candidate);
  }
  const unique = [...byLanguage.values()];

  const requested = normalizedLang(requestedLocale);
  const requestedBase = baseLang(requested);
  const exact = requested ? byLanguage.get(requested) : null;
  const baseMatch = !exact && requestedBase
    ? unique.find(candidate => baseLang(candidate.lang) === requestedBase)
    : null;

  const explicitlyMarkedSources = unique.filter(candidate => (
    !candidate.originalBlock
      && normalizedLang(candidate.sourceLanguage)
      && baseLang(candidate.sourceLanguage) === baseLang(candidate.lang)
  ));
  const referencedSourceIds = new Set(
    unique.map(candidate => id(candidate.originalBlock)).filter(Boolean)
  );
  const referencedSources = unique.filter(candidate => referencedSourceIds.has(id(candidate._id)));
  const legacySources = unique.filter(candidate => !candidate.originalBlock);

  let source = explicitlyMarkedSources[0]
    || referencedSources[0]
    || legacySources[0]
    || unique[0];

  if (explicitlyMarkedSources.length > 1 || referencedSources.length > 1 || legacySources.length > 1) {
    diagnostics.push(diagnostic('ambiguous-source', {
      selectedBlockId: id(source._id),
      candidateBlockIds: (explicitlyMarkedSources.length
        ? explicitlyMarkedSources
        : (referencedSources.length ? referencedSources : legacySources)
      ).map(candidate => id(candidate._id))
    }));
  }
  if (!explicitlyMarkedSources.length && !referencedSources.length && !legacySources.length) {
    diagnostics.push(diagnostic('missing-source-record', {
      selectedBlockId: id(source._id)
    }));
  }

  const selected = exact || baseMatch || source;
  const isExactLocaleMatch = Boolean(exact || baseMatch);
  const sourceLanguage = normalizedLang(source.sourceLanguage) || normalizedLang(source.lang);

  return {
    record: selected,
    isExactLocaleMatch,
    isSourceFallback: !isExactLocaleMatch,
    requestedLocale: requested || null,
    displayedLanguage: normalizedLang(selected.lang),
    sourceLanguage,
    canonicalSourceRecord: source,
    canonicalSourceId: id(source._id),
    diagnostics
  };
}

/** Backward-compatible convenience for callers that only need the record. */
export function selectPublicPostTranslation(candidates, preferredLang) {
  return resolvePostTranslation(candidates, preferredLang)?.record || null;
}

export function assertSupportedContentLanguage(value, field = 'lang') {
  const lang = normalizedLang(value);
  if (!isSupportedUiLang(lang)) {
    throw new Error(`${field} must be one of the supported language codes.`);
  }
  return lang;
}

export function annotateResolvedPost(result, family = {}) {
  if (!result) return null;
  return {
    ...result.record,
    selection: {
      isExactLocaleMatch: result.isExactLocaleMatch,
      isSourceFallback: result.isSourceFallback,
      displayedLanguage: result.displayedLanguage,
      sourceLanguage: result.sourceLanguage,
      canonicalSourceId: result.canonicalSourceId,
      diagnostics: result.diagnostics
    },
    familyVoteCount: family.familyVoteCount,
    familyCreatedAt: family.familyCreatedAt,
    familyPinnedAt: family.familyPinnedAt
  };
}

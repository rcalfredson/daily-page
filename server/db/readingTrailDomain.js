import { SUPPORTED_UI_LANGS } from '../services/localeContext.js';

function entriesOf(map) {
  if (!map) return [];
  return typeof map.entries === 'function' ? [...map.entries()] : Object.entries(map);
}

export function localizedTrailValue(trail, field, locale) {
  return new Map(entriesOf(trail?.[`${field}_i18n`])).get(locale) || '';
}

export function localizedTrailNote(item, locale) {
  return new Map(entriesOf(item?.note_i18n)).get(locale) || '';
}

function postKey(groupId, locale) {
  return `${groupId}\u0000${locale}`;
}

function postProblem(groupId, locale, family) {
  const exact = family.find(post => post.lang === locale);
  if (!exact) return { code: 'missing-post-translation', groupId, locale };
  if (exact.status !== 'locked') return { code: 'unfinished-post-translation', groupId, locale };
  if (exact.visibility !== 'public') return { code: 'non-public-post-translation', groupId, locale };
  return { code: 'unavailable-post-translation', groupId, locale };
}

export function inspectReadingTrailLocales(trail, posts = []) {
  const postsByGroup = new Map();
  const readyPosts = new Map();
  for (const post of posts) {
    if (!postsByGroup.has(post.groupId)) postsByGroup.set(post.groupId, []);
    postsByGroup.get(post.groupId).push(post);
    if (post.status === 'locked' && post.visibility === 'public') {
      readyPosts.set(postKey(post.groupId, post.lang), post);
    }
  }

  const metadataLocales = ['title_i18n', 'description_i18n']
    .flatMap(field => entriesOf(trail?.[field]).map(([locale]) => locale));
  const noteLocales = (trail?.items || [])
    .flatMap(item => entriesOf(item.note_i18n).map(([locale]) => locale));
  const locales = [...new Set([
    trail?.sourceLanguage,
    ...(trail?.publishedLocales || []),
    ...metadataLocales,
    ...noteLocales
  ].filter(Boolean))].sort();

  return locales.map((locale) => {
    const problems = [];
    if (!SUPPORTED_UI_LANGS.includes(locale)) {
      problems.push({ code: 'unsupported-locale', locale });
    }
    for (const field of ['title', 'description']) {
      if (!localizedTrailValue(trail, field, locale).trim()) {
        problems.push({ code: `missing-${field}`, locale });
      }
    }
    for (const item of trail?.items || []) {
      if (entriesOf(item.note_i18n).length && !localizedTrailNote(item, locale).trim()) {
        problems.push({ code: 'missing-item-note', groupId: item.groupId, locale });
      }
      if (!readyPosts.has(postKey(item.groupId, locale))) {
        problems.push(postProblem(
          item.groupId,
          locale,
          postsByGroup.get(item.groupId) || []
        ));
      }
    }
    return {
      locale,
      published: trail?.status === 'published' && trail?.publishedLocales?.includes(locale),
      ready: problems.length === 0,
      problems,
      posts: (trail?.items || [])
        .map(item => readyPosts.get(postKey(item.groupId, locale)))
        .filter(Boolean)
    };
  });
}

export function assertPublishedTrailLocalesReady(trail, reports) {
  if (trail?.status !== 'published') return;
  for (const locale of trail.publishedLocales || []) {
    const report = reports.find(candidate => candidate.locale === locale);
    if (!report?.ready) {
      const details = (report?.problems || []).map(problem => (
        `${problem.code}${problem.groupId ? `:${problem.groupId}` : ''}`
      )).join(', ');
      throw new Error(`Published locale "${locale}" is not ready${details ? ` (${details})` : ''}.`);
    }
  }
}

export function isReadingTrailAvailableInLocale(trail, locale, reports) {
  const report = reports.find(candidate => candidate.locale === locale);
  return trail?.status === 'published'
    && trail?.publishedLocales?.includes(locale)
    && report?.ready === true;
}

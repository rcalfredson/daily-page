import {
  assertPublishedTrailLocalesReady,
  inspectReadingTrailLocales,
  isReadingTrailAvailableInLocale
} from '../server/db/readingTrailDomain.js';

function trail(overrides = {}) {
  return {
    slug: 'a-short-trail',
    status: 'published',
    sourceLanguage: 'en',
    publishedLocales: ['en'],
    title_i18n: { en: 'A short trail' },
    description_i18n: { en: 'Two worthwhile readings.' },
    items: [
      { groupId: 'group-1', note_i18n: { en: 'Begin.' } },
      { groupId: 'group-2', note_i18n: { en: 'Continue.' } }
    ],
    ...overrides
  };
}

function post(groupId, lang, overrides = {}) {
  return {
    _id: `${groupId}-${lang}`,
    groupId,
    lang,
    status: 'locked',
    visibility: 'public',
    ...overrides
  };
}

describe('reading trail locale readiness', () => {
  it('makes a published locale available only with exact public completed variants', () => {
    const subject = trail();
    const reports = inspectReadingTrailLocales(subject, [post('group-1', 'en'), post('group-2', 'en')]);

    expect(reports[0].ready).toBeTrue();
    expect(isReadingTrailAvailableInLocale(subject, 'en', reports)).toBeTrue();
    expect(() => assertPublishedTrailLocalesReady(subject, reports)).not.toThrow();
  });

  it('does not use source-language fallback for another locale', () => {
    const subject = trail({
      publishedLocales: ['en', 'es'],
      title_i18n: { en: 'A short trail', es: 'Un sendero corto' },
      description_i18n: { en: 'Two readings.', es: 'Dos lecturas.' },
      items: [
        { groupId: 'group-1', note_i18n: { en: 'Begin.', es: 'Empieza.' } },
        { groupId: 'group-2', note_i18n: { en: 'Continue.', es: 'Continúa.' } }
      ]
    });
    const reports = inspectReadingTrailLocales(subject, [
      post('group-1', 'en'),
      post('group-2', 'en'),
      post('group-1', 'es')
    ]);
    const spanish = reports.find(report => report.locale === 'es');

    expect(spanish.ready).toBeFalse();
    expect(spanish.problems).toContain(jasmine.objectContaining({
      code: 'missing-post-translation', groupId: 'group-2'
    }));
    expect(isReadingTrailAvailableInLocale(subject, 'es', reports)).toBeFalse();
    expect(() => assertPublishedTrailLocalesReady(subject, reports))
      .toThrowError(/Published locale "es" is not ready/);
  });

  it('distinguishes unfinished, non-public, and missing translations', () => {
    const subject = trail({
      publishedLocales: [],
      title_i18n: { en: 'A short trail', fr: 'Un parcours court' },
      description_i18n: { en: 'Two readings.', fr: 'Deux lectures.' },
      items: [
        { groupId: 'group-1' },
        { groupId: 'group-2' },
        { groupId: 'group-3' }
      ]
    });
    const reports = inspectReadingTrailLocales(subject, [
      post('group-1', 'fr', { status: 'in-progress' }),
      post('group-2', 'fr', { visibility: 'unlisted' })
    ]);
    const frenchCodes = reports.find(report => report.locale === 'fr').problems.map(({ code }) => code);

    expect(frenchCodes).toEqual([
      'unfinished-post-translation',
      'non-public-post-translation',
      'missing-post-translation'
    ]);
  });

  it('requires every existing editorial note in the requested locale', () => {
    const subject = trail({
      publishedLocales: [],
      title_i18n: { en: 'A short trail', es: 'Un sendero corto' },
      description_i18n: { en: 'Two readings.', es: 'Dos lecturas.' }
    });
    const reports = inspectReadingTrailLocales(subject, [
      post('group-1', 'en'), post('group-2', 'en'),
      post('group-1', 'es'), post('group-2', 'es')
    ]);
    const spanish = reports.find(report => report.locale === 'es');

    expect(spanish.ready).toBeFalse();
    expect(spanish.problems.filter(({ code }) => code === 'missing-item-note')).toHaveSize(2);
  });

  it('requires an existing cover caption in every evaluated locale', () => {
    const subject = trail({
      publishedLocales: [],
      title_i18n: { en: 'A short trail', es: 'Un sendero corto' },
      description_i18n: { en: 'Two readings.', es: 'Dos lecturas.' },
      coverImage: {
        url: 'https://images.example.com/trail.jpg',
        caption_i18n: { en: 'A path through the readings.' }
      },
      items: [{ groupId: 'group-1' }, { groupId: 'group-2' }]
    });
    const reports = inspectReadingTrailLocales(subject, [
      post('group-1', 'en'), post('group-2', 'en'),
      post('group-1', 'es'), post('group-2', 'es')
    ]);
    const spanish = reports.find(report => report.locale === 'es');

    expect(spanish.ready).toBeFalse();
    expect(spanish.problems).toContain(jasmine.objectContaining({
      code: 'missing-cover-caption', locale: 'es'
    }));
  });
});

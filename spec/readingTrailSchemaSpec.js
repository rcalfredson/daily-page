import ReadingTrail from '../server/db/models/ReadingTrail.js';

function validTrail(overrides = {}) {
  return new ReadingTrail({
    slug: 'start-exploring-spacetime',
    status: 'published',
    sourceLanguage: 'en',
    publishedLocales: ['en'],
    title_i18n: { en: 'Start Exploring Spacetime' },
    description_i18n: { en: 'A path through the shape of the universe.' },
    items: [
      { groupId: 'group-1', note_i18n: { en: 'Begin here.' } },
      { groupId: 'group-2', note_i18n: { en: 'Continue here.' } }
    ],
    ...overrides
  });
}

describe('reading trail schema', () => {
  it('accepts localized metadata and defaults the optional cover', async () => {
    const trail = validTrail();
    await expectAsync(trail.validate()).toBeResolved();
    expect(trail.coverGroupId).toBeUndefined();
  });

  it('requires source-language metadata and at least two unique stops', async () => {
    const trail = validTrail({
      title_i18n: { es: 'Explora el espacio-tiempo' },
      items: [{ groupId: 'same' }, { groupId: 'same' }]
    });
    await expectAsync(trail.validate()).toBeRejectedWithError(/validation failed/i);
    expect(trail.errors.title_i18n.message).toContain('source language');
    expect(trail.errors.items.message).toContain('unique');
  });

  it('allows a cover image to come from a post outside the trail', async () => {
    const trail = validTrail({ coverGroupId: 'elsewhere' });
    await expectAsync(trail.validate()).toBeResolved();
    expect(trail.coverGroupId).toBe('elsewhere');
  });

  it('accepts intrinsic cover art without a post dependency', async () => {
    const trail = validTrail({
      coverImage: {
        url: 'https://images.example.com/trail.png',
        caption_i18n: { en: 'Three friends together.' }
      }
    });
    await expectAsync(trail.validate()).toBeResolved();
    expect(trail.coverImage.url).toBe('https://images.example.com/trail.png');
  });

  it('rejects unsafe intrinsic covers and ambiguous cover sources', async () => {
    const unsafe = validTrail({ coverImage: { url: 'javascript:alert(1)' } });
    await expectAsync(unsafe.validate()).toBeRejectedWithError(/validation failed/i);
    expect(unsafe.errors['coverImage.url']).toBeDefined();

    const ambiguous = validTrail({
      coverGroupId: 'another-family',
      coverImage: { url: 'https://images.example.com/trail.png' }
    });
    await expectAsync(ambiguous.validate()).toBeRejectedWithError(/validation failed/i);
    expect(ambiguous.errors.coverImage.message).toContain('both');
  });

  it('requires localized cover captions for every published edition', async () => {
    const trail = validTrail({
      publishedLocales: ['en', 'es'],
      title_i18n: { en: 'A trail', es: 'Un sendero' },
      description_i18n: { en: 'Read these.', es: 'Lee estos.' },
      items: [{ groupId: 'one' }, { groupId: 'two' }],
      coverImage: {
        url: 'https://images.example.com/trail.png',
        caption_i18n: { en: 'Three friends together.' }
      }
    });
    await expectAsync(trail.validate()).toBeRejectedWithError(/validation failed/i);
    expect(trail.errors['coverImage.caption_i18n'].message).toContain('published locale "es"');
  });

  it('requires complete metadata and notes for every published locale', async () => {
    const trail = validTrail({ publishedLocales: ['en', 'es'] });
    await expectAsync(trail.validate()).toBeRejectedWithError(/validation failed/i);
    expect(trail.errors.title_i18n.message).toContain('published locale "es"');
    expect(trail.errors.description_i18n.message).toContain('published locale "es"');
    expect(trail.errors['items.0.note_i18n'].message).toContain('published locale "es"');
  });

  it('keeps a published trail from becoming globally visible without a locale', async () => {
    const trail = validTrail({ publishedLocales: [] });
    await expectAsync(trail.validate()).toBeRejectedWithError(/published locale/i);
  });

  it('rejects unsupported metadata and note locales', async () => {
    const trail = validTrail({
      description_i18n: { en: 'A path.', xx: 'Unknown.' },
      items: [
        { groupId: 'group-1', note_i18n: { en: 'Begin.', xx: 'Unknown.' } },
        { groupId: 'group-2' }
      ]
    });
    await expectAsync(trail.validate()).toBeRejectedWithError(/validation failed/i);
    expect(trail.errors.description_i18n).toBeDefined();
    expect(trail.errors['items.0.note_i18n']).toBeDefined();
  });
});

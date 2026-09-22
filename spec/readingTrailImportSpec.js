import fs from 'node:fs';
import {
  buildReadingTrailDefinitionUpdate,
  buildReadingTrailImportPlan,
  validateReadingTrailManifest
} from '../scripts/lib/readingTrailImport.js';

function manifest(overrides = {}) {
  return {
    slug: 'a-short-trail',
    status: 'published',
    sourceLanguage: 'en',
    publishedLocales: ['en'],
    title_i18n: { en: 'A short trail' },
    description_i18n: { en: 'Two readings.' },
    items: [{ groupId: 'group-1' }, { groupId: 'group-2' }],
    ...overrides
  };
}

describe('reading trail import tooling', () => {
  it('validates every checked-in reading trail manifest', () => {
    const filenames = fs.readdirSync('config/reading-trails');
    expect(filenames.length).toBeGreaterThan(0);
    filenames.forEach((filename) => {
      const payload = JSON.parse(fs.readFileSync(`config/reading-trails/${filename}`, 'utf8'));
      expect(() => validateReadingTrailManifest(payload)).not.toThrow();
    });
  });

  it('rejects manifest typos, malformed stops, and undersized trails', () => {
    expect(() => validateReadingTrailManifest(manifest({ accidentalField: true })))
      .toThrowError(/unknown field/);
    expect(() => validateReadingTrailManifest(manifest({ items: [{ groupId: 'only' }] })))
      .toThrowError(/at least two/);
    expect(() => validateReadingTrailManifest(manifest({
      items: [{ groupId: 'one', typo: true }, { groupId: 'two' }]
    }))).toThrowError(/unknown field/);
  });

  it('validates intrinsic cover images and permits only one explicit cover source', () => {
    expect(() => validateReadingTrailManifest(manifest({
      coverImage: { url: 'https://images.example.com/trail.png' }
    }))).not.toThrow();
    expect(() => validateReadingTrailManifest(manifest({
      coverImage: { url: 'javascript:alert(1)' }
    }))).toThrowError(/valid http or https URL/);
    expect(() => validateReadingTrailManifest(manifest({
      coverGroupId: 'cover-family',
      coverImage: { url: 'https://images.example.com/trail.png' }
    }))).toThrowError(/cannot define both/);
  });

  it('plans idempotent creates and updates', () => {
    const definition = { ...manifest(), coverGroupId: 'group-1' };
    const create = buildReadingTrailImportPlan({ existingTrail: null, definition });
    const unchanged = buildReadingTrailImportPlan({ existingTrail: definition, definition });
    const update = buildReadingTrailImportPlan({
      existingTrail: { ...definition, description_i18n: { en: 'Old copy.' } },
      definition
    });

    expect(create.action).toBe('create');
    expect(unchanged).toEqual({ action: 'unchanged', changedFields: [] });
    expect(update.action).toBe('update');
    expect(update.changedFields).toEqual(['description_i18n']);
  });

  it('unsets an old post cover while setting intrinsic cover art', () => {
    const coverImage = { url: 'https://images.example.com/trail.png' };
    expect(buildReadingTrailDefinitionUpdate(
      { coverGroupId: undefined, coverImage },
      ['coverGroupId', 'coverImage']
    )).toEqual({
      $set: { coverImage },
      $unset: { coverGroupId: 1 }
    });
  });
});

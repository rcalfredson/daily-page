import { planBlockLanguageMetadataBackfill } from '../scripts/lib/blockLanguageMetadataBackfill.js';

describe('block language metadata backfill', () => {
  function block(id, groupId, lang, overrides = {}) {
    return {
      _id: id,
      groupId,
      lang,
      createdAt: new Date(`2026-01-0${id.length}T00:00:00.000Z`),
      ...overrides
    };
  }

  it('plans idempotent source metadata for translated and untranslated families', () => {
    const english = block('en', 'family-a', 'en');
    const portuguese = block('pt', 'family-a', 'pt', { originalBlock: 'en' });
    const czech = block('cs', 'family-b', 'cs');

    const report = planBlockLanguageMetadataBackfill([portuguese, czech, english]);

    expect(report.ambiguous).toEqual([]);
    expect(report.ready).toEqual([
      jasmine.objectContaining({ groupId: 'family-a', sourceBlockId: 'en', sourceLanguage: 'en' }),
      jasmine.objectContaining({ groupId: 'family-b', sourceBlockId: 'cs', sourceLanguage: 'cs' })
    ]);
    expect(report.operations[0].updateOne.update.$set).toEqual({
      sourceLanguage: 'en',
      audienceScope: 'global',
      translationPriority: 'normal'
    });
  });

  it('reports ambiguous and malformed families instead of guessing', () => {
    const report = planBlockLanguageMetadataBackfill([
      block('one', 'broken', 'en'),
      block('two', 'broken', 'cs')
    ]);

    expect(report.ready).toEqual([]);
    expect(report.operations).toEqual([]);
    expect(report.ambiguous[0].problems).toContain('multiple-source-records');
  });

  it('reports a translation chain without claiming that its single root is duplicated', () => {
    const report = planBlockLanguageMetadataBackfill([
      block('source', 'chain', 'es'),
      block('middle', 'chain', 'fr', { originalBlock: 'source' }),
      block('last', 'chain', 'en', { originalBlock: 'middle' })
    ]);

    expect(report.ambiguous[0].problems).toEqual(['multiple-referenced-sources']);
    expect(report.ambiguous[0].apparentSourceBlockIds).toEqual(['source']);
  });
});

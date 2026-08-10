import pug from 'pug';
import { createPostGroupResolver } from '../server/routes/blockView.js';
import {
  resolvePostTranslation,
  selectPublicPostTranslation
} from '../server/services/postTranslationResolver.js';

describe('post translation group resolver', () => {
  function post(id, lang, overrides = {}) {
    return {
      _id: id,
      roomId: 'general',
      lang,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides
    };
  }

  it('selects the visitor language before the English fallback', () => {
    const english = post('english-id', 'en');
    const japanese = post('japanese-id', 'ja', { originalBlock: 'english-id' });

    expect(selectPublicPostTranslation([english, japanese], 'ja')).toBe(japanese);
    expect(selectPublicPostTranslation([english, japanese], 'fr')).toBe(english);
  });

  it('matches a regional preference to the corresponding base language', () => {
    const portuguese = post('portuguese-id', 'pt');
    const english = post('english-id', 'en');

    expect(selectPublicPostTranslation([english, portuguese], 'pt-BR')).toBe(portuguese);
  });

  it('uses the original and then the oldest public candidate when English is absent', () => {
    const original = post('original-id', 'ja', {
      createdAt: new Date('2026-02-01T00:00:00.000Z')
    });
    const translation = post('translation-id', 'es', {
      originalBlock: 'missing-id',
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(selectPublicPostTranslation([translation, original], 'fr')).toBe(original);
    expect(selectPublicPostTranslation([
      { ...translation, originalBlock: 'source-id' },
      post('later-id', 'de', {
        originalBlock: 'source-id',
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      })
    ], 'fr')._id).toBe('translation-id');
  });

  it('falls back to an English source instead of unrelated Portuguese or Vietnamese variants', () => {
    const english = post('english-id', 'en', { sourceLanguage: 'en' });
    const portuguese = post('portuguese-id', 'pt', { originalBlock: 'english-id' });
    const vietnamese = post('vietnamese-id', 'vi', { originalBlock: 'english-id' });

    const result = resolvePostTranslation([portuguese, vietnamese, english], 'ru');

    expect(result.record).toBe(english);
    expect(result.isExactLocaleMatch).toBeFalse();
    expect(result.isSourceFallback).toBeTrue();
    expect(result.displayedLanguage).toBe('en');
    expect(result.canonicalSourceId).toBe('english-id');
  });

  it('falls back to a Czech source even when an English translation exists', () => {
    const czech = post('czech-id', 'cs', { sourceLanguage: 'cs' });
    const english = post('english-id', 'en', { originalBlock: 'czech-id' });

    expect(resolvePostTranslation([english, czech], 'ru').record).toBe(czech);
    expect(resolvePostTranslation([english, czech], 'cs').isExactLocaleMatch).toBeTrue();
  });

  it('handles untranslated legacy posts and reports malformed duplicates deterministically', () => {
    const legacy = post('legacy-id', 'de');
    expect(resolvePostTranslation([legacy], 'ru').record).toBe(legacy);

    const newerDuplicate = post('newer-id', 'de', {
      originalBlock: 'legacy-id',
      createdAt: new Date('2026-02-01T00:00:00.000Z')
    });
    const result = resolvePostTranslation([newerDuplicate, legacy], 'de');
    expect(result.record).toBe(legacy);
    expect(result.diagnostics.map(item => item.code)).toContain('duplicate-language');
  });

  it('redirects the group URL without making the negotiated response cacheable', async () => {
    const getCandidates = jasmine.createSpy('getCandidates').and.resolveTo([
      post('english-id', 'en'),
      post('japanese-id', 'ja', { roomId: 'translated-room' })
    ]);
    const handler = createPostGroupResolver({ getCandidates });
    const res = {
      locals: { uiLang: 'ja' },
      set: jasmine.createSpy('set'),
      vary: jasmine.createSpy('vary'),
      redirect: jasmine.createSpy('redirect'),
      sendStatus: jasmine.createSpy('sendStatus')
    };

    await handler({ params: { group_id: 'group-id' } }, res);

    expect(getCandidates).toHaveBeenCalledOnceWith('group-id');
    expect(res.set).toHaveBeenCalledOnceWith('Cache-Control', 'private, no-store');
    expect(res.vary.calls.allArgs()).toEqual([['Accept-Language'], ['Cookie']]);
    expect(res.redirect).toHaveBeenCalledOnceWith(
      302,
      '/rooms/translated-room/blocks/japanese-id'
    );
  });

  it('returns 404 when a group has no publicly visible translations', async () => {
    const handler = createPostGroupResolver({ getCandidates: async () => [] });
    const res = {
      locals: { uiLang: 'en' },
      sendStatus: jasmine.createSpy('sendStatus')
    };

    await handler({ params: { group_id: 'missing-group' } }, res);

    expect(res.sendStatus).toHaveBeenCalledOnceWith(404);
  });
});

describe('block hreflang metadata', () => {
  it('uses concrete translation rooms and one language-independent group URL', () => {
    const html = pug.renderFile('views/partials/_block_hreflang.pug', {
      baseUrl: 'https://dailypage.org',
      room_id: 'source-room',
      block: { groupId: 'group/id' },
      translations: [
        { _id: 'english-id', roomId: 'source-room', lang: 'en' },
        { _id: 'japanese-id', roomId: 'translated-room', lang: 'ja' }
      ]
    });

    expect(html).toContain(
      'hreflang="en" href="https://dailypage.org/rooms/source-room/blocks/english-id"'
    );
    expect(html).toContain(
      'hreflang="ja" href="https://dailypage.org/rooms/translated-room/blocks/japanese-id"'
    );
    expect(html).toContain(
      'hreflang="x-default" href="https://dailypage.org/posts/group%2Fid"'
    );
  });
});

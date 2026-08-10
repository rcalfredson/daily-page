import { resolveBlockLangParam } from '../server/middleware/resolveBlockLangParam.js';
import { canonicalBlockPath } from '../server/utils/canonical.js';

describe('block language redirects', () => {
  function block(id, lang, overrides = {}) {
    return {
      _id: id,
      groupId: 'family',
      roomId: `${lang}-room`,
      lang,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides
    };
  }

  async function redirectFor(requestedLang, candidates) {
    const current = candidates.find(candidate => candidate.lang === 'pt') || candidates[0];
    const middleware = resolveBlockLangParam({
      loadBlock: async () => current,
      getTranslation: async () => null,
      getCandidates: async () => candidates,
      canonicalPathForBlock: canonicalBlockPath
    });
    const res = { redirect: jasmine.createSpy('redirect') };
    await middleware({ query: { lang: requestedLang } }, res, () => {});
    return res.redirect;
  }

  it('links an absent requested language to the concrete source article', async () => {
    const english = block('english-id', 'en', { sourceLanguage: 'en' });
    const portuguese = block('portuguese-id', 'pt', { originalBlock: 'english-id' });
    const vietnamese = block('vietnamese-id', 'vi', { originalBlock: 'english-id' });

    const redirect = await redirectFor('ru', [portuguese, vietnamese, english]);

    expect(redirect).toHaveBeenCalledOnceWith(302, '/rooms/en-room/blocks/english-id');
  });

  it('links a real requested translation to its concrete article', async () => {
    const english = block('english-id', 'en', { sourceLanguage: 'en' });
    const portuguese = block('portuguese-id', 'pt', { originalBlock: 'english-id' });
    const russian = block('russian-id', 'ru', { originalBlock: 'english-id' });

    const redirect = await redirectFor('ru', [portuguese, russian, english]);

    expect(redirect).toHaveBeenCalledOnceWith(302, '/rooms/ru-room/blocks/russian-id');
  });
});

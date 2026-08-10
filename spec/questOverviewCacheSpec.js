import Quest from '../server/db/models/Quest.js';
import QuestItem from '../server/db/models/QuestItem.js';
import * as cache from '../server/services/cache.js';
import { listPublicQuestsOverview } from '../server/db/questService.js';

function queryResult(result) {
  return {
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(result); }
  };
}

describe('public quest overview cache', () => {
  afterEach(() => {
    cache.clear();
  });

  it('reuses completed overview results and isolates them by language', async () => {
    const quest = {
      _id: 'quest-overview-cache',
      slug: 'cached-quest',
      type: 'set',
      status: 'active',
      name: 'Cached quest',
      name_i18n: { en: 'Cached quest', es: 'Misión almacenada' }
    };
    const listSpy = spyOn(Quest, 'find').and.returnValue(queryResult([quest]));
    const totalSpy = spyOn(Quest, 'countDocuments').and.resolveTo(1);
    const questSpy = spyOn(Quest, 'findById').and.resolveTo(quest);
    const progressSpy = spyOn(QuestItem, 'countDocuments').and.resolveTo(4);

    const first = await listPublicQuestsOverview({ uiLang: 'en', page: 1, limit: 3 });
    const second = await listPublicQuestsOverview({ uiLang: 'en', page: 1, limit: 3 });
    await listPublicQuestsOverview({ uiLang: 'es', page: 1, limit: 3 });

    expect(second).toBe(first);
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(totalSpy).toHaveBeenCalledTimes(2);
    expect(questSpy).toHaveBeenCalledTimes(2);
    expect(progressSpy).toHaveBeenCalledTimes(4);
  });
});

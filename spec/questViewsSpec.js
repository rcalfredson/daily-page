import pug from 'pug';
import { isLocalizedPath } from '../server/services/localizedPaths.js';
import { resolveQuestDetailView } from '../server/routes/quests.js';

describe('quest views', () => {
  for (const view of ['index', 'detail', 'leaderboard', 'review']) {
    it(`compiles the ${view} page`, () => {
      expect(() => pug.compileFile(`${process.cwd()}/views/quests/${view}.pug`))
        .not.toThrow();
    });
  }

  it('recognizes public quest routes as localized paths', () => {
    expect(isLocalizedPath('/quests')).toBeTrue();
    expect(isLocalizedPath('/quests/virtual-road-trip')).toBeTrue();
    expect(isLocalizedPath('/quests/virtual-road-trip/leaderboard')).toBeTrue();
  });

  it('integrates all three views while keeping count quests off the item panel', () => {
    expect(resolveQuestDetailView('items', 'set')).toBe('items');
    expect(resolveQuestDetailView('posts', 'set')).toBe('posts');
    expect(resolveQuestDetailView('leaderboard', 'set')).toBe('leaderboard');
    expect(resolveQuestDetailView('items', 'count')).toBe('posts');
    expect(resolveQuestDetailView('leaderboard', 'count')).toBe('leaderboard');
  });
});

import pug from 'pug';
import { isLocalizedPath } from '../server/services/localizedPaths.js';

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
});

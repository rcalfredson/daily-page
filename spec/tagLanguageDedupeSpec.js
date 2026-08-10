import Block from '../server/db/models/Block.js';
import { findByTagWithLangPref } from '../server/db/blockService.js';

describe('tag page language deduplication', () => {
  it('selects among tagged variants without loading every translation in each family', async () => {
    const taggedEnglish = {
      _id: 'tagged-en',
      groupId: 'tagged-family',
      lang: 'en',
      tags: ['performance']
    };

    const aggregateSpy = spyOn(Block, 'aggregate').and.returnValue({
      exec: async () => [taggedEnglish]
    });
    const findSpy = spyOn(Block, 'find');

    const result = await findByTagWithLangPref({
      tag: 'performance',
      preferredLang: 'en',
      limit: 20
    });

    expect(result).toEqual([taggedEnglish]);
    expect(findSpy).not.toHaveBeenCalled();

    const pipeline = aggregateSpy.calls.argsFor(0)[0];
    expect(pipeline[0].$match.$and[0]).toEqual({ tags: 'performance' });
    expect(JSON.stringify(pipeline)).toContain('"$eq":["$$d.lang","en"]');
    expect(pipeline.at(-1)).toEqual({ $limit: 20 });
  });
});

import Block from '../server/db/models/Block.js';
import { findDraftsByUser } from '../server/db/blockService.js';

describe('account dashboard draft selection', () => {
  it('returns an in-progress translation instead of resolving its language family', async () => {
    const russianDraft = {
      _id: 'draft-ru',
      groupId: 'translated-draft',
      creator: 'writer',
      roomId: 'general',
      status: 'in-progress',
      lang: 'ru',
      updatedAt: new Date('2026-07-08T00:00:00.000Z')
    };
    const aggregateSpy = spyOn(Block, 'aggregate').and.returnValue({
      exec: async () => [russianDraft]
    });
    const findSpy = spyOn(Block, 'find');

    const result = await findDraftsByUser({
      username: 'writer',
      preferredLang: 'en',
      limit: 5
    });

    expect(result).toEqual([russianDraft]);
    expect(findSpy).not.toHaveBeenCalled();

    const pipeline = aggregateSpy.calls.first().args[0];
    expect(pipeline.some(stage => stage.$group)).toBeFalse();
    expect(pipeline[0]).toEqual({
      $match: {
        $and: [
          { $or: [{ creator: 'writer' }, { collaborators: 'writer' }] },
          { creator: 'writer', status: 'in-progress' }
        ]
      }
    });
    expect(pipeline.at(-1)).toEqual({ $limit: 5 });
  });
});

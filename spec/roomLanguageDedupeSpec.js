import Block from '../server/db/models/Block.js';
import { getBlocksByRoomWithFallback } from '../server/db/blockService.js';

describe('room dashboard language deduplication', () => {
  it('uses an older preferred-language counterpart after recency-window deduplication', async () => {
    const newerRussian = {
      _id: 'newer-ru',
      groupId: 'translated-post',
      roomId: 'general',
      status: 'locked',
      visibility: 'public',
      lang: 'ru',
      createdAt: new Date('2026-07-08T00:00:00.000Z')
    };
    const olderEnglish = {
      ...newerRussian,
      _id: 'older-en',
      lang: 'en',
      createdAt: new Date('2026-06-01T00:00:00.000Z')
    };

    spyOn(Block, 'aggregate').and.returnValue({
      exec: async () => [newerRussian]
    });
    const findSpy = spyOn(Block, 'find').and.returnValue({
      lean() {
        return this;
      },
      exec: async () => [olderEnglish]
    });

    const result = await getBlocksByRoomWithFallback({
      roomId: 'general',
      status: 'locked',
      preferredLang: 'en'
    });

    expect(result.blocks.map(block => block._id)).toEqual(['older-en']);
    expect(findSpy).toHaveBeenCalledWith({
      $and: [
        {
          groupId: { $in: ['translated-post'] },
          lang: 'en',
          roomId: 'general',
          status: 'locked'
        },
        {
          $or: [
            { visibility: 'public' },
            { visibility: 'unlisted', status: 'locked' }
          ]
        }
      ]
    });
  });
});

import Block from '../server/db/models/Block.js';
import {
  getBlocksByRoomWithFallback,
  getTopBlocksWithFallback
} from '../server/db/blockService.js';

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

  it('fills the locked-post target from progressively older room activity', async () => {
    const recent = {
      _id: 'recent-room-post',
      groupId: 'recent-room-group',
      roomId: 'cumulative-room',
      status: 'locked',
      visibility: 'public',
      lang: 'en',
      voteCount: 3
    };
    const older = {
      ...recent,
      _id: 'older-room-post',
      groupId: 'older-room-group',
      voteCount: 8
    };
    let band = 0;

    const aggregateSpy = spyOn(Block, 'aggregate').and.callFake(() => ({
      exec: async () => {
        band += 1;
        if (band === 1) return [recent];
        if (band === 2) return [older];
        return [];
      }
    }));

    const result = await getTopBlocksWithFallback({
      roomId: 'cumulative-room',
      status: 'locked',
      lockedOnly: true,
      limit: 2,
      preferredLang: 'en'
    });

    expect(result.blocks.map(block => block._id)).toEqual([
      'recent-room-post',
      'older-room-post'
    ]);
    expect(result.period).toEqual({ type: 'days', value: 7 });
    expect(aggregateSpy.calls.count()).toBe(2);

    const firstMatch = aggregateSpy.calls.argsFor(0)[0][0].$match;
    expect(firstMatch.$and[0].roomId).toBe('cumulative-room');
    expect(firstMatch.status).toBe('locked');
  });
});

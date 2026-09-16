import Block from '../server/db/models/Block.js';
import * as cache from '../server/services/cache.js';
import {
  buildHomeDiscoveryCandidatePipeline,
  getHomeDiscoveryCandidates,
  getHomeDiscoveryShelf,
  homeDiscoveryDateKey,
  selectHomeDiscoveryPosts
} from '../server/services/homeDiscovery.js';

describe('homepage discovery shelf', () => {
  function candidate(id, overrides = {}) {
    return {
      _id: id,
      groupId: `group-${id}`,
      roomId: `room-${id}`,
      lang: 'en',
      title: `Post ${id}`,
      description: 'A sufficiently descriptive introduction for a discovery card.',
      contentLength: 1200,
      tags: [`tag-${id}`],
      voteCount: 0,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      ...overrides
    };
  }

  beforeEach(() => cache.clear());

  it('queries only public, locked posts and projects lightweight discovery metadata', () => {
    const pipeline = buildHomeDiscoveryCandidatePipeline('en', 40);

    expect(pipeline[0]).toEqual({
      $match: {
        visibility: 'public',
        status: 'locked'
      }
    });
    expect(pipeline[1].$project.content).toBeUndefined();
    expect(pipeline[1].$project.contentLength).toEqual({
      $strLenCP: { $ifNull: ['$content', ''] }
    });
    expect(pipeline.at(-1)).toEqual({ $limit: 40 });
  });

  it('caches the locale-specific candidate pool', async () => {
    const exec = jasmine.createSpy('exec').and.resolveTo([candidate('a')]);
    const aggregate = spyOn(Block, 'aggregate').and.returnValue({ exec });

    const first = await getHomeDiscoveryCandidates({ preferredLang: 'en', limit: 40 });
    const second = await getHomeDiscoveryCandidates({ preferredLang: 'en', limit: 40 });

    expect(first).toEqual(second);
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('keeps the broad candidate-pool limit separate from the shelf size', async () => {
    const exec = jasmine.createSpy('exec').and.resolveTo([
      candidate('a'),
      candidate('b'),
      candidate('c')
    ]);
    const aggregate = spyOn(Block, 'aggregate').and.returnValue({ exec });

    const shelf = await getHomeDiscoveryShelf({
      preferredLang: 'en',
      limit: 2,
      candidateLimit: 40,
      now: new Date('2026-09-15T12:00:00.000Z')
    });

    expect(shelf).toHaveSize(2);
    expect(aggregate.calls.mostRecent().args[0].at(-1)).toEqual({ $limit: 40 });
  });

  it('selects different rooms before repeating a room', () => {
    const candidates = [
      candidate('a', { roomId: 'physics', voteCount: 20 }),
      candidate('b', { roomId: 'physics', voteCount: 10 }),
      candidate('c', { roomId: 'fiction' }),
      candidate('d', { roomId: 'computing' })
    ];

    const result = selectHomeDiscoveryPosts(candidates, {
      limit: 3,
      now: new Date('2026-09-15T12:00:00.000Z')
    });

    expect(new Set(result.map(item => item.roomId)).size).toBe(3);
  });

  it('fills the shelf from repeated rooms when there are not enough unique rooms', () => {
    const candidates = [
      candidate('a', { roomId: 'physics' }),
      candidate('b', { roomId: 'physics' }),
      candidate('c', { roomId: 'fiction' })
    ];

    expect(selectHomeDiscoveryPosts(candidates, { limit: 3 })).toHaveSize(3);
  });

  it('deduplicates translation families and skips thin posts', () => {
    const result = selectHomeDiscoveryPosts([
      candidate('english', { groupId: 'shared' }),
      candidate('spanish', { groupId: 'shared', lang: 'es' }),
      candidate('thin', { description: '', contentLength: 20 }),
      candidate('other')
    ], { limit: 6 });

    expect(result.map(item => item.groupId).filter(group => group === 'shared')).toHaveSize(1);
    expect(result.map(item => item._id)).not.toContain('thin');
  });

  it('is stable throughout a UTC day', () => {
    const candidates = Array.from({ length: 12 }, (_, index) => candidate(String(index)));
    const morning = new Date('2026-09-15T01:00:00.000Z');
    const evening = new Date('2026-09-15T23:59:59.000Z');

    expect(homeDiscoveryDateKey(morning)).toBe('2026-09-15');
    expect(selectHomeDiscoveryPosts(candidates, { now: morning }).map(item => item._id))
      .toEqual(selectHomeDiscoveryPosts(candidates, { now: evening }).map(item => item._id));
  });
});

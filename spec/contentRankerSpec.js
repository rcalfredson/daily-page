import {
  extractSearchTerms,
  rankBlockRecommendations,
  rankElsewhereRecommendations
} from '../server/recommendations/contentRanker.js';

describe('content recommendation ranker', () => {
  const source = {
    _id: 'source',
    groupId: 'source-group',
    roomId: 'gardening',
    title: 'Growing tomatoes in small city gardens',
    description: 'Container gardening techniques for healthy tomato plants.',
    content: 'Choose rich soil and give tomato roots enough water and sunlight.',
    tags: ['tomatoes', 'urban gardening'],
    updatedAt: '2026-01-01T00:00:00.000Z'
  };

  it('extracts weighted title and tag terms for candidate generation', () => {
    const terms = extractSearchTerms(source, 6);

    expect(terms).toContain('tomatoes');
    expect(terms).toContain('gardening');
    expect(terms).not.toContain('in');
  });

  it('prefers a semantic cross-room connection over an unrelated same-room post', () => {
    const candidates = [
      {
        _id: 'unrelated',
        groupId: 'unrelated-group',
        roomId: 'gardening',
        title: 'Building a wooden garden gate',
        description: 'A carpentry project with hinges and cedar boards.',
        content: 'Measure lumber, cut the frame, and attach the hardware.',
        tags: ['woodworking'],
        createdAt: '2026-01-01T00:00:00.000Z',
        voteCount: 10
      },
      {
        _id: 'semantic',
        groupId: 'semantic-group',
        roomId: 'food',
        title: 'Why container tomatoes need deep soil',
        description: 'Healthy roots, watering, and sunlight for urban tomato plants.',
        content: 'Container gardening succeeds when tomato roots have space and rich soil.',
        tags: ['tomatoes', 'containers'],
        createdAt: '2025-01-01T00:00:00.000Z',
        voteCount: 0
      }
    ];

    const ranked = rankBlockRecommendations(source, candidates, {
      limit: 2,
      now: new Date('2026-01-02T00:00:00.000Z')
    });

    expect(String(ranked[0]._id)).toBe('semantic');
  });

  it('excludes the source translation group and deduplicates candidate groups', () => {
    const candidates = [
      { ...source, _id: 'source-translation', lang: 'es' },
      { ...source, _id: 'first', groupId: 'shared-group', title: 'Tomato soil basics' },
      { ...source, _id: 'second', groupId: 'shared-group', title: 'More tomato soil basics' }
    ];

    const ranked = rankBlockRecommendations(source, candidates, { limit: 5 });

    expect(ranked.map((block) => String(block._id))).toEqual(['first']);
  });

  it('does not recommend unrelated cross-room filler', () => {
    const ranked = rankBlockRecommendations(source, [{
      _id: 'filler',
      groupId: 'filler-group',
      roomId: 'music',
      title: 'Modal harmony for jazz piano',
      description: 'Voicings and improvisation.',
      content: 'Practice scales over chord changes.',
      tags: ['music']
    }]);

    expect(ranked).toEqual([]);
  });

  it('builds a stable elsewhere lane from strong posts in different rooms', () => {
    const candidates = [
      {
        _id: 'same-room', groupId: 'same-room-group', roomId: 'gardening',
        title: 'A different garden topic', description: 'A substantial description about garden tools.',
        contentLength: 1800, tags: ['tools'], voteCount: 8
      },
      {
        _id: 'already-related', groupId: 'related-group', roomId: 'food',
        title: 'Cooking tomatoes', description: 'A substantial description about tomato recipes.',
        contentLength: 1800, tags: ['tomatoes'], voteCount: 8
      },
      {
        _id: 'music', groupId: 'music-group', roomId: 'music',
        title: 'The architecture of a jazz trio',
        description: 'An inviting look at musical conversation and improvisation.',
        contentLength: 2200, tags: ['jazz', 'music'], voteCount: 6,
        bannerImage: { url: 'https://example.com/jazz.jpg' }
      },
      {
        _id: 'history', groupId: 'history-group', roomId: 'computing',
        title: 'How mainframes learned to share time',
        description: 'A journey through terminals, operating systems, and computing history.',
        contentLength: 2400, tags: ['computing', 'history'], voteCount: 5,
        editorial: { role: 'companion' }
      },
      {
        _id: 'history-translation', groupId: 'history-group', roomId: 'computing',
        title: 'A translated computing history post',
        description: 'Another variant from the same translation family.',
        contentLength: 2400, tags: ['computing', 'history'], voteCount: 5
      }
    ];
    const options = {
      limit: 2,
      excludeGroups: ['related-group'],
      seed: 'stable-request',
      now: new Date('2026-09-19T12:00:00.000Z')
    };

    const first = rankElsewhereRecommendations(source, candidates, options);
    const repeated = rankElsewhereRecommendations(source, candidates, options);

    expect(first.map(item => item._id).sort()).toEqual(['history', 'music']);
    expect(new Set(first.map(item => item.roomId)).size).toBe(2);
    expect(repeated.map(item => item._id)).toEqual(first.map(item => item._id));
  });
});

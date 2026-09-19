import {
  getHomeActivitySince,
  getHomeActivityVisibility,
  getHomeTopBlocksOptions,
  getHomeTrendingTagsOptions,
  HOME_FEED_PREVIEW_CHARS,
  HOME_ACTIVITY_MINIMUM,
  HOME_ACTIVITY_WINDOW_DAYS,
  toHomeDiscoveryCards,
  toHomeFeedPreviewDTO
} from '../server/services/homepage.js';
import { toBlockPreviewDTO } from '../server/utils/block.js';

describe('homepage activity visibility', () => {
  it('uses a seven-day activity window', () => {
    const now = new Date('2026-07-10T12:00:00.000Z');
    expect(HOME_ACTIVITY_WINDOW_DAYS).toBe(7);
    expect(getHomeActivitySince(now).toISOString()).toBe('2026-07-03T12:00:00.000Z');
  });

  it('qualifies comments and reactions independently at four records', () => {
    const comments = Array.from({ length: HOME_ACTIVITY_MINIMUM }, () => ({}));
    const reactions = Array.from({ length: HOME_ACTIVITY_MINIMUM - 1 }, () => ({}));
    expect(getHomeActivityVisibility({ comments, reactions })).toEqual({
      showRecentComments: true,
      showRecentReactions: false
    });
  });

  it('hides both feeds below the threshold', () => {
    expect(getHomeActivityVisibility()).toEqual({
      showRecentComments: false,
      showRecentReactions: false
    });
  });

  it('builds the shared locale-aware homepage cache request options', () => {
    expect(getHomeTopBlocksOptions('ru', 6)).toEqual({
      lockedOnly: false,
      limit: 26,
      preferredLang: 'ru',
      includePinnedHome: true
    });
    expect(getHomeTrendingTagsOptions('ru')).toEqual({
      limit: 10,
      sortBy: 'totalBlocks',
      preferredLang: 'ru'
    });
  });

  it('builds shorter homepage-only feed previews', () => {
    const paragraph = 'A detailed sentence about a worthwhile subject. '.repeat(4).trim();
    const block = {
      _id: 'post-1',
      title: 'A substantial post',
      content: [paragraph, paragraph, paragraph, paragraph].join('\n\n'),
      creator: 'writer',
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      roomId: 'general',
      lang: 'en',
      status: 'locked',
      votes: []
    };

    const preview = toHomeFeedPreviewDTO(block, { userId: 'reader-1' });

    expect(HOME_FEED_PREVIEW_CHARS).toBe(450);
    expect(preview.truncated).toBeTrue();
    expect(preview.contentHTML).toContain('A detailed sentence');
    expect(preview.contentHTML.match(/<p>/g)).toHaveSize(3);
    expect(toBlockPreviewDTO(block).truncated).toBeFalse();
  });

  it('builds compact localized discovery cards without embedding Street View', () => {
    const description = '**A discovery description** with   irregular spacing. '.repeat(8);
    const cards = toHomeDiscoveryCards([
      {
        _id: 'post-1',
        groupId: 'group-1',
        roomId: 'physics',
        lang: 'es',
        title: 'Conos de luz',
        description,
        bannerImage: { kind: 'streetview', url: 'https://example.com/embed' }
      },
      {
        _id: 'post-2',
        roomId: 'computing',
        title: 'A computing post',
        bannerImage: { kind: 'image', url: 'https://example.com/banner.jpg' }
      }
    ], {
      physics: { displayName: 'Física' }
    });

    expect(cards[0].roomName).toBe('Física');
    expect(cards[0].description.length).toBeLessThanOrEqual(221);
    expect(cards[0].description.endsWith('…')).toBeTrue();
    expect(cards[0].description).not.toContain('  ');
    expect(cards[0].description).not.toContain('**');
    expect(cards[0].bannerImage).toBeNull();
    expect(cards[1].roomName).toBe('computing');
    expect(cards[1].lang).toBe('en');
    expect(cards[1].bannerImage.url).toBe('https://example.com/banner.jpg');
  });
});

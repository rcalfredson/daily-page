import { toBlockPreviewDTO } from '../server/utils/block.js';

describe('block preview DTO', () => {
  const bannerImage = {
    url: 'https://images.example.com/banner.jpg',
    caption: 'A banner caption'
  };

  function makeBlock(overrides = {}) {
    return {
      _id: 'block-id',
      title: 'A post with enough content',
      content: 'This post has preview content.',
      creator: 'writer',
      createdAt: new Date('2026-06-28T12:00:00Z'),
      roomId: 'general',
      lang: 'en',
      status: 'locked',
      votes: [],
      voteCount: 0,
      bannerImage,
      ...overrides
    };
  }

  it('preserves banner metadata in regular previews', () => {
    const preview = toBlockPreviewDTO(makeBlock());

    expect(preview.bannerImage).toEqual(bannerImage);
  });

  it('preserves banner metadata in title-only previews', () => {
    const preview = toBlockPreviewDTO(makeBlock({
      title: 'A title-only draft',
      content: '',
      createdAt: new Date()
    }));

    expect(preview.isTitleOnly).toBeTrue();
    expect(preview.bannerImage).toEqual(bannerImage);
  });

  it('preserves pinned homepage metadata', () => {
    const pinnedAt = new Date('2026-07-08T15:00:00Z');
    const preview = toBlockPreviewDTO(makeBlock({ pinnedAt }));

    expect(preview.pinnedAt).toEqual(pinnedAt);
  });
});

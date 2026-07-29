import {
  blockAuthorDisplayName,
  blockAuthorProfilePath,
  toBlockPreviewDTO
} from '../server/utils/block.js';

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

  it('links deletion-anonymized posts to the protected anonymous profile', () => {
    const block = makeBlock({
      creator: 'anonymous',
      authorshipState: 'anonymous'
    });

    expect(blockAuthorProfilePath(block)).toBe('/users/anonymous');
    expect(toBlockPreviewDTO(block).authorProfilePath).toBe('/users/anonymous');
  });

  it('keeps deleted-author attribution unlinked', () => {
    const block = makeBlock({
      creator: 'Deleted author',
      authorshipState: 'deleted-author'
    });

    expect(blockAuthorProfilePath(block)).toBeNull();
    expect(toBlockPreviewDTO(block).authorProfilePath).toBeNull();
  });

  it('retains profile links for live named and legacy anonymous posts', () => {
    expect(blockAuthorProfilePath(makeBlock({ creator: 'writer name' })))
      .toBe('/users/writer%20name');
    expect(blockAuthorProfilePath(makeBlock({ creator: 'anonymous' })))
      .toBe('/users/anonymous');
  });

  it('localizes only the displayed anonymous identity', () => {
    const block = makeBlock({
      creator: 'anonymous',
      authorshipState: 'anonymous'
    });

    expect(blockAuthorDisplayName(block, { anonymous: 'Anónimo' })).toBe('Anónimo');
    expect(block.creator).toBe('anonymous');
    expect(blockAuthorProfilePath(block)).toBe('/users/anonymous');
    expect(blockAuthorDisplayName(makeBlock(), { anonymous: 'Anónimo' })).toBe('writer');
  });

  it('localizes deleted-author attribution without changing its stored marker', () => {
    const block = makeBlock({
      creator: 'Deleted author',
      authorshipState: 'deleted-author'
    });

    expect(blockAuthorDisplayName(block, { deletedAuthor: 'Auteur supprimé' }))
      .toBe('Auteur supprimé');
    expect(block.creator).toBe('Deleted author');
    expect(blockAuthorProfilePath(block)).toBeNull();
  });
});

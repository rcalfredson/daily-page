import {
  HOME_PINNED_BLOCK_LIMIT,
  mergePinnedHomeBlocks,
  replaceWithPreferredTranslationVariants
} from '../server/db/blockService.js';

describe('home pinned blocks', () => {
  function block(id, overrides = {}) {
    return {
      _id: id,
      groupId: `group-${id}`,
      title: id,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      voteCount: 0,
      ...overrides
    };
  }

  it('places pinned posts before normal posts', () => {
    const result = mergePinnedHomeBlocks(
      [block('pinned', { pinnedAt: new Date('2026-07-08T00:00:00.000Z') })],
      [block('normal-a'), block('normal-b')]
    );

    expect(result.map(b => b._id)).toEqual(['pinned', 'normal-a', 'normal-b']);
  });

  it('keeps normal posts in their existing order beneath pins', () => {
    const result = mergePinnedHomeBlocks(
      [block('pinned')],
      [block('normal-high'), block('normal-mid'), block('normal-low')]
    );

    expect(result.slice(1).map(b => b._id)).toEqual(['normal-high', 'normal-mid', 'normal-low']);
  });

  it('does not duplicate a pinned post that is also in the normal feed', () => {
    const pinned = block('same-post');
    const result = mergePinnedHomeBlocks(
      [pinned],
      [pinned, block('normal')]
    );

    expect(result.map(b => b._id)).toEqual(['same-post', 'normal']);
  });

  it('does not duplicate another translation from the same pinned post group', () => {
    const result = mergePinnedHomeBlocks(
      [block('pinned-en', { groupId: 'vision-post' })],
      [block('pinned-es', { groupId: 'vision-post' }), block('normal')]
    );

    expect(result.map(b => b._id)).toEqual(['pinned-en', 'normal']);
  });

  it('keeps older pinned posts ahead of newer normal posts', () => {
    const result = mergePinnedHomeBlocks(
      [block('old-pinned', {
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        pinnedAt: new Date('2026-07-08T00:00:00.000Z')
      })],
      [block('new-normal', { createdAt: new Date('2026-07-08T00:00:00.000Z') })]
    );

    expect(result.map(b => b._id)).toEqual(['old-pinned', 'new-normal']);
  });

  it('limits pinned homepage posts', () => {
    const pinned = [
      block('pinned-1'),
      block('pinned-2'),
      block('pinned-3'),
      block('pinned-4')
    ];
    const result = mergePinnedHomeBlocks(pinned, [block('normal')]);

    expect(result.slice(0, HOME_PINNED_BLOCK_LIMIT).map(b => b._id))
      .toEqual(['pinned-1', 'pinned-2', 'pinned-3']);
    expect(result.map(b => b._id)).not.toContain('pinned-4');
  });

  it('uses an older preferred-language translation after age-band deduplication', () => {
    const newerRussian = block('newer-ru', {
      groupId: 'translated-post',
      lang: 'ru',
      createdAt: new Date('2026-07-08T00:00:00.000Z')
    });
    const olderEnglish = block('older-en', {
      groupId: 'translated-post',
      lang: 'en',
      createdAt: new Date('2026-07-01T00:00:00.000Z')
    });

    const result = replaceWithPreferredTranslationVariants(
      [newerRussian, block('untranslated', { lang: 'ru' })],
      [olderEnglish],
      'en'
    );

    expect(result.map(b => b._id)).toEqual(['older-en', 'untranslated']);
  });
});

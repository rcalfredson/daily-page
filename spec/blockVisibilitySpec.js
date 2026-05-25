import {
  isPubliclyVisibleBlock,
  publiclyVisibleBlockMatch
} from '../server/db/blockService.js';

describe('block public visibility', () => {
  it('treats public in-progress blocks as publicly visible', () => {
    expect(isPubliclyVisibleBlock({
      visibility: 'public',
      status: 'in-progress'
    })).toBeTrue();
  });

  it('treats unlisted locked blocks as publicly visible', () => {
    expect(isPubliclyVisibleBlock({
      visibility: 'unlisted',
      status: 'locked'
    })).toBeTrue();
  });

  it('hides unlisted in-progress blocks from public surfaces', () => {
    expect(isPubliclyVisibleBlock({
      visibility: 'unlisted',
      status: 'in-progress'
    })).toBeFalse();
  });

  it('combines existing filters with the public visibility rule', () => {
    expect(publiclyVisibleBlockMatch({ roomId: 'general' })).toEqual({
      $and: [
        { roomId: 'general' },
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

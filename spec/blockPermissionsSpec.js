import {
  canEditBlockContent,
  canManageBlock,
  isLoggedInBlockCreator,
  parseEditTokens
} from '../server/utils/block.js';

describe('block editing permissions', () => {
  const user = { id: 'user-1', username: 'alice' };

  it('allows the logged-in creator to manage a locked block by persistent user id', () => {
    const block = {
      userId: 'user-1',
      creator: 'alice',
      editToken: 'token-1',
      status: 'locked'
    };

    expect(isLoggedInBlockCreator(user, block)).toBeTrue();
    expect(canManageBlock(user, block, [])).toBeTrue();
    expect(canEditBlockContent(user, block)).toBeTrue();
  });

  it('does not let an edit token manage a locked block', () => {
    const block = {
      userId: null,
      creator: 'anonymous',
      editToken: 'token-1',
      status: 'locked'
    };

    expect(canManageBlock(null, block, ['token-1'])).toBeFalse();
    expect(canEditBlockContent(null, block)).toBeFalse();
  });

  it('keeps in-progress block content open for live collaboration', () => {
    const block = {
      userId: 'user-1',
      creator: 'alice',
      editToken: 'token-1',
      status: 'in-progress'
    };

    expect(canEditBlockContent(null, block)).toBeTrue();
    expect(canManageBlock(null, block, ['token-1'])).toBeTrue();
  });

  it('ignores malformed edit token cookies', () => {
    expect(parseEditTokens('not-json')).toEqual([]);
    expect(parseEditTokens('{"token": "token-1"}')).toEqual([]);
    expect(parseEditTokens('["token-1"]')).toEqual(['token-1']);
  });
});

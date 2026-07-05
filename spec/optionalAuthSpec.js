import { rememberPreferredUiLang } from '../server/middleware/optionalAuth.js';

describe('optional auth language preference', () => {
  function auth(preferredUiLang = 'en') {
    return {
      user: { id: 'user-1', preferredUiLang },
      dbUser: { _id: 'user-1', preferredUiLang }
    };
  }

  it('persists a newly selected supported UI language', async () => {
    const authenticated = auth('en');
    const update = jasmine.createSpy('update').and.resolveTo();

    const changed = await rememberPreferredUiLang(authenticated, 'fr', update);

    expect(changed).toBeTrue();
    expect(update).toHaveBeenCalledOnceWith('user-1', 'fr');
    expect(authenticated.user.preferredUiLang).toBe('fr');
    expect(authenticated.dbUser.preferredUiLang).toBe('fr');
  });

  it('does not write an unchanged or unsupported UI language', async () => {
    const authenticated = auth('fr');
    const update = jasmine.createSpy('update').and.resolveTo();

    expect(await rememberPreferredUiLang(authenticated, 'fr', update)).toBeFalse();
    expect(await rememberPreferredUiLang(authenticated, 'xx', update)).toBeFalse();
    expect(update).not.toHaveBeenCalled();
  });
});

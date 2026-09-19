import { buildSurpriseDiscoveryHandler } from '../server/routes/discovery.js';
import { isLocalizedPath } from '../server/services/localizedPaths.js';

function response(uiLang = 'es') {
  return {
    locals: {
      uiLang,
      uiPath: path => `/${uiLang}${path}`
    },
    set: jasmine.createSpy('set'),
    redirect: jasmine.createSpy('redirect')
  };
}

describe('surprise discovery route', () => {
  it('redirects to a localized discovery post without caching the result', async () => {
    const loadSurprisePost = jasmine.createSpy('loadSurprisePost').and.resolveTo({
      _id: 'post-1',
      roomId: 'physics'
    });
    const handler = buildSurpriseDiscoveryHandler({
      loadSurprisePost,
      createSeed: () => 'request-seed'
    });
    const res = response();

    await handler({}, res);

    expect(loadSurprisePost).toHaveBeenCalledOnceWith({
      preferredLang: 'es',
      seed: 'request-seed'
    });
    expect(res.set).toHaveBeenCalledOnceWith('Cache-Control', 'no-store');
    expect(res.redirect).toHaveBeenCalledOnceWith(
      302,
      '/es/rooms/physics/blocks/post-1'
    );
  });

  it('falls back to the localized rooms index when no post is available', async () => {
    const handler = buildSurpriseDiscoveryHandler({
      loadSurprisePost: jasmine.createSpy('loadSurprisePost').and.resolveTo(null)
    });
    const res = response('ja');

    await handler({}, res);

    expect(res.redirect).toHaveBeenCalledOnceWith(302, '/ja/rooms');
  });

  it('falls back safely when selection fails', async () => {
    spyOn(console, 'error');
    const handler = buildSurpriseDiscoveryHandler({
      loadSurprisePost: jasmine.createSpy('loadSurprisePost').and.rejectWith(new Error('database unavailable'))
    });
    const res = response('fr');

    await handler({}, res);

    expect(console.error).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledOnceWith(302, '/fr/rooms');
  });

  it('participates in localized HTML routing', () => {
    expect(isLocalizedPath('/discover/surprise')).toBeTrue();
  });
});

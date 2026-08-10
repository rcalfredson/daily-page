import { addHreflangLocals } from '../server/middleware/hreflang.js';
import { addSeoLocals } from '../server/middleware/seo.js';

describe('localized homepage canonical and hreflang URLs', () => {
  it('uses the same trailing-slash URL for canonical and the matching alternate', () => {
    const req = {
      path: '/ru/',
      protocol: 'http',
      headers: {},
      get: () => 'localhost:3000'
    };
    const res = {
      locals: {
        baseUrl: 'http://localhost:3000',
        unprefixedPath: '/',
        prefixedPath: '/ru/'
      }
    };

    addSeoLocals(req, res, () => {});
    addHreflangLocals(req, res, () => {});

    expect(res.locals.canonicalUrl).toBe('http://localhost:3000/ru/');
    expect(res.locals.hreflang.find(item => item.lang === 'ru').href)
      .toBe(res.locals.canonicalUrl);
    expect(res.locals.hreflang.find(item => item.lang === 'x-default').href)
      .toBe('http://localhost:3000/en/');
  });
});

import fs from 'node:fs';
import pug from 'pug';

import { SUPPORTED_UI_LANGS } from '../server/services/localeContext.js';

const partialPath = 'views/partials/_block_recommendations.pug';

function item(id, overrides = {}) {
  return {
    id,
    roomId: `room-${id}`,
    roomName: `Room ${id}`,
    lang: 'en',
    title: `Post ${id}`,
    description: `Description ${id}`,
    tags: ['one'],
    creator: 'writer',
    createdAt: new Date('2026-09-19T12:00:00.000Z'),
    ...overrides
  };
}

function render(recommendations) {
  return pug.renderFile(partialPath, {
    recommendations,
    uiLang: 'en',
    uiPath: path => `/en${path}`,
    textDirForLang: lang => lang === 'ar' ? 'rtl' : 'ltr',
    blockAuthorDisplayName: recommendation => recommendation.creator,
    t: key => key
  });
}

describe('block recommendation lanes view', () => {
  it('renders related and elsewhere recommendations as distinct labeled lanes', () => {
    const html = render({
      related: [item('related')],
      elsewhere: [item('elsewhere', { lang: 'ar' })]
    });

    expect(html).toContain('blockView.recommendations.heading');
    expect(html).toContain('blockView.recommendations.elsewhereHeading');
    expect(html).toContain('block-recommendations__list--related');
    expect(html).toContain('block-recommendations__list--elsewhere');
    expect(html).toContain('href="/en/rooms/room-related/blocks/related"');
    expect(html).toContain('href="/en/rooms/room-elsewhere/blocks/elsewhere"');
    expect(html).toContain('lang="ar" dir="rtl"');
  });

  it('omits an empty lane while preserving the other one', () => {
    const html = render({ related: [], elsewhere: [item('elsewhere')] });

    expect(html).not.toContain('related-recommendations-heading');
    expect(html).toContain('elsewhere-recommendations-heading');
  });

  it('provides complete dual-lane copy for every supported locale', () => {
    const keys = [
      'eyebrow',
      'heading',
      'description',
      'elsewhereEyebrow',
      'elsewhereHeading',
      'elsewhereDescription',
      'roomLabel',
      'byAuthor'
    ];

    for (const lang of SUPPORTED_UI_LANGS) {
      const bundle = JSON.parse(fs.readFileSync(`i18n/${lang}/blockView.json`, 'utf8'));
      for (const key of keys) {
        expect(bundle.blockView?.recommendations?.[key])
          .withContext(`${lang} is missing blockView.recommendations.${key}`)
          .toEqual(jasmine.any(String));
        expect(bundle.blockView.recommendations[key].trim().length)
          .withContext(`${lang} has empty blockView.recommendations.${key}`)
          .toBeGreaterThan(0);
      }
    }
  });
});

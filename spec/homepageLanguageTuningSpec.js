import fs from 'node:fs';
import pug from 'pug';

import { SUPPORTED_UI_LANGS } from '../server/services/localeContext.js';

const statsPartial = 'views/partials/_home_stats.pug';

function renderStats(collaborationsToday) {
  return pug.renderFile(statsPartial, {
    globalStats: {
      totalBlocks: 264,
      totalRooms: 63,
      totalTags: 1564,
      collaborationsToday
    },
    uiPath: path => `/en${path}`,
    t: key => key
  });
}

describe('homepage language tuning', () => {
  it('uses exploration-oriented English metadata, hero copy, and feed labeling', () => {
    const bundle = JSON.parse(fs.readFileSync('i18n/en/home.json', 'utf8')).home;

    expect(bundle.meta.title).toBe('Daily Page - Explore Ideas, Stories, and Creative Work');
    expect(bundle.hero.subtitle).toBe(
      'Explore a growing collection of ideas, stories, and creative experiments.'
    );
    expect(bundle.trendingBlocks.title).toBe('Recent Writing');
  });

  it('provides the revised homepage language in every supported locale', () => {
    for (const lang of SUPPORTED_UI_LANGS) {
      const bundle = JSON.parse(fs.readFileSync(`i18n/${lang}/home.json`, 'utf8')).home;
      const values = [bundle.meta?.title, bundle.hero?.subtitle, bundle.trendingBlocks?.title];

      for (const value of values) {
        expect(value).withContext(`${lang} is missing revised homepage copy`)
          .toEqual(jasmine.any(String));
        expect(value.trim().length).withContext(`${lang} has empty revised homepage copy`)
          .toBeGreaterThan(0);
        expect(value).withContext(`${lang} still promises a 24-hour homepage`)
          .not.toContain('24');
      }
    }
  });

  it('hides the collaboration statistic when there are no collaborations today', () => {
    const html = renderStats(0);

    expect(html).toContain('global-stats--three');
    expect(html).toContain('home.stats.blocks');
    expect(html).not.toContain('home.stats.collabsToday');
  });

  it('shows the collaboration statistic when activity is present', () => {
    const html = renderStats(3);

    expect(html).toContain('global-stats--four');
    expect(html).toContain('<span class="stat-number">3</span>');
    expect(html).toContain('home.stats.collabsToday');
  });
});

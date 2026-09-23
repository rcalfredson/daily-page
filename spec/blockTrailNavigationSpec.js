import fs from 'node:fs';
import pug from 'pug';
import { normalizeReadingTrailSlug } from '../server/routes/blockView.js';
import { getTranslatorRuntime } from '../server/services/i18n.js';

const template = fs.readFileSync('views/rooms/block-view.pug', 'utf8');
const styles = fs.readFileSync('public/css/block-trail-navigation.css', 'utf8');

describe('post reading trail mode', () => {
  it('accepts canonical trail slugs and ignores malformed query values', () => {
    expect(normalizeReadingTrailSlug('  Start-Exploring-Spacetime '))
      .toBe('start-exploring-spacetime');
    expect(normalizeReadingTrailSlug('../reading-trail')).toBeNull();
    expect(normalizeReadingTrailSlug(['a-trail'])).toBeNull();
    expect(normalizeReadingTrailSlug('x'.repeat(101))).toBeNull();
  });

  it('compiles the post view with trail navigation markup', () => {
    expect(() => pug.compileFile(`${process.cwd()}/views/rooms/block-view.pug`)).not.toThrow();
    expect(template).toContain("+trailNavigation(trailContext, 'top')");
    expect(template).toContain("+trailNavigation(trailContext, 'bottom')");
  });

  it('suppresses the reading guide only when validated trail context exists', () => {
    expect(template).toContain('if editorialContext && !trailContext');
    expect(template).not.toContain('if req.query.trail');
  });

  it('provides English UI fallback when a locale namespace is absent', async () => {
    const t = await getTranslatorRuntime('xx', ['blockView']);
    expect(t('blockView.trail.position', { current: 2, total: 5 })).toBe('Reading 2 of 5');
    expect(t('blockView.trail.backToTrail')).toBe('Back to trail');
    expect(t('blockView.trail.end')).toBe('End of trail');
  });

  it('keeps navigation shrinkable through the supported 330px viewport', () => {
    expect(styles).toContain('grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr)');
    expect(styles).toContain('@media (max-width: 560px)');
    expect(styles).toContain('@media (max-width: 380px)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(styles).toContain('overflow-wrap: anywhere');
    expect(styles).toContain("html[dir='rtl'] .block-trail-navigation__arrow");
  });
});

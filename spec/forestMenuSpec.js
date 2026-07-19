import fs from 'node:fs';
import pug from 'pug';

const viewPath = 'views/dev/activity-forest.pug';
const view = fs.readFileSync(viewPath, 'utf8');
const menu = fs.readFileSync('views/partials/_activity_forest_menu.pug', 'utf8');
const styles = fs.readFileSync('public/css/activity-forest.css', 'utf8');
const script = fs.readFileSync('public/js/activity-forest.js', 'utf8');

describe('Activity Forest in-game menu', () => {
  it('compiles as a native dialog containing the player-facing forest actions', () => {
    expect(() => pug.compileFile(viewPath)).not.toThrow();

    expect(menu).toContain('dialog#activity-forest-menu');
    expect(view).toContain('include ../partials/_activity_forest_menu');
    expect(menu).toContain('data-forest-toggle-trail');
    expect(menu).toContain('data-forest-place-marker');
    expect(menu).toContain("data-forest-build='trail-sign'");
    expect(menu).toContain("data-forest-build='stone-bench'");
    expect(menu).toContain("data-forest-build='seed-pod-lantern'");
    expect(view).not.toContain('data-forest-toggle-trail');
    expect(view).not.toContain('data-forest-place-marker');
    expect(view).toContain('data-forest-reset-overlay');
    expect(view).toContain('data-forest-reset');
  });

  it('is viewport-bounded, internally scrollable, and safe-area aware on small screens', () => {
    const baseMenu = styles.match(/\.activity-forest__menu \{[\s\S]*?\n\}/)?.[0] || '';
    const mobile = styles.slice(styles.indexOf('@media (max-width: 600px)'));

    expect(baseMenu).toContain('max-height: calc(100dvh - 2rem)');
    expect(baseMenu).toContain('overflow-y: auto');
    expect(baseMenu).toContain('overscroll-behavior: contain');
    expect(mobile).toContain('max-height: 88dvh');
    expect(mobile).toContain('env(safe-area-inset-bottom)');
    expect(mobile).toContain('margin: auto 0.5rem 0.5rem');
    expect(mobile).toContain('border-width: 7px');
  });

  it('keeps active mode controls inside the playfield without enabling text selection', () => {
    const viewportStart = view.indexOf('.activity-forest__viewport(');
    const viewportEnd = view.indexOf('include ../partials/_activity_forest_menu');
    const viewport = view.slice(viewportStart, viewportEnd);

    expect(viewport).toContain('activity-forest__mode-tools');
    expect(viewport).toContain('data-forest-trail-tools');
    expect(viewport).toContain('data-forest-clearing-tools');
    expect(styles).toContain('.activity-forest__mode-tools {\n  position: absolute');
    expect(styles).toContain('-webkit-user-select: none');
    expect(styles).toContain('-webkit-touch-callout: none');
  });

  it('uses native modal open, close, focus return, and movement suspension contracts', () => {
    expect(script).toContain('forestMenu.showModal()');
    expect(script).toContain("forestMenu.addEventListener('close'");
    expect(script).toContain("forestMenuButton.setAttribute('aria-expanded', 'false')");
    expect(script).toContain('!forestMenu.open');
    expect(script).not.toContain('forestMenu.hidden');
  });
});

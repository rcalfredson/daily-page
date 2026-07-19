import fs from 'node:fs';

const blockStyles = fs.readFileSync('public/css/block-lang-switcher.css', 'utf8');
const uiStyles = fs.readFileSync('public/css/ui-lang-switcher.css', 'utf8');
const autoCloseScript = fs.readFileSync('public/js/details-autoclose.js', 'utf8');

describe('post and site language picker layering', () => {
  it('keeps the post translation menu anchored below its summary on small screens', () => {
    const baseMenu = blockStyles.match(/\.block-lang-menu \{[\s\S]*?\n\}/)?.[0] || '';
    const mobileStyles = blockStyles.slice(blockStyles.indexOf('@media (max-width: 600px)'));

    expect(baseMenu).toContain('position: absolute');
    expect(baseMenu).toContain('top: calc(100% + 0.45rem)');
    expect(mobileStyles).not.toContain('position: fixed');
    expect(mobileStyles).not.toContain('bottom:');
    expect(mobileStyles).toContain('max-width: calc(100vw - 24px)');
  });

  it('keeps the sticky header above the post picker and closes sibling pickers', () => {
    const blockRoot = blockStyles.match(/\.block-lang-switcher \{[\s\S]*?\n\}/)?.[0] || '';

    expect(uiStyles).toContain('.ui-lang-switcher {');
    expect(uiStyles).toContain('z-index: var(--z-popover)');
    expect(blockRoot).toContain('z-index: 1');
    expect(blockRoot).not.toContain('var(--z-popover)');
    expect(autoCloseScript).toContain('details.ui-lang-switcher, details.block-lang-switcher');
    expect(autoCloseScript).toContain('if (d !== except) d.removeAttribute(\'open\')');
  });
});

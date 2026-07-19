import fs from 'node:fs';

const homeStyles = fs.readFileSync('public/css/home.css', 'utf8');
const authScript = fs.readFileSync('public/js/auth.js', 'utf8');

describe('home discovery layout', () => {
  it('keeps the desktop sidebar below the measured sticky header', () => {
    const sidebarRule = homeStyles.match(/\.home-discovery__sidebar \{[\s\S]*?\n\}/)?.[0] || '';

    expect(sidebarRule).toContain('position: sticky');
    expect(sidebarRule).toContain('top: calc(var(--site-header-height, 0px) + 1rem)');
    expect(authScript).toContain("style.setProperty('--site-header-height'");
    expect(authScript).toContain('siteHeader.getBoundingClientRect().height');
  });

  it('uses the page background behind the trending tag pills', () => {
    const tagsPanelRule = homeStyles.match(/\.home-discovery__panel--tags \{[\s\S]*?\n\}/)?.[0] || '';
    const darkWidgetRule = homeStyles.match(/html\[data-theme='dark'\] \.home-discovery \.trending-tags-widget \{[\s\S]*?\n\}/)?.[0] || '';

    expect(tagsPanelRule).toContain('background: var(--primary-bg)');
    expect(darkWidgetRule).toContain('background: transparent');
    expect(darkWidgetRule).toContain('box-shadow: none');
  });
});

import fs from 'node:fs';

const homeStyles = fs.readFileSync('public/css/home.css', 'utf8');
const authScript = fs.readFileSync('public/js/auth.js', 'utf8');

describe('home discovery layout', () => {
  it('keeps the desktop sidebar below the measured sticky header', () => {
    const sidebarRule = homeStyles.match(/\.home-discovery__sidebar \{[\s\S]*?\n\}/)?.[0] || '';

    expect(sidebarRule).toContain('position: sticky');
    expect(sidebarRule).toContain('top: calc(var(--site-header-height, 0px) + 1rem)');
    expect(sidebarRule).toContain('max-height: calc(100vh - var(--site-header-height, 0px) - 2rem)');
    expect(sidebarRule).toContain('max-height: calc(100dvh - var(--site-header-height, 0px) - 2rem)');
    expect(sidebarRule).toContain('overflow-y: auto');
    expect(sidebarRule).toContain('overscroll-behavior-y: contain');
    expect(authScript).toContain("style.setProperty('--site-header-height'");
    expect(authScript).toContain('siteHeader.getBoundingClientRect().height');
  });

  it('allows translated quest headings and actions to wrap based on their content', () => {
    const headingRule = homeStyles.match(/\.home-quests-heading \{[\s\S]*?\n\}/)?.[0] || '';
    const headingCopyRule = homeStyles.match(/\.home-quests-heading > div \{[\s\S]*?\n\}/)?.[0] || '';
    const headingLinkRule = homeStyles.match(/\.home-quests-heading \.home-quests-card__link \{[\s\S]*?\n\}/)?.[0] || '';

    expect(headingRule).toContain('flex-wrap: wrap');
    expect(headingCopyRule).toContain('min-width: 0');
    expect(headingCopyRule).toContain('flex: 1 1 12rem');
    expect(headingLinkRule).toContain('overflow-wrap: anywhere');
    expect(headingLinkRule).toContain('white-space: normal');
  });

  it('uses the page background behind the trending tag pills', () => {
    const tagsPanelRule = homeStyles.match(/\.home-discovery__panel--tags \{[\s\S]*?\n\}/)?.[0] || '';
    const darkWidgetRule = homeStyles.match(/html\[data-theme='dark'\] \.home-discovery \.trending-tags-widget \{[\s\S]*?\n\}/)?.[0] || '';

    expect(tagsPanelRule).toContain('background: var(--primary-bg)');
    expect(darkWidgetRule).toContain('background: transparent');
    expect(darkWidgetRule).toContain('box-shadow: none');
  });
});

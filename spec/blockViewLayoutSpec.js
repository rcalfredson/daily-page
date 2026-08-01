import fs from 'node:fs';

const blockStyles = fs.readFileSync('public/css/block-view.css', 'utf8');

const ruleFor = (selector) => (
  blockStyles.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{[\\s\\S]*?\\n\\}`))?.[0] || ''
);

describe('post view header layout', () => {
  it('reserves balanced space for metadata while allowing translated actions to wrap', () => {
    const controlsRule = ruleFor('.interact-section');
    const actionsRule = ruleFor('.action-buttons');
    const actionItemsRule = ruleFor('.action-buttons > *');

    expect(controlsRule).toContain('flex: 1 1 34rem');
    expect(controlsRule).toContain('max-width: 50rem');
    expect(controlsRule).toContain('min-width: 0');
    expect(actionsRule).toContain('flex-wrap: wrap');
    expect(actionsRule).toContain('width: 100%');
    expect(actionItemsRule).toContain('flex: 0 1 auto');
    expect(actionItemsRule).toContain('min-width: 0');
    expect(blockStyles).not.toContain('min-width: max-content');
  });

  it('gives the title and metadata column a usable desktop floor', () => {
    const desktopStart = blockStyles.indexOf('@media (min-width: 1100px)');
    const desktopEnd = blockStyles.indexOf('.interact-section.left-align', desktopStart);
    const desktopStyles = blockStyles.slice(desktopStart, desktopEnd);

    expect(desktopStyles).toContain('flex-basis: 36rem');
    expect(desktopStyles).toContain('min-width: min(100%, 34rem)');
    expect(desktopStyles).not.toContain('flex-basis: 0');
  });

  it('permits individual translated labels to break as a final overflow safeguard', () => {
    const translatedActionsStart = blockStyles.indexOf('.interact-section a.block-edit-btn');
    const translatedActionsEnd = blockStyles.indexOf('\n\n.block-edit-btn,', translatedActionsStart);
    const translatedActionsRule = blockStyles.slice(translatedActionsStart, translatedActionsEnd);

    expect(translatedActionsRule).toContain('.interact-section #flag-block-btn');
    expect(translatedActionsRule).toContain('overflow-wrap: anywhere');
    expect(translatedActionsRule).toContain('white-space: normal');
  });
});

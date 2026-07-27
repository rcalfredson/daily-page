import fs from 'node:fs';

const tagStyles = fs.readFileSync('public/css/tags.css', 'utf8');

describe('tag detail layout', () => {
  it('allows translated timeframe labels to wrap throughout the compact layout', () => {
    const compactStart = tagStyles.indexOf('@media (max-width: 800px)');
    const compactEnd = tagStyles.indexOf('.tag-range-option:hover', compactStart);
    const compactStyles = tagStyles.slice(compactStart, compactEnd);

    expect(compactStyles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(compactStyles).toContain('overflow-wrap: anywhere');
    expect(compactStyles).toContain('white-space: normal');
  });
});

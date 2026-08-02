import {
  buildForestOwnerGrovePlacementPreviewSvg,
} from '../scripts/dev/renderForestOwnerGrovePlacementPreview.js';

describe('forest owner grove placement preview', () => {
  it('renders a deterministic, escaped, script-free SVG diagnostic', () => {
    const options = {
      seeds: ['preview-<seed>&'],
      counts: [5],
    };
    const first = buildForestOwnerGrovePlacementPreviewSvg(options);
    const second = buildForestOwnerGrovePlacementPreviewSvg(options);

    expect(second).toBe(first);
    expect(first).toContain('<svg');
    expect(first).toContain('5 writing trees');
    expect(first).toContain('preview-&lt;seed&gt;&amp;');
    expect(first).toContain('reserved central clearing');
    expect(first).not.toContain('<script');
  });
});

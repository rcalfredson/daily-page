import {
  buildForestOwnerEnvironmentPreviewSvg,
} from '../scripts/dev/renderForestOwnerEnvironmentPreview.js';

describe('forest owner environment preview', () => {
  it('renders deterministic signed habitat and accepted-tree evidence', () => {
    const options = { seeds: ['environment-preview-spec'] };
    const first = buildForestOwnerEnvironmentPreviewSvg(options);
    const second = buildForestOwnerEnvironmentPreviewSvg(options);

    expect(second).toBe(first);
    expect(first).toContain('Owner ground presentation v2');
    expect(first).toContain('environment-preview-spec');
    expect(first).toContain('600 trees');
    expect(first).toContain('habitat exclusions');
    expect(first).not.toContain('NaN');
    expect((first.match(/<circle /gu) || []).length).toBeGreaterThan(600);
  });
});

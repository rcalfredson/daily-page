import { forestWritingLinksEnabled } from '../server/services/forestWritingLinkAvailability.js';
import { ownerForestMarkerPreview } from '../public/js/owner-forest-scene.js';

describe('writing-marker creation availability and preview', () => {
  it('requires explicit true and defaults off for unset or malformed flags', () => {
    expect(forestWritingLinksEnabled({})).toBeFalse();
    for (const value of [undefined, '', 'false', '1', 'TRUE', true]) {
      expect(forestWritingLinksEnabled({ FOREST_WRITING_LINKS_ENABLED: value })).toBeFalse();
    }
    expect(forestWritingLinksEnabled({ FOREST_WRITING_LINKS_ENABLED: 'true' })).toBeTrue();
  });
  it('previews the exact initial range while allowing ordinary and moved markers beyond it', () => {
    const input = { player: { worldX: -600, worldY: 720 }, facingRadians: 0,
      placements: [], markers: [], cellSize: 720, writingOrigin: { worldX: -720, worldY: 720 } };
    expect(ownerForestMarkerPreview(input).valid).toBeTrue(); // Exactly 160 from selected tree.
    expect(ownerForestMarkerPreview({ ...input, player: { worldX: -599, worldY: 720 } }).reason)
      .toBe('writing-distance');
    expect(ownerForestMarkerPreview({ ...input, player: { worldX: 5000, worldY: 720 }, writingOrigin: null }).valid).toBeTrue();
  });
});

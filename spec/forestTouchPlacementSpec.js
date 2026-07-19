import fs from 'node:fs';

const script = fs.readFileSync('public/js/activity-forest.js', 'utf8');

describe('Activity Forest touch placement gestures', () => {
  it('commits mouse placement directly but defers touch placement until gesture release', () => {
    expect(script).toContain("event.pointerType === 'mouse' && clearingEditor.active");
    expect(script).toContain("event.pointerType === 'mouse' && trailEditor.active");
    expect(script).toContain("addEventListener('pointerup', finishTouchMovement)");
    expect(script).not.toContain("addEventListener('pointerup', stopTouchMovement)");
  });

  it('classifies maximum displacement before allowing a touch tap to commit', () => {
    expect(script).toContain('touch.maximumDistance = Math.max');
    expect(script).toContain('const intent = forestTouchGestureIntent');
    expect(script).toContain("if (intent !== 'tap') return");
    expect(script).toContain('if (clearingEditor.active)');
    expect(script).toContain('commitClearingPlacement()');
  });

  it('drops any touch-carried object at its preview instead of teleporting it to the tap', () => {
    expect(script).not.toContain('previewClearingAt(worldX, worldY, false)');
    expect(script).toContain("event.pointerType === 'mouse' && clearingEditor.active");
    expect(script).toContain("? 'Drop here' : 'Place here'");
    expect(script).toContain('item.object.id !== clearingEditor.movingId');
  });
});

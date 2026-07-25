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

  it('drops a touch-carried trail stone at its preview instead of at the deposit tap', () => {
    const touchRelease = script.match(/function finishTouchMovement[^\0]*?function reportPickup/)[0];
    expect(touchRelease).toContain("if (trailEditor.tool === 'remove') commitTrailAt(worldX, worldY)");
    expect(touchRelease).toContain('else commitTrailPlacementAtPreview()');
    expect(touchRelease).not.toContain('else commitTrailAt(worldX, worldY)');
  });

  it('lets the visible trail Place control commit at the player-carried preview', () => {
    const placeHandlerStart = script.indexOf(
      "document.querySelector('[data-forest-trail-place]').addEventListener"
    );
    const placeHandlerEnd = script.indexOf(
      "document.querySelector('[data-forest-trail-move]').addEventListener",
      placeHandlerStart
    );
    expect(placeHandlerStart).toBeGreaterThan(-1);
    expect(placeHandlerEnd).toBeGreaterThan(placeHandlerStart);
    const placeHandler = script.slice(placeHandlerStart, placeHandlerEnd);
    expect(placeHandler).toContain("if (trailEditor.tool !== 'place') setTrailTool('place')");
    expect(placeHandler).toContain('previewTrailAt(player.worldX, player.worldY, false)');
    expect(placeHandler).toContain('commitTrailPlacementAtPreview()');
  });

  it('shows an explicit carried preview while moving a trail stone', () => {
    expect(script).toContain('item.object.id !== trailEditor.movingId');
    expect(script).toContain(
      "object.id === trailEditor.movingId ? trailEditor.preview.stone : object"
    );
    expect(script).toContain("} else if (tool === 'move') {");
    expect(script).toContain('previewTrailAt(player.worldX, player.worldY, false)');
  });

  it('uses input-neutral move instructions and a working Move here control', () => {
    expect(script).toContain(
      'Valid preview. Tap or click the forest, choose ${action}, or press Enter to save.'
    );
    expect(script).toContain("? 'Move here'");
    expect(script).toContain("if (trailEditor.tool === 'move' && trailEditor.movingId)");
  });

  it('keeps the last visible mouse preview while the pointer crosses a HUD button', () => {
    expect(script).toContain("event.pointerType === 'mouse' && clearingEditor.active\n"
      + "      && !event.target.closest('button')");
    expect(script).toContain("event.pointerType === 'mouse' && trailEditor.active\n"
      + "      && !event.target.closest('button')");
  });

  it('treats Move nearest as one-shot and restores a carried placement preview', () => {
    const saveStart = script.indexOf('function saveTrailResult');
    const saveEnd = script.indexOf('function commitTrailAt', saveStart);
    const saveHandler = script.slice(saveStart, saveEnd);
    expect(saveHandler).toContain("if (action === 'moved')");
    expect(saveHandler).toContain("setTrailTool('place')");
    expect(saveHandler).toContain('previewTrailAt(player.worldX, player.worldY, false)');
    expect(saveHandler).toContain(
      'Stone moved. Place mode restored; walk to a valid position for the next stone.'
    );
  });

  it('paints the carried trail preview on the ground before the avatar depth pass', () => {
    const previewPaint = script.indexOf('paintSteppingStone(trailEditor.preview.stone, true)');
    const depthPaint = script.indexOf('for (const item of depthOrder)', previewPaint);
    expect(previewPaint).toBeGreaterThan(-1);
    expect(depthPaint).toBeGreaterThan(previewPaint);
  });
});

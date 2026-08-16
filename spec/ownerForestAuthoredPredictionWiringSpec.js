import fs from 'node:fs';

const script = fs.readFileSync('public/js/owner-forest.js', 'utf8');

function functionBody(start, end) {
  const startIndex = script.indexOf(start);
  const endIndex = script.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return script.slice(startIndex, endIndex);
}

describe('owner forest authored prediction wiring', () => {
  it('projects placement before starting background synchronization', () => {
    const body = functionBody('function savePlacement()', 'function removeInspectedMarker()');

    expect(body.indexOf('stopPlacement({ restoreFocus: false, force: true })'))
      .toBeLessThan(body.indexOf('queuePendingMutation(pending)'));
    expect(body).not.toContain('await authoredMutation');
  });

  it('projects removal immediately and lets synchronization finish independently', () => {
    const body = functionBody(
      'function removeInspectedMarker()', 'function firstFailedPendingMutation()'
    );

    expect(body.indexOf('closeMarkerInspection({ restoreFocus: false, force: true })'))
      .toBeLessThan(body.indexOf('queuePendingMutation(pending)'));
    expect(body).not.toContain('await authoredMutation');
  });

  it('reapplies pending state after an authoritative region refresh', () => {
    const body = functionBody(
      'async function loadNearbyAuthoredCells', 'async function loadNearbyCells'
    );

    expect(body.indexOf('replaceOwnerForestAuthoredRegion'))
      .toBeLessThan(body.indexOf('projectForestAuthoredPendingMarkers'));
  });

  it('offers bounded uncertain-state recovery without browser persistence', () => {
    expect(script).toContain('runForestAuthoredMutationWithRetry');
    expect(script).toContain("pending.phase = 'failed'");
    expect(script).toContain('syncRetry.addEventListener');
    expect(script).toContain('syncRevert.addEventListener');
    expect(script).not.toContain('localStorage');
    expect(script).not.toContain('sessionStorage');
  });
});

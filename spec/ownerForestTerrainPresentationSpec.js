import { buildOwnerTerrainWaterPresentation, ownerForestBoulderPresentation,
  paintOwnerTerrainWater, paintOwnerLakeSurface } from '../public/js/owner-forest-terrain-presentation.js';
import { queryRegionalTerrain } from '../public/js/owner-forest-terrain-regional.js';
import { queryTerrainProof, terrainProofWaterDistance } from '../public/js/owner-forest-terrain.js';

function water() {
  return queryTerrainProof({ seed: 'terrain-proof-a', bounds: {
    minX: 0, maxX: 1919, minY: 0, maxY: 1919
  } }).districts.find(d => d.stream).stream;
}
function recorder() {
  const calls = [];
  const context = { calls, globalAlpha: 1 };
  for (const method of ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'closePath',
    'fill', 'stroke', 'clip', 'fillRect', 'translate', 'rotate']) {
    context[method] = (...args) => {
      if (args.some(n => typeof n === 'number' && !Number.isFinite(n))) throw new Error('Nonfinite drawing coordinate');
      calls.push([method, ...args]);
    };
  }
  return context;
}

describe('owner terrain presentation parity', () => {
  it('animates lake ripples in place, freezes reduced motion, and leaves geometry unchanged', () => {
    const stream = queryRegionalTerrain({ seed: 'lake-motion', bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } }).features[0].stream;
    const before = JSON.stringify(stream), model = buildOwnerTerrainWaterPresentation(stream);
    const camera = { x: stream.outlet.x - 300, y: stream.outlet.y - 250, width: 600, height: 500 };
    const first = recorder(), later = recorder(), frozen = recorder(), frozenLater = recorder();
    paintOwnerLakeSurface(first, model, camera, 0, false);
    paintOwnerLakeSurface(later, model, camera, 1800, false);
    paintOwnerLakeSurface(frozen, model, camera, 0, true);
    paintOwnerLakeSurface(frozenLater, model, camera, 1800, true);
    expect(first.calls).not.toEqual(later.calls);
    expect(frozen.calls).toEqual(frozenLater.calls);
    const marks = ctx => ctx.calls.filter(c => c[0] === 'fillRect');
    expect(marks(first).length).toBeGreaterThan(0);
    expect(marks(first).length).toBeLessThan(300);
    expect(marks(first).map(c => c[2])).toEqual(marks(later).map(c => c[2]));
    expect(model.bands).toEqual([]);
    expect(JSON.stringify(stream)).toBe(before);
  });
  it('uses detailed bank models inside the reserved margin without changing water or collision geometry', () => {
    const stream = water();
    const before = JSON.stringify(stream);
    const model = buildOwnerTerrainWaterPresentation(stream);
    expect(model.banks.length).toBe(5);
    expect(model.banks.flatMap(b => b.details).some(d => d.role === 'grass')).toBeTrue();
    expect(model.banks.flatMap(b => b.details).some(d => d.role === 'root')).toBeTrue();
    for (const p of model.banks.flatMap(b => b.surfaces.flatMap(s => s.points))) {
      const distance = terrainProofWaterDistance({ x: p.x, y: p.y - p.z }, stream);
      // Junction faces inside another water body are hidden by the water union.
      expect(distance).toBeLessThanOrEqual(stream.bankMargin + 0.01);
    }
    const ctx = recorder();
    paintOwnerTerrainWater(ctx, model, { x: 0, y: 0, width: 1920, height: 1920 }, 1500, false);
    expect(JSON.stringify(stream)).toBe(before);
    expect(ctx.calls.some(c => c[0] === 'clip')).toBeTrue();
  });

  it('keeps water details static under reduced motion while regular flow advances', () => {
    const model = buildOwnerTerrainWaterPresentation(water());
    const camera = { x: 0, y: 0, width: 1920, height: 1920 };
    const first = recorder(); const later = recorder();
    paintOwnerTerrainWater(first, model, camera, 0, true);
    paintOwnerTerrainWater(later, model, camera, 2400, true);
    expect(first.calls).toEqual(later.calls);
    const moving = recorder();
    paintOwnerTerrainWater(moving, model, camera, 2400, false);
    expect(moving.calls).not.toEqual(first.calls);
  });

  it('assigns the established rock variants and palettes without changing anchors or collision radii', () => {
    const rocks = [18, 24, 29].map((radius, i) => ({ id: `rock-${i}`, x: -320, y: 120, radius }));
    const before = JSON.stringify(rocks);
    const painted = rocks.map(ownerForestBoulderPresentation);
    expect(painted.map(p => p.variantId)).toEqual(['low', 'shouldered', 'mossy-outcrop']);
    expect(painted.every(p => p.worldX === -320 && p.worldY === 120)).toBeTrue();
    expect(JSON.stringify(rocks)).toBe(before);
  });
});

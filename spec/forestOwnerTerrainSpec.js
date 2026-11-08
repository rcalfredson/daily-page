import { terrainProofWaterDistance, terrainProofMovementAllowed, queryTerrainProof, sampleTerrainProof, buildTerrainProofProtections,
  OWNER_TERRAIN_PROOF_CONFIG as C } from '../public/js/owner-forest-terrain.js';
import { terrainProofRecords } from '../scripts/dev/renderForestOwnerTerrainPreview.js';

const bounds = { minX: -2880, minY: -2880, maxX: 2880, maxY: 2880 };
function build(seed = 'terrain-proof-a', records = []) {
  return queryTerrainProof({ seed, bounds, records });
}

describe('owner terrain geometry proof', () => {
  it('reproduces complete features across overlapping queries and record order', () => {
    const records = terrainProofRecords('spread');
    const full = build('overlap-seed', records);
    const partial = queryTerrainProof({ seed: 'overlap-seed', records: [...records].reverse(),
      bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 } });
    for (const area of partial.districts) {
      expect(area).toEqual(full.districts.find(d => d.id === area.id));
    }
    expect(JSON.parse(JSON.stringify(full))).toEqual(full);
    expect(build('different-seed', records).districts).not.toEqual(full.districts);
  });

  it('keeps protected footprints and their routes to the connected boundary lanes walkable', () => {
    for (const kind of ['compact', 'dense', 'spread']) {
      for (const seed of ['terrain-proof-a', 'terrain-proof-b', 'terrain-proof-c']) {
        const scene = build(seed, terrainProofRecords(kind));
        for (const p of scene.protections) {
          for (let step = 0; step <= 100; step += 1) {
            const t = step / 100;
            expect(sampleTerrainProof(scene, { x: p.x + (p.accessEnd.x - p.x) * t,
              y: p.y + (p.accessEnd.y - p.y) * t }).walkable).toBeTrue();
          }
          for (let angle = 0; angle < 360; angle += 20) {
            const radians = angle * Math.PI / 180;
            expect(sampleTerrainProof(scene, { x: p.x + Math.cos(radians) * (p.radius - 12),
              y: p.y + Math.sin(radians) * (p.radius - 12) }).walkable).toBeTrue();
          }
        }
        for (const x of [-1920, 0, 1920]) {
          for (let y = -2800; y <= 2800; y += 24) {
            expect(sampleTerrainProof(scene, { x, y }).walkable).toBeTrue();
            expect(sampleTerrainProof(scene, { x: y, y: x }).walkable).toBeTrue();
          }
        }
      }
    }
  });

  it('pairs every stream with a walkable crossing and clear approaches, rejecting placement there', () => {
    const scene = build('bridge-evidence');
    expect(scene.districts.filter(d => d.stream).length).toBeGreaterThan(0);
    for (const area of scene.districts.filter(d => d.stream)) {
      const b = area.bridge;
      for (let step = -120; step <= 120; step += 2) {
        const p = { x: b.x + b.ux * step, y: b.y + b.uy * step };
        expect(sampleTerrainProof(scene, p).walkable).toBeTrue();
        expect(sampleTerrainProof(scene, p).placeable).toBeFalse();
      }
      const waterPoint = area.stream.points[2];
      expect(sampleTerrainProof(scene, waterPoint).walkable).toBeFalse();
      expect(sampleTerrainProof(scene, waterPoint).placeable).toBeFalse();
    }
  });

  it('rejects movement across water even when both endpoints are dry', () => {
    const scene = build('movement-evidence');
    const area = scene.districts.find(d => d.stream);
    const p = area.stream.points[2];
    const tangent = { x: area.stream.points[3].x - area.stream.points[1].x,
      y: area.stream.points[3].y - area.stream.points[1].y };
    const length = Math.hypot(tangent.x, tangent.y);
    const normal = { x: tangent.y / length, y: -tangent.x / length };
    const start = { x: p.x - normal.x * 80, y: p.y - normal.y * 80 };
    const end = { x: p.x + normal.x * 80, y: p.y + normal.y * 80 };
    expect(sampleTerrainProof(scene, start).walkable).toBeTrue();
    expect(sampleTerrainProof(scene, end).walkable).toBeTrue();
    expect(terrainProofMovementAllowed(scene, start, end)).toBeFalse();
    const b = area.bridge;
    expect(terrainProofMovementAllowed(scene,
      { x: b.x - b.ux * 120, y: b.y - b.uy * 120 },
      { x: b.x + b.ux * 120, y: b.y + b.uy * 120 })).toBeTrue();
    expect(() => terrainProofMovementAllowed(scene, start, { x: start.x + 1000, y: start.y })).toThrow();
  });

  it('retains nearby streams in compact and spread forests, rather than making a global dry disk', () => {
    for (const kind of ['compact', 'spread']) {
      const scene = build('terrain-proof-a', terrainProofRecords(kind));
      const streams = scene.districts.filter(d => d.stream).map(d => d.stream);
      expect(streams.length).toBeGreaterThan(5);
      expect(Math.min(...streams.flatMap(stream => stream.points.map(p =>
        Math.hypot(p.x, p.y))))).toBeLessThan(1800);
    }
  });

  it('joins tapered headwaters to the main channel and a receiving pond with consistent water collision', () => {
    for (const seed of ['water-links-a', 'water-links-b', 'water-links-c']) {
      const scene = build(seed);
      const areas = scene.districts.filter(d => d.stream);
      expect(areas.length).toBeGreaterThan(0);
      for (const area of areas) {
        const stream = area.stream;
        const bridge = area.bridge;
        expect(terrainProofMovementAllowed(scene,
          { x: bridge.x - bridge.ux * 120, y: bridge.y - bridge.uy * 120 },
          { x: bridge.x + bridge.ux * 120, y: bridge.y + bridge.uy * 120 })).toBeTrue();
        const main = stream.channels[0];
        expect(main.radii[0]).toBeLessThan(main.radii[8]);
        expect(stream.source.kind).toBe('spring');
        expect(stream.outlet.kind).toBe('pond');
        for (const feeder of stream.channels.slice(1)) {
          expect(feeder.points.at(-1)).toEqual(main.points[feeder.junctionIndex]);
          expect(terrainProofWaterDistance(feeder.points[1], stream)).toBeLessThan(0);
        }
        for (const p of [stream.source, stream.outlet, main.points.at(-1)]) {
          expect(terrainProofWaterDistance(p, stream)).toBeLessThanOrEqual(0);
          expect(sampleTerrainProof(scene, p).walkable).toBeFalse();
          expect(sampleTerrainProof(scene, p).placeable).toBeFalse();
        }
        // The last centerline segment enters the pond with no intervening land gap.
        for (let t = 0; t <= 1; t += 0.1) {
          const end = main.points.at(-1);
          const p = { x: end.x + (stream.outlet.x - end.x) * t,
            y: end.y + (stream.outlet.y - end.y) * t };
          expect(terrainProofWaterDistance(p, stream)).toBeLessThanOrEqual(0);
        }
        const left = area.column * C.districtSize;
        const top = area.row * C.districtSize;
        for (const polygon of stream.waterPolygons) {
          for (const p of polygon) {
            expect(p.x).toBeGreaterThan(left + C.dryBoundaryHalfWidth + C.bankMargin);
            expect(p.x).toBeLessThan(left + C.districtSize - C.dryBoundaryHalfWidth - C.bankMargin);
            expect(p.y).toBeGreaterThan(top + C.dryBoundaryHalfWidth + C.bankMargin);
            expect(p.y).toBeLessThan(top + C.districtSize - C.dryBoundaryHalfWidth - C.bankMargin);
          }
        }
      }
    }
  });

  it('retains substantially different channel lengths and pond sizes among accepted systems', () => {
    const systems = ['terrain-proof-a', 'terrain-proof-b', 'water-variation-c'].flatMap(seed =>
      build(seed, terrainProofRecords('spread')).districts.filter(d => d.stream).map(d => d.stream));
    const lengths = systems.map(s => s.points.slice(1).reduce((total, p, i) =>
      total + Math.hypot(p.x - s.points[i].x, p.y - s.points[i].y), 0));
    const sizes = systems.map(s => s.outlet.radiusX * s.outlet.radiusY);
    expect(Math.min(...lengths)).toBeLessThan(650);
    expect(Math.max(...lengths)).toBeGreaterThan(1200);
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThan(10);
    // Size selection is independent: the longest stream need not have the largest pond.
    expect(sizes[lengths.indexOf(Math.max(...lengths))]).toBeLessThan(Math.max(...sizes));
  });

  it('omits conflicts under dense protection and fails closed on incomplete or excessive inputs', () => {
    const crowded = Array.from({ length: 256 }, (_, i) => ({ id: `p${i}`,
      x: 60 + (i % 16) * 120, y: 60 + Math.floor(i / 16) * 120, radius: 120 }));
    const scene = build('crowded', crowded);
    const area = scene.districts.find(d => d.column === 0 && d.row === 0);
    expect(area.stream).toBeNull();
    expect(area.bridge).toBeNull();
    expect(area.boulders).toEqual([]);
    expect(() => sampleTerrainProof(scene, { x: 10000, y: 10000 })).toThrow();
    expect(() => buildTerrainProofProtections(Array(C.maximumProtections + 1).fill({}))).toThrow();
    expect(() => buildTerrainProofProtections([{ id: 'bad', x: NaN, y: 0, radius: 50 }])).toThrow();
    expect(() => queryTerrainProof({ seed: 'x', bounds: { ...bounds, maxX: 100000 } })).toThrow();
  });
});

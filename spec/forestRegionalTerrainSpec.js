import { queryRegionalTerrain, sampleRegionalTerrain, regionalMovementAllowed, regionalQueryPlan }
  from '../public/js/owner-forest-terrain-regional.js';
import { queryOwnerTerrain } from '../public/js/owner-forest-terrain-authority.js';
import { queryTerrainProof, terrainProofWaterDistance } from '../public/js/owner-forest-terrain.js';
import { createOwnerForestTerrainScene } from '../public/js/owner-forest-terrain-scene.js';
import { validateRegionalFeature } from '../public/js/owner-forest-terrain-regional-scene.js';
import { buildForestOwnerTerrainService, forestTerrainReturnPredicate, inspectForestTerrainPlacement }
  from '../server/services/forestOwnerTerrain.js';
import { buildForestOwnerTerrainRegionService, forestTerrainDescriptor } from '../server/services/forestOwnerTerrainRegion.js';
import { terrainProofRecords } from '../scripts/dev/renderForestOwnerTerrainPreview.js';
import { ownerTerrainAccessBounds, validateOwnerTerrainAccess } from '../public/js/owner-forest-terrain-access.js';

const records = [{ id: 'entrance', x: 0, y: 0, radius: 80 },
  { id: 'tree:private', x: -320, y: 330, radius: 47 }, { id: 'marker:private', x: 220, y: 100, radius: 45 }];
const pointBounds = p => ({ minX: p.x, maxX: p.x, minY: p.y, maxY: p.y });
const seed = 'terrain_fixture_seed_0123456789abcdef';
const build = (bounds = pointBounds({ x: 0, y: 0 }), extra = {}) => queryRegionalTerrain({ seed, records, bounds, ...extra });
const world = { schemaVersion: 1, worldRole: 'primary', placementPolicyVersion: 1, environmentPolicyVersion: 1,
  environmentSchemaVersion: 1, worldGenerationVersion: 1, ownerUserId: '507f1f77bcf86cd799439011',
  forestId: '11111111-1111-4111-8111-111111111111', status: 'active', worldSeed: seed,
  terrain: { schemaVersion: 1, generationVersion: 4, activationId: '22222222-2222-4222-8222-222222222222',
    revision: 1, state: 'active', phase: 'ready', cursor: null } };
function regionReader() {
  return buildForestOwnerTerrainRegionService({ WorldModel: { findOne: () => ({ lean: async () => world }), exists: async () => true },
    DeletionModel: { exists: () => ({ lean: async () => null }) },
    readTerrain: async ({ bounds }) => build(bounds) });
}
function fetcher(read = regionReader()) {
  return async url => {
    const params = new URL(url, 'https://example.test').searchParams;
    return JSON.parse(JSON.stringify(await read({ ownerUserId: world.ownerUserId, token: params.get('token'),
      districts: params.get('districts').split(',').map(s => { const [cellX, cellY] = s.split(':').map(Number); return { cellX, cellY }; }) })));
  };
}
describe('generation 4 regional river and lake authority', () => {
  it('preserves generation 3 exactly and rejects unsupported dispatch', () => {
    const bounds = { minX: -1920, maxX: 1920, minY: -1920, maxY: 1920 };
    expect(queryOwnerTerrain({ seed, bounds, records, generationVersion: 3 })).toEqual(queryTerrainProof({ seed, bounds, records }));
    expect(() => queryOwnerTerrain({ seed, bounds, generationVersion: 99 })).toThrow();
  });
  it('reproduces complete shared water across signed small-cell boundaries, request order, and transport', () => {
    const first = build(pointBounds({ x: -1, y: -1 }));
    const second = build(pointBounds({ x: 1921, y: 1 }), { records: [...records].reverse() });
    expect(first.features).toEqual(second.features);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first.features[0].stream.points.length).toBe(161);
    expect(() => validateRegionalFeature(first.features[0])).not.toThrow();
    expect(() => sampleRegionalTerrain(first, { x: 5000, y: 0 })).toThrow();
  });
  it('varies coherent formation families, river lengths, channel widths, tributaries, and lake aspects', () => {
    const features = Array.from({ length: 15 }, (_, i) => build(undefined, { seed: `regional-variety-${i}` }).features[0]).filter(f => f.stream);
    expect(features.length).toBeGreaterThan(12);
    expect(new Set(features.map(f => f.family)).size).toBe(3);
    const spans = features.map(f => { const p = f.stream.points; return Math.hypot(p.at(-1).x - p[0].x, p.at(-1).y - p[0].y); });
    expect(Math.min(...spans)).toBeGreaterThan(9500);
    expect(Math.max(...spans) - Math.min(...spans)).toBeGreaterThan(800);
    expect(new Set(features.map(f => Math.round(f.stream.channels[0].radii[90]))).size).toBeGreaterThan(5);
    expect(new Set(features.map(f => f.stream.channels[1].points[0].x)).size).toBeGreaterThan(10);
    for (const f of features) expect(() => validateRegionalFeature(f)).not.toThrow();
  });
  it('keeps compact protected places and their chosen dry approaches without suppressing the nearby landscape', () => {
    const local = build(), feature = local.features[0];
    expect(feature.stream).not.toBeNull();
    expect(Math.min(...feature.stream.points.map(p => Math.hypot(p.x, p.y)))).toBeLessThan(2000);
    for (const p of local.protections) {
      const bounds = { minX: Math.min(p.x, p.accessEnd.x) - 96, maxX: Math.max(p.x, p.accessEnd.x) + 96,
        minY: Math.min(p.y, p.accessEnd.y) - 96, maxY: Math.max(p.y, p.accessEnd.y) + 96 };
      const scene = build(bounds);
      expect(scene.features.find(f => f.id === feature.id)).toEqual(feature);
      for (let i = 0; i <= 80; i++) expect(sampleRegionalTerrain(scene, {
        x: p.x + (p.accessEnd.x - p.x) * i / 80, y: p.y + (p.accessEnd.y - p.y) * i / 80 }, 11).walkable).toBeTrue();
    }
  });
  it('agrees on crossing decks, both approaches, water exclusion, and swept movement', () => {
    const feature = build().features[0];
    for (const b of feature.bridges) {
      const scene = build({ minX: b.x - 250, maxX: b.x + 250, minY: b.y - 250, maxY: b.y + 250 });
      for (let step = -b.approachHalfLength; step <= b.approachHalfLength; step += 2) {
        const p = { x: b.x + b.ux * step, y: b.y + b.uy * step };
        expect(sampleRegionalTerrain(scene, p, 11).walkable).toBeTrue();
        expect(sampleRegionalTerrain(scene, p, 11).placeable).toBeFalse();
      }
      expect(regionalMovementAllowed(scene, { x: b.x - b.ux * b.approachHalfLength, y: b.y - b.uy * b.approachHalfLength },
        { x: b.x, y: b.y }, 11)).toBeTrue();
    }
    const end = feature.stream.points.at(-1);
    expect(terrainProofWaterDistance(end, { waterPolygons: [feature.stream.outlet.outline] })).toBeLessThan(0);
    const scene = build(pointBounds(end));
    expect(sampleRegionalTerrain(scene, end).walkable).toBeFalse();
    expect(sampleRegionalTerrain(scene, end).placeable).toBeFalse();
    expect(() => regionalMovementAllowed(scene, end, { x: end.x + 500, y: end.y })).toThrow();
    expect(() => regionalQueryPlan({ minX: 0, maxX: 100000, minY: 0, maxY: 100000 })).toThrow();
  });
  it('bounds work and rejects excessive or invalid frozen inputs', () => {
    expect(() => build(undefined, { records: Array(513).fill(records[0]) })).toThrow();
    expect(() => build(undefined, { seed: 'x'.repeat(80) })).not.toThrow();
    expect(() => build(undefined, { records: [{ ...records[0], x: NaN }] })).toThrow();
  });
  it('loads rounded verification vertices across a signed cell boundary for later marker placements', () => {
    const later = [...records, { id: 'marker:after-activation', x: -100, y: -100, radius: 45 }];
    const local = build(pointBounds({ x: -100, y: -100 }), { records: later });
    const p = local.protections.find(p => p.id === 'marker:after-activation');
    const bounds = ownerTerrainAccessBounds(p);
    const scene = build(bounds, { records: later });
    expect(bounds.maxY % 8).toBe(0);
    expect(validateOwnerTerrainAccess(scene, p)).toBeTrue();
  });
  it('retains immutable decisions for compact, dense, and widely spread frozen places across region requests', () => {
    let accepted = 0;
    for (const kind of ['compact', 'dense', 'spread']) for (const seed of ['terrain-proof-a', 'terrain-proof-b', 'terrain-proof-c']) {
      const records = terrainProofRecords(kind);
      const first = build(undefined, { seed, records });
      const expanded = build({ minX: -8000, maxX: -7400, minY: -100, maxY: 100 }, { seed, records: [...records].reverse() });
      expect(expanded.features.find(f => f.id === first.features[0].id)).toEqual(first.features[0]);
      if (first.features[0].stream) {
        accepted++;
        for (const p of first.protections) expect(terrainProofWaterDistance(p, first.features[0].stream)).toBeGreaterThan(p.radius + 39);
      }
    }
    expect(accepted).toBeGreaterThanOrEqual(7);
  });
});
describe('generation 4 private transport and live scene', () => {
  it('deduplicates complete systems at a four-region corner within the existing private payload bound', async () => {
    const districts = Array.from({ length: 9 }, (_, i) => ({ cellX: 3 + i % 3, cellY: 3 + Math.floor(i / 3) }));
    const response = await regionReader()({ ownerUserId: world.ownerUserId, districts, token: forestTerrainDescriptor(world).token });
    expect(response.features.length).toBe(4);
    expect(Buffer.byteLength(JSON.stringify(response))).toBeLessThan(256000);
    expect(JSON.stringify(response)).not.toContain('tree:private');
    expect(JSON.stringify(response)).not.toContain('marker:private');
    expect(JSON.stringify(response)).not.toContain(seed);
  });
  it('reads complete region protections before deciding geometry, with bounded owner-scoped queries', async () => {
    let filter;
    const read = buildForestOwnerTerrainService({ ProtectionModel: { find: input => {
      filter = input; const q = { sort: () => q, limit: () => q, lean: async () => [] }; return q;
    } } });
    const scene = await read({ ownerUserId: world.ownerUserId, world, bounds: pointBounds({ x: 1, y: 1 }) });
    expect(scene.generationVersion).toBe(4);
    expect(filter).toEqual(jasmine.objectContaining({ ownerUserId: world.ownerUserId, forestId: world.forestId,
      activationId: world.terrain.activationId, districtX: { $gte: -5, $lte: 4 }, districtY: { $gte: -5, $lte: 4 } }));
  });
  it('uses the same lake exclusion for authoritative placement and safe return candidates', async () => {
    const outlet = build().features[0].stream.outlet;
    const readTerrain = async ({ bounds }) => build(bounds);
    expect(await inspectForestTerrainPlacement({ ownerUserId: world.ownerUserId, world,
      worldX: outlet.x, worldY: outlet.y, readTerrain })).toBeFalse();
    const predicate = await forestTerrainReturnPredicate({ ownerUserId: world.ownerUserId, world,
      position: { worldX: outlet.x, worldY: outlet.y }, readTerrain });
    expect(predicate({ worldX: outlet.x, worldY: outlet.y, radius: 11 })).toBeFalse();
  });
  it('loads shared features once, crosses small loading boundaries, and retains collision and elevation', async () => {
    const terrain = createOwnerForestTerrainScene({ descriptor: forestTerrainDescriptor(world), fetchRegion: fetcher() });
    const b = build().features[0].bridges[1], p = { worldX: b.x, worldY: b.y, radius: 11 };
    expect(terrain.sample(p).walkable).toBeFalse();
    await terrain.ensure(p);
    expect(terrain.sample(p).surface).toBe('bridge');
    expect(terrain.elevation(p)).toBeGreaterThan(0);
    await terrain.ensure({ worldX: 7680, worldY: 7680 });
    await terrain.ensure(p);
    expect(terrain.sample(p).surface).toBe('bridge');
    const outlet = build().features[0].stream.outlet;
    const lake = { worldX: outlet.x, worldY: outlet.y };
    await terrain.ensure(lake);
    expect(terrain.sample(lake).walkable).toBeFalse();
  });
  it('rejects missing shared features, invalid vertices, and changed geometry before caching', async () => {
    for (const change of [r => { r.features = []; }, r => { r.features[0].stream.points[0].x = NaN; },
      r => { r.generationVersion = 3; }]) {
      const terrain = createOwnerForestTerrainScene({ descriptor: forestTerrainDescriptor(world), fetchRegion: async url => {
        const response = await fetcher()(url); change(response); return response;
      } });
      await expectAsync(terrain.ensure({ worldX: 0, worldY: 0 })).toBeRejected();
      expect(terrain.sample({ worldX: 0, worldY: 0 }).walkable).toBeFalse();
    }
  });
});

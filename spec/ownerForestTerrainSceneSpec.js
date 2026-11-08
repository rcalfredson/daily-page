import { createOwnerForestTerrainScene } from '../public/js/owner-forest-terrain-scene.js';
import { queryTerrainProof } from '../public/js/owner-forest-terrain.js';
import { validateOwnerTerrainAccess } from '../public/js/owner-forest-terrain-access.js';
import { buildForestOwnerTerrainRegionService, forestTerrainDescriptor } from '../server/services/forestOwnerTerrainRegion.js';

const OWNER = '507f1f77bcf86cd799439011';
const world = { schemaVersion: 1, worldRole: 'primary', placementPolicyVersion: 1,
  environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1, ownerUserId: OWNER, forestId: '11111111-1111-4111-8111-111111111111', status: 'active',
  worldSeed: 'terrain-live-fixture', terrain: { schemaVersion: 1, generationVersion: 3,
    activationId: '22222222-2222-4222-8222-222222222222', revision: 1,
    state: 'active', phase: 'ready', cursor: null } };
const descriptor = forestTerrainDescriptor(world);
function response(url) {
  const params = new URL(url, 'https://example.test').searchParams;
  const keys = params.get('districts').split(',').map(key => key.split(':').map(Number));
  const districts = keys.map(([x, y]) => queryTerrainProof({ seed: world.worldSeed,
    bounds: { minX: x * 1920, maxX: x * 1920, minY: y * 1920, maxY: y * 1920 } }).districts[0]);
  return { schemaVersion: 1, generationVersion: 3, token: descriptor.token, districts };
}

describe('live owner terrain scene', () => {
  it('blocks movement and placement until bounded terrain arrives, then respects water and bridges', async () => {
    const fetchRegion = jasmine.createSpy('fetchRegion').and.callFake(async url => response(url));
    const terrain = createOwnerForestTerrainScene({ descriptor, fetchRegion });
    const origin = { worldX: 0, worldY: 0, radius: 11 };
    expect(terrain.sample(origin).walkable).toBeFalse();
    expect(terrain.canMove(origin, { ...origin, worldX: 2 })).toBeFalse();
    await terrain.ensure(origin);
    expect(terrain.ready(origin)).toBeTrue();
    const payload = response(fetchRegion.calls.mostRecent().args[0]);
    const area = payload.districts.find(d => d.stream);
    const pond = area.stream.outlet;
    expect(terrain.sample({ worldX: pond.x, worldY: pond.y }).walkable).toBeFalse();
    expect(terrain.sample({ worldX: pond.x, worldY: pond.y }).placeable).toBeFalse();
    const bridge = area.bridge;
    const onBridge = { worldX: bridge.x, worldY: bridge.y, radius: 11 };
    expect(terrain.sample(onBridge).walkable).toBeTrue();
    expect(terrain.sample(onBridge).placeable).toBeFalse();
    expect(terrain.elevation(onBridge)).toBeGreaterThan(0);
    await terrain.ensure(origin);
    expect(fetchRegion).toHaveBeenCalledTimes(1);
  });

  it('rejects mismatched and malformed geometry without treating it as clear land', async () => {
    const terrain = createOwnerForestTerrainScene({ descriptor,
      fetchRegion: async url => ({ ...response(url), token: 'old' }) });
    await expectAsync(terrain.ensure({ worldX: 0, worldY: 0 })).toBeRejected();
    expect(terrain.sample({ worldX: 0, worldY: 0 }).walkable).toBeFalse();
    const broken = createOwnerForestTerrainScene({ descriptor, fetchRegion: async url => {
      const payload = response(url); payload.districts[0].boulders[0].x = NaN; return payload;
    } });
    await expectAsync(broken.ensure({ worldX: 0, worldY: 0 })).toBeRejected();
  });

  it('preserves the legacy terrain-free scene and validates walking around existing tree bodies', () => {
    expect(createOwnerForestTerrainScene().sample({ worldX: 0, worldY: 0 }).walkable).toBeTrue();
    const records = [{ id: 'tree:first', x: 320, y: 330, radius: 47 },
      { id: 'tree:in-the-route', x: 200, y: 330, radius: 47 }];
    const scene = queryTerrainProof({ seed: 'tree-detour', records,
      bounds: { minX: -120, minY: 200, maxX: 440, maxY: 450 } });
    expect(validateOwnerTerrainAccess(scene, scene.protections.find(p => p.id === 'tree:first'))).toBeTrue();
    const blocked = scene.protections[0];
    const area = scene.districts.find(d => d.column === 0 && d.row === 0);
    area.boulders.push({ id: 'invalid-blocking-rock', x: blocked.x, y: blocked.y, radius: 80 });
    expect(validateOwnerTerrainAccess(scene, blocked)).toBeFalse();
  });
});

describe('private live terrain delivery', () => {
  it('scopes generation to the authenticated world and omits frozen source identities', async () => {
    const readTerrain = jasmine.createSpy('readTerrain').and.callFake(async ({ bounds }) =>
      queryTerrainProof({ seed: world.worldSeed, bounds, records: [{ id: 'tree:private', x: 100, y: 100, radius: 47 }] }));
    const read = buildForestOwnerTerrainRegionService({
      WorldModel: { findOne: () => ({ lean: async () => world }), exists: async () => true },
      DeletionModel: { exists: () => ({ lean: async () => null }) }, readTerrain });
    const result = await read({ ownerUserId: OWNER, districts: [{ cellX: 0, cellY: 0 }], token: descriptor.token });
    expect(result.districts.length).toBe(1);
    expect(JSON.stringify(result)).not.toContain('tree:private');
    expect(JSON.stringify(result)).not.toContain(OWNER);
    expect(readTerrain).toHaveBeenCalledWith(jasmine.objectContaining({ ownerUserId: OWNER, world }));
    await expectAsync(read({ ownerUserId: OWNER, districts: [{ cellX: 0, cellY: 0 }], token: 'stale' }))
      .toBeRejectedWithError('FOREST_TERRAIN_CHANGED');
  });
});

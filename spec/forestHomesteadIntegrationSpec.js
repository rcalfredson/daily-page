import { homesteadTerrainProtections, homesteadPlacementAllowed, readForestHomesteadStore } from '../server/services/forestHomesteadStore.js';
import { createHomeStudyFixture, planHomeCartSite } from '../scripts/lib/forestHomeCartStudy.js';
import { homeLayoutFromPlan } from '../public/js/forest-home-reservations.js';
import { queryOwnerTerrain, sampleOwnerTerrain } from '../public/js/owner-forest-terrain-authority.js';
import { createHomesteadClient } from '../public/js/forest-homestead-client.js';
import { buildForestHomesteadRouteHandler } from '../server/api/v1/forestHomestead.js';

const fixture = createHomeStudyFixture({ generation: 0 });
const plan = planHomeCartSite(fixture);
const home = { layoutId: 'a9400000-0000-4000-8000-000000000001', layout: homeLayoutFromPlan(plan),
  parking: { worldX: 2500, worldY: 2500, heading: .4 } };

describe('homestead integration boundaries', () => {
  it('reserves the complete parked cart and exits while releasing its previous spot', () => {
    for (const writer of ['writing', 'garden', 'marker']) for (let angle = 0; angle < 6.3; angle += .3) {
      expect(homesteadPlacementAllowed(home, { writer, worldX: 2500 + Math.cos(angle) * 109,
        worldY: 2500 + Math.sin(angle) * 109, radius: 11 })).toBeFalse();
    }
    expect(homesteadPlacementAllowed(home, { worldX: -2500, worldY: -2500, radius: 26 })).toBeTrue();
    const moved = { ...home, parking: { worldX: -2500, worldY: -2500, heading: 0 } };
    expect(homesteadPlacementAllowed(moved, { worldX: 2500, worldY: 2500, radius: 26 })).toBeTrue();
    expect(homesteadPlacementAllowed(home, { worldX: 0, worldY: -30, radius: 11 })).toBeFalse();
  });
  it('does not query homes in legacy worlds and refuses a missing aggregate in a home-capable world', async () => {
    const HomeModel = { findOne: jasmine.createSpy('find').and.returnValue({ lean: async () => null }) };
    expect(await readForestHomesteadStore({ world: { schemaVersion: 1 }, HomeModel })).toBeNull();
    expect(HomeModel.findOne).not.toHaveBeenCalled();
    await expectAsync(readForestHomesteadStore({ world: { schemaVersion: 2 }, HomeModel })).toBeRejectedWithError('HOME_UNAVAILABLE');
    await expectAsync(readForestHomesteadStore({ world: { schemaVersion: 3 }, HomeModel })).toBeRejectedWithError('HOME_MIGRATION_REQUIRED');
  });
  it('covers yard corners, complete corridors, turns and parking with bounded terrain protections in generations 3 and 4', () => {
    const records = homesteadTerrainProtections(home), points = [];
    expect(records.length).toBeLessThan(512);
    for (let x = -160; x <= 160; x += 20) for (let y = -180; y <= 180; y += 20) points.push({ x: plan.home.x + x, y: plan.home.y + y });
    for (const [path, width] of [[plan.route, 84], [plan.approach, 12]]) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], length = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = 0; d <= length; d += 20) for (const sign of [-1, 1]) points.push({
        x: a.x + (b.x - a.x) * d / length - (b.y - a.y) * sign * width / length,
        y: a.y + (b.y - a.y) * d / length + (b.x - a.x) * sign * width / length });
    }
    for (const p of points) expect(records.some(r => Math.hypot(r.x - p.x, r.y - p.y) <= r.radius)).toBeTrue();
    for (const generationVersion of [3, 4]) {
      const scenes = new Map();
      for (const p of [...points, { x: 2500, y: 2500 }]) {
        const key = `${Math.floor(p.x / 1920)}:${Math.floor(p.y / 1920)}`;
        if (!scenes.has(key)) scenes.set(key, queryOwnerTerrain({ seed: fixture.seed, generationVersion, records,
          bounds: { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y } }));
        expect(sampleOwnerTerrain(scenes.get(key), p, 11).walkable).toBeTrue();
      }
    }
  });
  it('binds private routes to the session owner and returns explicit conflict status', async () => {
    const service = { mutate: jasmine.createSpy('mutate').and.rejectWith(Object.assign(new Error('CONSTRUCTION_CONFLICT'), { code: 'CONSTRUCTION_CONFLICT' })) };
    const res = { set() {}, vary() {}, status: jasmine.createSpy('status').and.callFake(() => res), json: jasmine.createSpy('json') };
    const route = buildForestHomesteadRouteHandler({ service });
    await route({ user: { id: 'session-owner' }, method: 'POST', query: {}, body: { ownerUserId: 'forged-owner' } }, res);
    expect(service.mutate).toHaveBeenCalledWith({ ownerUserId: 'session-owner', command: { ownerUserId: 'forged-owner' } });
    expect(res.status).toHaveBeenCalledWith(409);
    await route({ method: 'GET' }, res); expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('saved construction client recovery', () => {
  const initial = { established: true, ownerUserId: 'owner', forestId: 'forest', revision: 1, terrainToken: null };
  const response = (value, status = 200) => ({ ok: status === 200, status, json: async () => value });
  function storage() { const values = new Map(); return { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }; }
  it('keeps exact intent across reload and refuses a dependent command until its outcome is known', async () => {
    const session = storage(), request = jasmine.createSpy('request').and.rejectWith(new Error('connection lost'));
    const client = createHomesteadClient({ initial, storage: session, request, uuid: () => 'operation' });
    expect(await client.save('cart', { design: { canopy: 'linen' } })).toBeFalse();
    const intent = client.snapshot().pending;
    expect(await client.save('recover')).toBeFalse(); expect(request).toHaveBeenCalledTimes(1);
    request.and.resolveTo(response({ ...initial, revision: 2 }));
    const restored = createHomesteadClient({ initial, storage: session, request });
    expect(restored.snapshot().pending).toEqual(intent);
    expect(await restored.retry()).toBeTrue();
    expect(JSON.parse(request.calls.mostRecent().args[1].body)).toEqual(intent);
    expect(restored.snapshot().pending).toBeNull();
  });
  it('requires a forest reload when an authoritative refresh reports different terrain', async () => {
    const request = jasmine.createSpy('request').and.resolveTo(response({ ...initial, terrainToken: 'new-terrain' }));
    const client = createHomesteadClient({ initial, storage: storage(), request });
    await client.refresh(); expect(client.snapshot().status).toBe('reload');
    expect(await client.save('recover')).toBeFalse(); expect(request).toHaveBeenCalledTimes(1);
  });
  it('refreshes conflicts without silently resubmitting and blocks changes if that refresh fails', async () => {
    const request = jasmine.createSpy('request').and.resolveTo(response({ code: 'CONSTRUCTION_CONFLICT' }, 409));
    const client = createHomesteadClient({ initial, storage: storage(), request, uuid: () => 'operation' });
    expect(await client.save('home', { design: {} })).toBeFalse();
    expect(client.snapshot().status).toBe('stale'); expect(client.snapshot().pending).toBeNull();
    expect(await client.save('recover')).toBeFalse(); expect(request).toHaveBeenCalledTimes(2);
    request.and.resolveTo(response({ ...initial, revision: 3 }));
    expect(await client.refresh()).toBeTrue(); expect(client.snapshot().record.revision).toBe(3);
  });
});

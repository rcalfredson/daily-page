import ForestGarden from '../server/db/models/ForestGarden.js';
import { buildForestGardenService, canonicalGardenCommand, applyGardenCommand } from '../server/services/forestGarden.js';
import { validateGarden, inspectForestGardenReservation } from '../server/services/forestGardenStore.js';
import { gardenStage, gardenReady, gardenIntersects, BLOOM_MS, HARVEST_MS } from '../public/js/forest-garden-rules.js';
import { buildForestGardenRouteHandler, requireForestAuthoredMutationOrigin } from '../server/api/v1/forest.js';
const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const PLANT = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-11-08T12:00:00Z');
const copy = value => globalThis.structuredClone(value);
const query = value => ({ session() { return this; }, lean: async () => copy(value) });
function world(overrides = {}) {
  return { ownerUserId: OWNER, forestId: FOREST, schemaVersion: 1, worldRole: 'primary',
    worldSeed: 'abcdefghijklmnopqrstuvwxyzABCDEF', status: 'active', placementPolicyVersion: 1,
    environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1,
    reconciliation: { state: 'idle' }, ...overrides };
}
function harness(overrides = {}) {
  let record = null, time = NOW;
  const session = {};
  const acquireFence = jasmine.createSpy('fence').and.resolveTo({ acquired: true });
  const inspectPlacement = jasmine.createSpy('placement').and.resolveTo({});
  const GardenModel = {
    create: jasmine.createSpy('create').and.callFake(async values => { record = copy(values[0]); return values; }),
    replaceOne: jasmine.createSpy('replace').and.callFake(async (filter, next) => {
      if (filter.revision !== record.revision) return { matchedCount: 0 };
      record = copy(next); return { matchedCount: 1 };
    })
  };
  const service = buildForestGardenService({ GardenModel, acquireFence, inspectPlacement,
    WorldModel: { findOne: () => query(world()) }, DeletionModel: { exists: () => query(null) },
    readGarden: async () => copy(record), clock: () => new Date(time),
    transactionRunner: async work => work(session), ...overrides });
  return { service, GardenModel, acquireFence, inspectPlacement, record: () => copy(record),
    advance: ms => { time = new Date(time.getTime() + ms); } };
}
const command = (action, expectedRevision, extra = {}) => ({ action, expectedRevision, terrainToken: null, ...extra });
const mutate = (h, input) => h.service.mutate({ ownerUserId: OWNER, command: input });
async function planted(h) {
  await mutate(h, command('acquire', 0));
  return mutate(h, command('plant', 1, { plantId: PLANT, worldX: -721, worldY: -1 }));
}
describe('live lanternbell garden authority', () => {
  it('enters a new forest empty-handed and grants a cutting only after explicit collection', async () => {
    let savedWorld = null;
    const WorldModel = { findOne: () => query(savedWorld), create: jasmine.createSpy('world.create').and.callFake(async () => {
      savedWorld = world(); return [savedWorld];
    }) };
    const h = harness({ WorldModel });
    const entered = await mutate(h, command('establish', 0));
    expect(entered.cuttings).toBe(0); expect(entered.acquired).toBeFalse(); expect(entered.revision).toBe(0);
    expect(h.GardenModel.create).not.toHaveBeenCalled();
    await mutate(h, command('establish', 0));
    expect(WorldModel.create).toHaveBeenCalledTimes(1);
    const found = await mutate(h, command('acquire', 0));
    expect(found.cuttings).toBe(1); expect(found.acquired).toBeTrue();
    const reentered = await mutate(h, command('establish', 0));
    expect(reentered.cuttings).toBe(1); expect(reentered.revision).toBe(1);
  });

  it('establishes a terrain-free empty world under the same owner fence as first acquisition', async () => {
    const WorldModel = { findOne: () => query(null), create: jasmine.createSpy('world.create').and.resolveTo([world()]) };
    const h = harness({ WorldModel });
    await mutate(h, command('acquire', 0));
    expect(WorldModel.create).toHaveBeenCalledTimes(1);
    expect(h.acquireFence).toHaveBeenCalledTimes(1);
    expect(h.record().cuttings).toBe(1);
  });
  it('reads an empty garden without creating durable state', async () => {
    const h = harness();
    const view = await h.service.read({ ownerUserId: OWNER });
    expect(view.revision).toBe(0); expect(view.plants).toEqual([]);
    expect(h.GardenModel.create).not.toHaveBeenCalled();
  });
  it('rejects unknown commands, forged fields, clocks and invalid coordinates before authority', async () => {
    const h = harness();
    for (const input of [command('watering', 0), { ...command('acquire', 0), ownerUserId: OWNER },
      command('plant', 1, { plantId: PLANT, worldX: 1.5, worldY: 0 }),
      command('move', 1, { plantId: PLANT, worldX: 1e9 + 1, worldY: 0 }),
      { ...command('acquire', 0), serverNow: NOW }, command('acquire', Number.MAX_SAFE_INTEGER)]) {
      await expectAsync(mutate(h, input)).toBeRejectedWithError('GARDEN_INVALID_INPUT');
    }
    expect(h.acquireFence).not.toHaveBeenCalled();
  });
  it('gathers once and recognizes exact retries without issuing another cutting', async () => {
    const h = harness(), input = command('acquire', 0);
    const first = await mutate(h, input), retry = await mutate(h, input);
    expect(retry).toEqual(first); expect(h.record().cuttings).toBe(1);
    expect(h.GardenModel.create).toHaveBeenCalledTimes(1);
    await expectAsync(mutate(h, command('acquire', 1))).toBeRejectedWithError('GARDEN_ALREADY_FOUND');
  });
  it('deducts and plants together; older acquisition retries cannot mint stock', async () => {
    const h = harness(); await planted(h);
    expect(h.record().cuttings).toBe(0); expect(h.record().plants.length).toBe(1);
    await expectAsync(mutate(h, command('acquire', 0))).toBeRejectedWithError('GARDEN_CONFLICT');
    const retry = await mutate(h, command('plant', 1, { plantId: PLANT, worldX: -721, worldY: -1 }));
    expect(retry.revision).toBe(2); expect(retry.cuttings).toBe(0);
  });
  it('derives exact stages and harvest eligibility from server time', async () => {
    const h = harness(); await planted(h);
    const p = h.record().plants[0];
    expect(gardenStage(p, NOW.getTime())).toBe('rooted');
    expect(gardenStage(p, NOW.getTime() + 120000)).toBe('sprout');
    expect(gardenStage(p, NOW.getTime() + BLOOM_MS - 1)).toBe('sprout');
    expect(gardenStage(p, NOW.getTime() + BLOOM_MS)).toBe('flowering');
    await expectAsync(mutate(h, command('harvest', 2, { plantId: PLANT }))).toBeRejectedWithError('GARDEN_GROWING');
    h.advance(BLOOM_MS);
    const first = await mutate(h, command('harvest', 2, { plantId: PLANT }));
    expect(first.cuttings).toBe(1); expect(first.plants[0].ready).toBeFalse();
    expect(new Date(first.plants[0].readyAt).getTime()).toBe(NOW.getTime() + BLOOM_MS + HARVEST_MS);
    await mutate(h, command('harvest', 2, { plantId: PLANT }));
    expect(h.record().cuttings).toBe(1);
    h.advance(365 * 86400000);
    const late = await mutate(h, command('harvest', 3, { plantId: PLANT }));
    expect(late.cuttings).toBe(2); expect(late.plants.length).toBe(1);
  });
  it('reuses yield immediately, moves without regrowth, and lifts without loss', async () => {
    const h = harness(); await planted(h); h.advance(BLOOM_MS);
    await mutate(h, command('harvest', 2, { plantId: PLANT }));
    const second = '33333333-3333-4333-8333-333333333333';
    await mutate(h, command('plant', 3, { plantId: second, worldX: -680, worldY: -1 }));
    const original = h.record().plants[0];
    await mutate(h, command('move', 4, { plantId: PLANT, worldX: -740, worldY: 40 }));
    expect(h.record().plants[0].plantedAt).toEqual(original.plantedAt);
    expect(h.record().plants[0].readyAt).toEqual(original.readyAt);
    await mutate(h, command('lift', 5, { plantId: PLANT }));
    await mutate(h, command('lift', 5, { plantId: PLANT }));
    expect(h.record().cuttings).toBe(1); expect(h.record().plants.length).toBe(1);
    await expectAsync(mutate(h, command('move', 4, { plantId: PLANT, worldX: -740, worldY: 40 })))
      .toBeRejectedWithError('GARDEN_CONFLICT');
  });
  it('reserves mature spacing across signed cell boundaries and respects other geography', async () => {
    const h = harness(); await planted(h);
    expect(h.inspectPlacement.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      ownerUserId: OWNER, worldX: -721, worldY: -1, session: jasmine.any(Object)
    }));
    expect(gardenIntersects(h.record().plants, -720, 0)).toBeTrue();
    expect(gardenIntersects(h.record().plants, -695, -1)).toBeFalse();
    expect(await inspectForestGardenReservation({ ownerUserId: OWNER, world: world(),
      worldX: -720, worldY: -1, readGarden: async () => h.record() })).toBeFalse();
    const read = await h.service.read({ ownerUserId: OWNER, cells: [{ cellX: -2, cellY: -1 }] });
    expect(read.plants.length).toBe(1);
    expect((await h.service.read({ ownerUserId: OWNER, cells: [{ cellX: -1, cellY: -1 }] })).plants.length).toBe(0);
  });
  it('fails closed for deletion, reconciliation and changed terrain without spending', async () => {
    for (const overrides of [
      { DeletionModel: { exists: () => query({}) } },
      { WorldModel: { findOne: () => query(world({ reconciliation: { state: 'running' } })) } },
      { WorldModel: { findOne: () => query(world({ terrain: { schemaVersion: 1, generationVersion: 4,
        activationId: FOREST, revision: 1, state: 'active', phase: 'ready', cursor: null } })) } }
    ]) {
      const h = harness(overrides);
      await expectAsync(mutate(h, command('acquire', 0))).toBeRejected();
      expect(h.record()).toBeNull();
    }
  });
  it('keeps full satchels and capacity rejections lossless', () => {
    const p = { plantId: PLANT, worldX: 0, worldY: 0, plantedAt: NOW,
      readyAt: new Date(NOW.getTime() + BLOOM_MS) };
    const full = { revision: 10, cuttings: 8, plants: [p] };
    expect(() => applyGardenCommand(full, command('lift', 10, { plantId: PLANT }), NOW)).toThrowError('GARDEN_SATCHEL_FULL');
    expect(full.plants.length).toBe(1); expect(full.cuttings).toBe(8);
    expect(() => applyGardenCommand({ ...full, plants: Array(24).fill(p) },
      command('plant', 10, { plantId: FOREST, worldX: 100, worldY: 100 }), NOW)).toThrowError('GARDEN_FULL');
    expect(gardenReady(p, NOW.getTime() + BLOOM_MS - 1)).toBeFalse();
  });
  it('validates durable shapes, bounded identities and a named owner unique index', async () => {
    const h = harness(); await planted(h);
    const record = h.record();
    expect(() => validateGarden({ ...record, cuttings: '0' }, record)).toThrowError('GARDEN_UNAVAILABLE');
    expect(() => validateGarden({ ...record, plants: null }, record)).toThrowError('GARDEN_UNAVAILABLE');
    expect(validateGarden(record, { ownerUserId: OWNER, forestId: FOREST })).toEqual(record);
    expect(() => validateGarden({ ...record, schemaVersion: 2 }, record)).toThrowError('GARDEN_MIGRATION_REQUIRED');
    expect(() => validateGarden({ ...record, plants: [...record.plants, record.plants[0]] }, record)).toThrow();
    expect(ForestGarden.schema.indexes()).toContain([{ ownerUserId: 1, forestId: 1 },
      jasmine.objectContaining({ unique: true, name: 'forest_garden_owner' })]);
    expect(() => canonicalGardenCommand(command('harvest', 2, { plantId: 'foreign' }))).toThrow();
  });
});
describe('private garden HTTP boundary', () => {
  function response() { return { status: jasmine.createSpy('status').and.callFake(function () { return this; }),
    json: jasmine.createSpy('json').and.callFake(function () { return this; }) }; }
  it('requires an authenticated owner and rejects forged query authority', async () => {
    const service = { read: jasmine.createSpy('read'), mutate: jasmine.createSpy('mutate') };
    const route = buildForestGardenRouteHandler({ service });
    let res = response(); await route({ method: 'GET', query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401); expect(service.read).not.toHaveBeenCalled();
    res = response(); await route({ method: 'GET', user: { id: OWNER }, query: { ownerUserId: OWNER } }, res);
    expect(res.status).toHaveBeenCalledWith(400); expect(service.read).not.toHaveBeenCalled();
  });
  it('rejects malformed regional cells with a bounded invalid-input response', async () => {
    const res = response(); const service = { read: jasmine.createSpy('read') };
    await buildForestGardenRouteHandler({ service })({ method: 'GET', user: { id: OWNER },
      query: { cells: '01:0' } }, res);
    expect(res.status).toHaveBeenCalledWith(400); expect(service.read).not.toHaveBeenCalled();
  });
  it('passes exact signed regional cells and uses only session owner identity', async () => {
    const service = { read: jasmine.createSpy('read').and.resolveTo({ version: 1 }) };
    const res = response();
    await buildForestGardenRouteHandler({ service })({ method: 'GET', user: { id: OWNER },
      query: { cells: '-2:-1,0:0' } }, res);
    expect(service.read).toHaveBeenCalledWith({ ownerUserId: OWNER,
      cells: [{ cellX: -2, cellY: -1 }, { cellX: 0, cellY: 0 }] });
  });
  it('uses the existing origin and JSON guard for garden commands', () => {
    const next = jasmine.createSpy('next'), res = response();
    requireForestAuthoredMutationOrigin({ method: 'POST', get: () => 'https://foreign.test' }, res, next);
    expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
  });
});

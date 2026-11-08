import { buildForestOwnerTerrainActivationService } from '../server/services/forestOwnerTerrainActivation.js';
import { assertForestTerrainPlacementReady, buildForestOwnerTerrainService,
  validateForestOwnerTerrain } from '../server/services/forestOwnerTerrain.js';
import { forestTerrainDescriptor } from '../server/services/forestOwnerTerrainRegion.js';
import { buildOwnerTerrainProtections } from '../public/js/owner-forest-terrain-authority.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const ACTIVATION = '22222222-2222-4222-8222-222222222222';
const UPGRADE = '55555555-5555-4555-8555-555555555555';
const TREE = '33333333-3333-4333-8333-333333333333';
const MARKER = '44444444-4444-4444-8444-444444444444';
function query(read) {
  const q = { sort: () => q, limit: n => { q.n = n; return q; }, session: () => q,
    lean: async () => read(q.n) };
  return q;
}
function harness({ realGeometry = false } = {}) {
  const state = { world: { schemaVersion: 1, ownerUserId: OWNER, forestId: FOREST,
    worldRole: 'primary', status: 'active', worldSeed: 'terrain_activation_seed_0123456789abcdef',
    placementPolicyVersion: 1, environmentPolicyVersion: 1, environmentSchemaVersion: 1,
    worldGenerationVersion: 1, reconciliation: { state: 'idle' } },
  protections: [], deletion: null, enabled: true, failSave: false, fenceCalls: 0,
  trees: [{ _id: '000000000000000000000001', ownerUserId: OWNER, forestId: FOREST, schemaVersion: 1, identityVersion: 1, writingTreeId: TREE,
    sourceState: 'inactive', hiddenFromForest: true,
    placement: { policyVersion: 1, worldX: -320, worldY: -410 }, projection: { phenotypeId: 'open-crown-deciduous' } }],
  markers: [{ _id: '000000000000000000000002', ownerUserId: OWNER, forestId: FOREST, schemaVersion: 1, identityVersion: 1, kind: 'personal-marker', objectId: MARKER,
    state: 'removed', creationFingerprint: { version: 1 }, placement: { worldX: 600, worldY: 500 } }] };
  const Model = rows => ({ find: filter => query(n => rows().filter(r =>
    !filter._id?.$gt || String(r._id) > filter._id.$gt).slice(0, n)) });
  const ProtectionModel = {
    find: filter => query(n => state.protections.filter(r => r.activationId === filter.activationId
      && (!filter._id?.$gt || r._id > filter._id.$gt)).slice(0, n)),
    insertMany: async rows => {
      for (const row of rows) {
        if (state.protections.some(r => r.sourceKey === row.sourceKey
          && r.activationId === row.activationId)) throw new Error('duplicate protection');
        state.protections.push({ ...row, _id: String(state.protections.length + 10).padStart(24, '0') });
      }
    },
    deleteMany: async filter => {
      const before = state.protections.length;
      state.protections = state.protections.filter(r => !filter._id.$in.includes(r._id));
      return { deletedCount: before - state.protections.length };
    }
  };
  const service = buildForestOwnerTerrainActivationService({
    WorldModel: { findOne: () => query(() => global.structuredClone(state.world)),
      updateOne: async (filter, update) => {
        if (state.failSave) throw new Error('world write failed');
        if (update.$set) state.world.terrain = global.structuredClone(update.$set.terrain);
        else delete state.world.terrain;
        return { matchedCount: 1 };
      } },
    TreeModel: Model(() => state.trees), MarkerModel: Model(() => state.markers), ProtectionModel,
    DeletionModel: { exists: () => query(() => state.deletion) }, UserModel: {},
    acquireFence: async () => { state.fenceCalls += 1; },
    activationEnabled: () => state.enabled, generateId: () => state.world.terrain?.state === 'active' ? UPGRADE : ACTIVATION,
    ...(realGeometry ? { readTerrain: buildForestOwnerTerrainService({ ProtectionModel }) }
      : { readTerrain: async ({ world }) => ({ protections: buildOwnerTerrainProtections(state.protections
        .filter(r => r.activationId === world.terrain.activationId)
        .map(r => ({ id: r.sourceKey, x: r.x, y: r.y, radius: r.radius })), world.terrain.generationVersion) }),
      validateAccess: () => !state.failAccess }),
    transactionRunner: async work => {
      const snapshot = global.structuredClone(state);
      try { return await work({ transaction: true }); }
      catch (error) { Object.assign(state, snapshot); throw error; }
    }
  });
  const call = (action = 'step', batchSize = 1, generationVersion = 3) => service({ ownerUserId: OWNER, action, batchSize, generationVersion });
  return { state, call, ProtectionModel };
}

describe('owner terrain preparation and private geometry reads', () => {
  async function activate(call, state) {
    await call('start');
    for (let i = 0; i < 12 && state.world.terrain.phase !== 'ready'; i++) await call();
    await call('publish');
  }
  it('keeps the published world readable while replacement captures current placements, then cancels only that replacement', async () => {
    const { state, call, ProtectionModel } = harness();
    await activate(call, state);
    const descriptor = forestTerrainDescriptor(state.world);
    const read = buildForestOwnerTerrainService({ ProtectionModel });
    const args = { ownerUserId: OWNER, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
    const before = await read({ ...args, world: state.world });
    state.markers[0].placement = { worldX: 950, worldY: 850 };
    const upgrade = await call('upgrade', 1, 4);
    expect(upgrade.activationId).toBe(UPGRADE);
    expect(forestTerrainDescriptor(state.world)).toEqual(descriptor);
    expect(() => assertForestTerrainPlacementReady(state.world)).toThrowError('FOREST_TERRAIN_PREPARING');
    for (let i = 0; i < 4; i++) await call();
    expect(state.protections.find(p => p.activationId === UPGRADE && p.sourceKey === `marker:${MARKER}`).x).toBe(950);
    expect(state.protections.find(p => p.activationId === ACTIVATION && p.sourceKey === `marker:${MARKER}`).x).toBe(600);
    expect((await read({ ...args, world: state.world })).districts).toEqual(before.districts);
    state.enabled = false;
    for (let i = 0; i < 10 && state.world.terrain.replacement; i++) await call('cancel');
    expect(state.world.terrain.replacement).toBeUndefined();
    expect(forestTerrainDescriptor(state.world)).toEqual(descriptor);
    expect(state.protections.filter(p => p.activationId === ACTIVATION).length).toBe(3);
    expect(state.protections.some(p => p.activationId === UPGRADE)).toBeFalse();
    expect(() => assertForestTerrainPlacementReady(state.world)).not.toThrow();
  });
  it('recovers failed upgrade verification, swaps authority atomically, and cleans only retired protections with the gate off', async () => {
    const { state, call } = harness();
    await activate(call, state);
    const descriptor = forestTerrainDescriptor(state.world);
    const seed = state.world.worldSeed;
    state.failSave = true;
    await expectAsync(call('upgrade', 1, 4)).toBeRejectedWithError('world write failed');
    expect(state.world.terrain.replacement).toBeUndefined();
    expect(state.protections.some(p => p.activationId === UPGRADE)).toBeFalse();
    state.failSave = false;
    await call('upgrade', 1, 4);
    for (let i = 0; i < 4; i++) await call();
    state.failAccess = true;
    await expectAsync(call()).toBeRejectedWithError('FOREST_TERRAIN_ACCESS_UNAVAILABLE');
    expect(forestTerrainDescriptor(state.world)).toEqual(descriptor);
    await expectAsync(call('publish')).toBeRejectedWithError('FOREST_TERRAIN_NOT_PREPARED');
    state.failAccess = false;
    for (let i = 0; i < 6 && state.world.terrain.replacement.phase !== 'ready'; i++) await call();
    expect((await call('publish')).activationId).toBe(UPGRADE);
    expect(state.world.terrain.generationVersion).toBe(4);
    expect(state.world.worldSeed).toBe(seed);
    expect(state.world.terrain.replacement).toBeUndefined();
    expect(state.world.terrain.retiredActivationId).toBe(ACTIVATION);
    expect(forestTerrainDescriptor(state.world).token).not.toBe(descriptor.token);
    await expectAsync(call('cancel')).toBeRejectedWithError('FOREST_TERRAIN_ALREADY_ACTIVE');
    state.enabled = false;
    const result = await call('cleanup', 100);
    expect(result.retiredActivationId).toBeUndefined();
    expect(state.protections.every(p => p.activationId === UPGRADE)).toBeTrue();
    expect(state.protections.length).toBe(3);
    expect(() => assertForestTerrainPlacementReady(state.world)).not.toThrow();
  });
  it('explicitly activates generation 4 with real frozen-place access verification and never changes an existing generation', async () => {
    const { state, call } = harness({ realGeometry: true });
    const trees = global.structuredClone(state.trees), markers = global.structuredClone(state.markers);
    expect((await call('start', 1, 4)).generationVersion).toBe(4);
    await expectAsync(call('start', 1, 3)).toBeRejectedWithError('FOREST_TERRAIN_GENERATION_CONFLICT');
    for (let i = 0; i < 12 && state.world.terrain.phase !== 'ready'; i++) await call();
    expect(state.world.terrain.phase).toBe('ready');
    expect((await call('publish')).generationVersion).toBe(4);
    expect(state.trees).toEqual(trees); expect(state.markers).toEqual(markers);
    await expectAsync(call('start', 1, 3)).toBeRejectedWithError('FOREST_TERRAIN_GENERATION_CONFLICT');
    expect(state.world.terrain.generationVersion).toBe(4);
  });
  it('collects bounded pages including hidden trees and retained removed markers without publishing', async () => {
    const { state, call } = harness();
    const first = await call('start');
    expect(first.state).toBe('preparing');
    expect(() => assertForestTerrainPlacementReady(state.world)).toThrow();
    expect(await call('start')).toEqual(first);
    expect(state.protections.length).toBe(1);
    const page = await call();
    expect(page.cursor).toBe('000000000000000000000001');
    expect((await call()).phase).toBe('markers');
    await call();
    expect((await call()).phase).toBe('verify');
    for (let i = 0; i < 4; i += 1) await call();
    expect(state.world.terrain.phase).toBe('ready');
    expect(state.protections.map(r => r.sourceKey)).toEqual(['entrance', `tree:${TREE}`, `marker:${MARKER}`]);
    expect(state.protections.find(r => r.sourceKey === `tree:${TREE}`).districtX).toBe(-1);
    expect(state.protections.every(r => !('projection' in r) && !('writingLink' in r))).toBeTrue();
    expect((await call()).phase).toBe('ready');
    expect(state.world.terrain.state).toBe('preparing');
    expect(state.fenceCalls).toBeGreaterThan(0);
    expect((await call('publish')).state).toBe('active');
    expect((await call('publish')).state).toBe('active');
  });

  it('cannot publish before access verification and retains progress on failed verification', async () => {
    const { state, call } = harness();
    await call('start');
    await expectAsync(call('publish')).toBeRejectedWithError('FOREST_TERRAIN_NOT_PREPARED');
    for (let i = 0; i < 4; i += 1) await call();
    expect(state.world.terrain.phase).toBe('verify');
    state.failAccess = true;
    await expectAsync(call()).toBeRejectedWithError('FOREST_TERRAIN_ACCESS_UNAVAILABLE');
    expect(state.world.terrain.cursor).toBeNull();
  });

  it('rolls back page writes with their cursor and can resume the same page', async () => {
    const { state, call } = harness();
    await call('start');
    state.failSave = true;
    await expectAsync(call()).toBeRejectedWithError('world write failed');
    expect(state.protections.length).toBe(1);
    expect(state.world.terrain.cursor).toBeNull();
    state.failSave = false;
    await call();
    expect(state.protections.length).toBe(2);
  });

  it('requires opt-in, denies deleting owners, and supports bounded cancellation with the gate off', async () => {
    const { state, call } = harness();
    state.enabled = false;
    await expectAsync(call('start')).toBeRejectedWithError('FOREST_TERRAIN_ACTIVATION_DISABLED');
    state.enabled = true;
    state.deletion = {};
    await expectAsync(call('start')).toBeRejectedWithError('FOREST_TERRAIN_UNAVAILABLE');
    state.deletion = null;
    await call('start');
    await call();
    state.enabled = false;
    expect((await call('cancel')).state).toBe('cancelling');
    expect((await call('cancel')).state).toBe('cancelling');
    expect(await call('cancel')).toBeNull();
    expect(state.protections).toEqual([]);
    expect(state.world.terrain).toBeUndefined();
    expect(assertForestTerrainPlacementReady(state.world)).toBeNull();
  });

  it('fails closed on unsupported source formats without advancing preparation', async () => {
    const { state, call } = harness();
    await call('start');
    state.trees[0].schemaVersion = 99;
    await expectAsync(call()).toBeRejectedWithError('FOREST_TERRAIN_UNSUPPORTED_TREE');
    expect(state.world.terrain.cursor).toBeNull();
    expect(state.protections.length).toBe(1);
  });

  it('reconstructs bounded active terrain with owner-scoped frozen constraints even with activation disabled', async () => {
    const { state, call, ProtectionModel } = harness();
    await call('start');
    await call();
    state.world.terrain = { ...state.world.terrain, state: 'active', phase: 'ready', cursor: null };
    state.enabled = false;
    const read = buildForestOwnerTerrainService({ ProtectionModel });
    const bounds = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    const scene = await read({ ownerUserId: OWNER, world: state.world, bounds });
    expect(scene.protections.length).toBe(2);
    await expectAsync(read({ ownerUserId: '507f1f77bcf86cd799439012', world: state.world, bounds }))
      .toBeRejectedWithError('FOREST_TERRAIN_UNAVAILABLE');
    state.protections[0].districtX = 99;
    await expectAsync(read({ ownerUserId: OWNER, world: state.world, bounds }))
      .toBeRejectedWithError('FOREST_TERRAIN_UNAVAILABLE');
    expect(() => validateForestOwnerTerrain({ ...state.world.terrain, generationVersion: 99 })).toThrow();
  });
});

import crypto from 'node:crypto';
import ForestHomestead from '../server/db/models/ForestHomestead.js';
import { buildForestHomesteadService, canonicalHomesteadCommand } from '../server/services/forestHomestead.js';
import { validateHomestead, homesteadCartCost, HOMESTEAD_RECEIPT_LIMIT } from '../server/services/forestHomesteadRecord.js';
import { DEFAULT_HOME_DESIGN, TANSY_CART_FRAME, studyCartDesign } from '../public/js/forest-construction-design.js';
import { createHomeStudyFixture, planHomeCartSite } from '../scripts/lib/forestHomeCartStudy.js';

const OWNER = '64b00000000000000000a094';
const FOREST = 'a9400000-0000-4000-8000-000000000001';
const copy = v => globalThis.structuredClone(v);
const query = value => ({ session() { return this; }, lean: async () => copy(value) });
const world = () => ({ ownerUserId: OWNER, forestId: FOREST, schemaVersion: 1, worldRole: 'primary',
  worldSeed: 'abcdefghijklmnopqrstuvwxyzABCDEF', status: 'active', placementPolicyVersion: 1,
  environmentPolicyVersion: 1, environmentSchemaVersion: 1, worldGenerationVersion: 1, reconciliation: { state: 'idle' } });
const command = (action, expectedRevision, extra = {}) => ({ action, operationId: crypto.randomUUID(),
  forestId: FOREST, expectedRevision, terrainToken: null, ...extra });
function harness(overrides = {}) {
  let record = null, chain = Promise.resolve(), abort = false;
  class HomeModel extends ForestHomestead {}
  HomeModel.findOne = () => query(record);
  HomeModel.create = jasmine.createSpy('create').and.callFake(async ([next]) => {
    await new ForestHomestead(next).validate(); record = copy(next); return [next];
  });
  HomeModel.replaceOne = jasmine.createSpy('replace').and.callFake(async (filter, next) => {
    if (record.revision !== filter.revision) return { matchedCount: 0 };
    record = copy(next); return { matchedCount: 1 };
  });
  const transactionRunner = work => {
    const pending = chain.then(async () => {
      const before = copy(record);
      try { const result = await work({}); if (abort) throw new Error('transaction abort'); return result; }
      catch (error) { record = before; throw error; }
    });
    chain = pending.catch(() => {}); return pending;
  };
  const validatePlacement = jasmine.createSpy('placement').and.resolveTo(true);
  const acquireFence = jasmine.createSpy('fence').and.resolveTo({ acquired: true });
  const options = { HomeModel, WorldModel: { findOne: () => query(world()), updateOne: async () => ({ matchedCount: 1 }) }, DeletionModel: { exists: () => query(null) },
    transactionRunner, acquireFence, enabled: () => true,
    planSite: async () => planHomeCartSite(createHomeStudyFixture({ generation: 0 })), validatePlacement, ...overrides };
  const service = buildForestHomesteadService(options);
  return { service, options, HomeModel, validatePlacement, acquireFence, record: () => copy(record),
    abort: value => { abort = value; }, corrupt: fn => { record = fn(record); } };
}
const mutate = (h, input) => h.service.mutate({ ownerUserId: OWNER, command: input });
const establish = h => mutate(h, command('establish', 0));

describe('transactional homestead authority', () => {
  it('requires explicit enablement and integrated planning/placement before publishing anything', async () => {
    const disabled = harness({ enabled: () => false });
    await expectAsync(establish(disabled)).toBeRejectedWithError('HOME_DISABLED');
    expect(disabled.acquireFence).not.toHaveBeenCalled();
    const missingPlanner = harness({ planSite: undefined });
    await expectAsync(establish(missingPlanner)).toBeRejectedWithError('HOME_INTEGRATION_NOT_READY');
    const missingPlacement = harness({ validatePlacement: undefined });
    await expectAsync(establish(missingPlacement)).toBeRejectedWithError('HOME_INTEGRATION_NOT_READY');
    expect(missingPlanner.record()).toBeNull(); expect(missingPlacement.record()).toBeNull();
  });
  it('reads absent homes without creating records and retains readable state when disabled', async () => {
    const h = harness(); expect((await h.service.read({ ownerUserId: OWNER })).established).toBeFalse();
    expect(h.HomeModel.create).not.toHaveBeenCalled(); await establish(h);
    const disabled = buildForestHomesteadService({ ...h.options, enabled: () => false });
    expect((await disabled.read({ ownerUserId: OWNER })).established).toBeTrue();
    const recovered = await disabled.mutate({ ownerUserId: OWNER, command: command('recover', 1) });
    expect(recovered.revision).toBe(2); expect(recovered.holdings).toEqual(h.record().holdings);
    await expectAsync(disabled.mutate({ ownerUserId: OWNER,
      command: command('home', 2, { design: DEFAULT_HOME_DESIGN }) })).toBeRejectedWithError('HOME_DISABLED');
  });
  it('establishes stable distinct identities, server-planned geography, and one bounded material grant', async () => {
    const h = harness(), first = await establish(h);
    expect(first.revision).toBe(1); expect(new Set([first.layoutId, first.homeId, first.cartId]).size).toBe(3);
    expect(first.holdings.timber + first.cartCommitment.timber).toBe(96);
    expect(first.holdings.cloth + first.cartCommitment.cloth).toBe(24);
    expect(first.receipts).toBeUndefined();
    expect(h.acquireFence).toHaveBeenCalled(); expect(h.validatePlacement).toHaveBeenCalledTimes(1);
    const read = await buildForestHomesteadService(h.options).read({ ownerUserId: OWNER });
    expect(read.cartId).toBe(first.cartId); expect(read.layout).toEqual(first.layout);
    await expectAsync(mutate(h, command('establish', 1))).toBeRejectedWithError('HOME_ALREADY_ESTABLISHED');
  });
  it('saves each first-visit milestone and requires Mallow’s invitation before accepting parking', async () => {
    const h = harness({ guidedStart: true });
    const { parking: site } = await h.options.planSite();
    await expectAsync(establish(h)).toBeRejectedWithError('HOME_SITE_CHANGED');
    await expectAsync(mutate(h, command('establish', 0, { site: { ...site, x: site.x + 1 } })))
      .toBeRejectedWithError('HOME_SITE_CHANGED');
    expect(h.record()).toBeNull();
    const clearing = await mutate(h, command('establish', 0, { site }));
    expect(clearing.schemaVersion).toBe(3);
    expect(clearing.cartDesign).toBeNull();
    expect(clearing.holdings).toEqual({ timber: 0, cloth: 0 });
    expect(clearing.starterSuppliesClaimed).toBeFalse();
    const design = studyCartDesign('canopy');
    await expectAsync(mutate(h, command('cart', 1, { design }))).toBeRejectedWithError('HOME_SUPPLIES_REQUIRED');
    await expectAsync(mutate(h, command('recover', 1))).toBeRejectedWithError('HOME_CART_NOT_READY');
    const supplies = command('supplies', 1), unpacked = await mutate(h, supplies);
    expect(unpacked.holdings).toEqual({ timber: 96, cloth: 24 });
    expect((await mutate(h, supplies)).operation.replayed).toBeTrue();
    await expectAsync(mutate(h, command('supplies', 2))).toBeRejectedWithError('HOME_SUPPLIES_UNAVAILABLE');
    const cart = await mutate(h, command('cart', 2, { design }));
    expect(cart.cartDesign).toEqual(design);
    expect(cart.cartCommitment).toEqual(homesteadCartCost(design));
    expect(cart.holdings).toEqual({ timber: 96 - cart.cartCommitment.timber, cloth: 24 - cart.cartCommitment.cloth });
    const park = revision => command('park', revision, { parking: cart.parking });
    await expectAsync(mutate(h, park(3))).toBeRejectedWithError('HOME_CART_NOT_READY');
    const met = await mutate(h, command('companion', 3, { encounter: 'meet' }));
    expect(met.companion.stage).toBe('acquainted');
    await expectAsync(mutate(h, park(4))).toBeRejectedWithError('HOME_CART_NOT_READY');
    await mutate(h, command('companion', 4, { encounter: 'invite' }));
    const ready = await mutate(h, park(5));
    expect(ready.companion.stage).toBe('joined');
    expect(ready.holdings).toEqual(cart.holdings);
    expect((await buildForestHomesteadService(h.options).read({ ownerUserId: OWNER })).cartId).toBe(clearing.cartId);
  });
  it('retains cart access and the saved companion stage on older clearings', async () => {
    const h = harness(), before = await establish(h);
    await mutate(h, command('companion', 1, { encounter: 'meet' }));
    const applicationService = buildForestHomesteadService({ ...h.options, guidedStart: true });
    const parked = await applicationService.mutate({ ownerUserId: OWNER, command: command('park', 2, { parking: before.parking }) });
    expect(parked.companion.stage).toBe('acquainted');
    expect(parked.cartDesign).toEqual(before.cartDesign);
    expect(parked.holdings).toEqual(before.holdings);
    expect(parked.cartCommitment).toEqual(before.cartCommitment);
  });
  it('requires ownership to fit the ridge frame and validates placement and parking as for basic supports', async () => {
    const authority = world();
    const h = harness({ WorldModel: { findOne: () => query(authority), updateOne: async () => ({ matchedCount: 1 }) } });
    const original = await establish(h);
    const design = { ...original.cartDesign, supports: TANSY_CART_FRAME };
    const fit = command('cart', original.revision, { design });
    await expectAsync(mutate(h, fit)).toBeRejectedWithError('HOME_CART_FRAME_NOT_OWNED');
    expect(h.record().cartDesign).toEqual(original.cartDesign);
    authority.tansyFrameAccepted = true;
    h.validatePlacement.and.resolveTo(false);
    await expectAsync(mutate(h, fit)).toBeRejectedWithError('HOME_PLACEMENT_COLLISION');
    h.validatePlacement.and.resolveTo(true);
    const fitted = await mutate(h, fit);
    expect(fitted.cartDesign).toEqual(design);
    expect(fitted.holdings).toEqual(original.holdings);
    const parked = await mutate(h, command('park', fitted.revision, { parking: original.parking }));
    expect(parked.cartDesign).toEqual(design);
    const read = await buildForestHomesteadService(h.options).read({ ownerUserId: OWNER });
    expect(read.cartDesign).toEqual(design);
    expect(read.tansyFrameOwned).toBeTrue();
  });
  it('canonicalizes field order and rejects forged grants, prices, identities and client layouts before transactions', async () => {
    const h = harness();
    const valid = command('home', 1, { design: { ...DEFAULT_HOME_DESIGN } });
    expect(canonicalHomesteadCommand(valid)).toEqual(canonicalHomesteadCommand({ ...valid,
      design: Object.fromEntries(Object.entries(valid.design).reverse()) }));
    for (const input of [{ ...valid, holdings: {} }, { ...valid, layout: {} }, { ...valid, ownerUserId: OWNER },
      { ...valid, price: 0 }, { ...valid, design: { ...valid.design, width: 999 } },
      { ...valid, operationId: 'invalid' }, command('park', 1, { parking: { worldX: 0, worldY: 0, heading: Infinity } })]) {
      await expectAsync(mutate(h, input)).toBeRejectedWithError('HOME_INVALID_INPUT');
    }
    expect(h.acquireFence).not.toHaveBeenCalled();
  });
  it('deduplicates a lost establishment response without minting another grant or identity', async () => {
    const h = harness(), input = command('establish', 0);
    const first = await mutate(h, input), retry = await mutate(h, input);
    expect(retry.homeId).toBe(first.homeId); expect(retry.revision).toBe(1);
    expect(retry.operation.replayed).toBeTrue(); expect(h.HomeModel.create).toHaveBeenCalledTimes(1);
  });
  it('rejects operation identity reuse with altered intent and recognizes earlier retained receipts', async () => {
    const h = harness(), initial = command('establish', 0); await mutate(h, initial);
    const edit = command('home', 1, { design: { ...DEFAULT_HOME_DESIGN, color: 'sage' } });
    await mutate(h, edit);
    await expectAsync(mutate(h, { ...edit, design: { ...edit.design, color: 'clay' } })).toBeRejectedWithError('HOME_OPERATION_CONFLICT');
    const retry = await mutate(h, initial);
    expect(retry.revision).toBe(2); expect(retry.operation.revision).toBe(1); expect(retry.operation.replayed).toBeTrue();
  });
  it('allows only one competing tab edit and preserves immutable object and site identity', async () => {
    const h = harness(), first = await establish(h);
    const results = await Promise.allSettled(['sage', 'clay'].map(color => mutate(h,
      command('home', 1, { design: { ...DEFAULT_HOME_DESIGN, color } }))));
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);
    expect(h.record().revision).toBe(2); expect(h.record().homeId).toBe(first.homeId);
    expect(h.record().layout).toEqual(first.layout);
  });
  it('commits replacement designs and material refunds atomically, using stored commitments', async () => {
    const h = harness(); await establish(h);
    const initialCost = h.record().cartCommitment;
    const next = await mutate(h, command('cart', 1, { design: studyCartDesign('compact') }));
    expect(next.cartCommitment).toEqual(homesteadCartCost(next.cartDesign));
    expect(next.holdings.timber).toBe(96 - next.cartCommitment.timber);
    expect(next.holdings.cloth).toBe(24);
    expect(next.cartCommitment.timber).toBeLessThan(initialCost.timber);
    h.abort(true); const before = h.record();
    await expectAsync(mutate(h, command('cart', 2, { design: studyCartDesign('canopy') }))).toBeRejectedWithError('transaction abort');
    expect(h.record()).toEqual(before);
  });
  it('rolls back establishment, receipts and grants together when the transaction aborts', async () => {
    const h = harness(); h.abort(true);
    const input = command('establish', 0);
    await expectAsync(mutate(h, input)).toBeRejectedWithError('transaction abort'); expect(h.record()).toBeNull();
    h.abort(false); expect((await mutate(h, input)).revision).toBe(1);
  });
  it('validates full placement for parking/recovery and preserves the last confirmed parking on failure', async () => {
    const h = harness(), first = await establish(h);
    const parked = await mutate(h, command('park', 1, { parking: { worldX: 900.25, worldY: 90, heading: .2 } }));
    expect(parked.parking.worldX).toBe(900.25);
    h.validatePlacement.and.resolveTo(false);
    await expectAsync(mutate(h, command('recover', 2))).toBeRejectedWithError('HOME_PLACEMENT_COLLISION');
    expect(h.record().parking).toEqual(parked.parking); expect(h.record().revision).toBe(2);
    h.validatePlacement.and.resolveTo(true);
    const recovered = await mutate(h, command('recover', 2));
    expect(recovered.parking).toEqual(first.parking); expect(recovered.cartDesign).toEqual(first.cartDesign);
    expect(recovered.holdings).toEqual(first.holdings);
  });
  it('refuses unavailable sites without any partial record or grant', async () => {
    const h = harness({ planSite: async () => ({ status: 'unavailable' }) });
    await expectAsync(establish(h)).toBeRejectedWithError('HOME_SITE_UNAVAILABLE'); expect(h.record()).toBeNull();
  });
  it('bounds receipts and rejects evicted stale intent rather than treating it as a new action', async () => {
    const h = harness(), initial = command('establish', 0); await mutate(h, initial);
    for (let revision = 1; revision <= HOMESTEAD_RECEIPT_LIMIT; revision++) await mutate(h, command('recover', revision));
    expect(h.record().receipts.length).toBe(HOMESTEAD_RECEIPT_LIMIT);
    await expectAsync(mutate(h, initial)).toBeRejectedWithError('CONSTRUCTION_CONFLICT');
    expect(h.record().revision).toBe(65);
  });
  it('fences deletion, foreign forests, terrain changes and reconciliation before spending', async () => {
    for (const options of [
      { DeletionModel: { exists: () => query({}) } },
      { WorldModel: { findOne: () => query({ ...world(), reconciliation: { state: 'running' } }) } }
    ]) {
      const h = harness(options); await expectAsync(establish(h)).toBeRejected(); expect(h.record()).toBeNull();
    }
    const h = harness();
    await expectAsync(mutate(h, command('establish', 0, { forestId: crypto.randomUUID() }))).toBeRejectedWithError('HOME_FOREST_CHANGED');
    await expectAsync(mutate(h, command('establish', 0, { terrainToken: `${FOREST}:1` }))).toBeRejectedWithError('HOME_TERRAIN_CHANGED');
    expect(h.record()).toBeNull();
  });
  it('rejects unsupported or corrupt saved data rather than resetting a homestead', async () => {
    const h = harness(); await establish(h);
    const good = h.record();
    for (const changed of [{ ...good, catalogVersion: 2 }, { ...good, extra: true },
      { ...good, holdings: { timber: 96, cloth: 24 } }, { ...good, layoutId: good.cartId },
      { ...good, receipts: [...good.receipts, good.receipts[0]] }]) {
      expect(() => validateHomestead(changed, { ownerUserId: OWNER, forestId: FOREST })).toThrow();
    }
    h.corrupt(r => ({ ...r, schemaVersion: 4 }));
    await expectAsync(h.service.read({ ownerUserId: OWNER })).toBeRejectedWithError('HOME_MIGRATION_REQUIRED');
    expect(h.HomeModel.create).toHaveBeenCalledTimes(1);
  });
  it('enforces schema cross-field validation and a unique owner/forest index', async () => {
    const h = harness(); await establish(h);
    await expectAsync(new ForestHomestead(h.record()).validate()).toBeResolved();
    await expectAsync(new ForestHomestead({ ...h.record(), holdings: { timber: 0, cloth: 0 } }).validate()).toBeRejected();
    expect(ForestHomestead.schema.indexes()).toContain([{ ownerUserId: 1, forestId: 1 },
      jasmine.objectContaining({ unique: true, name: 'forest_homestead_owner' })]);
  });
  it('upgrades a legacy home only on meeting the companion, preserving construction and parking', async () => {
    const h = harness(), before = await establish(h);
    expect((await h.service.read({ ownerUserId: OWNER })).schemaVersion).toBe(1);
    expect(h.record().companion).toBeUndefined();
    const meet = command('companion', 1, { encounter: 'meet' });
    const acquainted = await mutate(h, meet);
    expect(acquainted.schemaVersion).toBe(2);
    expect(acquainted.companion.stage).toBe('acquainted');
    for (const key of ['homeId', 'cartId', 'layoutId', 'layout', 'homeDesign', 'cartDesign', 'holdings', 'cartCommitment', 'parking']) {
      expect(acquainted[key]).withContext(key).toEqual(before[key]);
    }
    const retry = await mutate(h, meet);
    expect(retry.revision).toBe(2); expect(retry.companion).toEqual(acquainted.companion);
    expect(retry.operation.replayed).toBeTrue();
    const invite = command('companion', 2, { encounter: 'invite' });
    const joined = await mutate(h, invite);
    expect(joined.companion).toEqual({ ...acquainted.companion, stage: 'joined' });
    expect((await mutate(h, invite)).revision).toBe(3);
    const restored = await buildForestHomesteadService(h.options).read({ ownerUserId: OWNER });
    expect(restored.companion).toEqual(joined.companion);
    const recovered = await mutate(h, command('recover', 3));
    expect(recovered.companion).toEqual(joined.companion);
  });
  it('rejects skipped, forged and repeated encounter transitions and rolls back failed introductions', async () => {
    const h = harness(); await establish(h);
    await expectAsync(mutate(h, command('companion', 1, { encounter: 'invite' })))
      .toBeRejectedWithError('COMPANION_ENCOUNTER_CHANGED');
    for (const extra of [{ encounter: 'feed' }, { encounter: 'meet', companion: { stage: 'joined' } }]) {
      await expectAsync(mutate(h, command('companion', 1, extra))).toBeRejectedWithError('HOME_INVALID_INPUT');
    }
    const before = h.record(); h.abort(true);
    await expectAsync(mutate(h, command('companion', 1, { encounter: 'meet' }))).toBeRejectedWithError('transaction abort');
    expect(h.record()).toEqual(before); h.abort(false);
    const results = await Promise.allSettled([1, 2].map(() => mutate(h, command('companion', 1, { encounter: 'meet' }))));
    expect(results.filter(result => result.status === 'fulfilled').length).toBe(1);
    expect(h.record().revision).toBe(2);
    await expectAsync(mutate(h, command('companion', 2, { encounter: 'meet' })))
      .toBeRejectedWithError('COMPANION_ENCOUNTER_CHANGED');
    for (const companion of [{ ...h.record().companion, stage: 'unknown' },
      { ...h.record().companion, name: '' }, { ...h.record().companion, name: 'a'.repeat(33) },
      { ...h.record().companion, id: h.record().cartId }, { ...h.record().companion, hunger: 0 }]) {
      await expectAsync(new ForestHomestead({ ...h.record(), companion }).validate()).toBeRejected();
    }
    await expectAsync(new ForestHomestead({ ...h.record(), companion: undefined }).validate()).toBeRejected();
    // Stored names survive future changes to the catalog's initial working name.
    const named = { ...h.record().companion, name: 'Thistle' };
    await expectAsync(new ForestHomestead({ ...h.record(), companion: named }).validate()).toBeResolved();
  });
});

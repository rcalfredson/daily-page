import crypto from 'node:crypto';
import ForestHomestead from '../server/db/models/ForestHomestead.js';
import { buildForestHomesteadService, canonicalHomesteadCommand } from '../server/services/forestHomestead.js';
import { buildForestHomesteadGeography } from '../server/services/forestHomesteadGeography.js';
import { validateHomestead, homesteadCartCost, HOMESTEAD_RECEIPT_LIMIT } from '../server/services/forestHomesteadRecord.js';
import { DEFAULT_HOME_DESIGN, DEFAULT_CART_DESIGN, TANSY_CART_FRAME, studyCartDesign } from '../public/js/forest-construction-design.js';
import { cartDismount, cartPoseClear, cartSweepClear, stepForestCart } from '../public/js/forest-cart-motion.js';
import { createHomeStudyFixture, planHomeCartSite } from '../scripts/lib/forestHomeCartStudy.js';
import { availableOrchardDyes, orchardCairnBlocks, orchardPlotApproach, orchardRoad, orchardStonePassage, orchardTreeBlocks,
  orchardVariety } from '../public/js/forest-orchard.js';
import { orchardGroundAllows, planForestOrchard } from '../server/services/forestOrchardPlanner.js';
import { planWalledOrchard, provisionerFits } from '../server/services/forestOrchardOutingPlanner.js';
import { homesteadPlacementAllowed, homesteadTerrainProtections } from '../server/services/forestHomesteadStore.js';
import { orchardPlantingSpace } from '../public/js/forest-home-reservations.js';
import { outingBlocks, preservingHearth, provisionerSite, quincePickingDay, walledOrchardSite,
  worldPoint } from '../public/js/forest-orchard-outing.js';

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
  it('adds a bounded orchard to an existing home and unlocks only a locally harvested canopy dye', async () => {
    const clear = { obstacles: [], terrainAt: () => ({ walkable: true, placeable: true }) };
    const h = harness({ orchardEnabled: () => true,
      planOrchard: async ({ record }) => planForestOrchard(record.layout, record.parking, clear, clear),
      validateOrchardPlanting: async ({ record, point }) =>
        orchardPlantingSpace(record.layout, record.parking, record.orchard, point) && orchardGroundAllows(clear, point) });
    const initial = await establish(h);
    const opened = await mutate(h, command('orchard-survey', initial.revision));
    expect(opened.layout).toEqual(initial.layout);
    const { fork, branches } = orchardRoad(opened.layout, opened.orchard.site);
    expect(new Set(branches.map(({ tree }) => `${tree.x}:${tree.y}`)).size).toBe(2);
    expect(homesteadPlacementAllowed(opened, { worldX: fork.x, worldY: fork.y })).toBeFalse();
    const [quince, damson] = [orchardVariety(FOREST, 0), orchardVariety(FOREST, 1)];
    const paint = (revision, dye) => mutate(h, command('cart', revision, { design: { ...initial.cartDesign, cloth: dye } }));
    await expectAsync(paint(opened.revision, quince.dye)).toBeRejectedWithError('HOME_ORCHARD_DYE_LOCKED');
    await expectAsync(mutate(h, command('orchard-plant', opened.revision, { branch: 0 }))).toBeRejectedWithError('HOME_ORCHARD_CHANGED');
    const collect = command('orchard-collect', opened.revision, { branch: 0 });
    const seed = await mutate(h, collect);
    expect((await mutate(h, collect)).operation.replayed).toBeTrue();
    const wrong = command('orchard-plant', seed.revision, { branch: 0, plot: initial.layout.parking });
    await expectAsync(mutate(h, wrong)).toBeRejectedWithError('HOME_ORCHARD_PLANTING_BLOCKED');
    expect(h.record().orchard.stages[0]).toBe('seed');
    const offered = seed.orchard.site.plots[0];
    const plot = { x: offered.x, y: offered.y + 9 };
    const plant = command('orchard-plant', seed.revision, { branch: 0, plot });
    const planted = await mutate(h, plant);
    expect((await mutate(h, plant)).operation.replayed).toBeTrue();
    expect(planted.orchard.plantings).toEqual([plot, null]);
    expect(planted.orchard.site.plots[0]).toEqual(offered);
    expect(homesteadPlacementAllowed(planted, { worldX: plot.x, worldY: plot.y })).toBeFalse();
    const harvested = await mutate(h, command('orchard-harvest', planted.revision, { branch: 0 }));
    expect(availableOrchardDyes(harvested)).toEqual([quince.dye]);
    await expectAsync(paint(harvested.revision, damson.dye)).toBeRejectedWithError('HOME_ORCHARD_DYE_LOCKED');
    const cart = await paint(harvested.revision, quince.dye);
    expect(cart.cartDesign.cloth).toBe(quince.dye);
    expect(cart.holdings).toEqual(initial.holdings);
    expect((await h.service.read({ ownerUserId: OWNER })).orchard.stages).toEqual(['harvested', 'undiscovered']);
  });

  it('can take the fork before Amber Clearing and size each branch independently', () => {
    const layout = { version: 1, home: { x: 400, y: 0 }, parking: { x: 400, y: 90 },
      approach: [{ x: 0, y: 90 }, { x: 400, y: 90 }], route: [{ x: 400, y: 90 }, { x: 1600, y: 90 }, { x: 1600, y: 990 }] };
    const clear = { obstacles: [], terrainAt: () => ({ walkable: true, placeable: true }) };
    const roadLand = { ...clear, terrainAt: ({ worldX: x, worldY: y }) => ({
      walkable: y <= 990 && x <= 2050, placeable: y <= 990 && x <= 2050
    }) };
    const site = planForestOrchard(layout, { worldX: 400, worldY: 90 }, roadLand, clear);
    expect(site.forkDistance).toBeLessThan(0);
    expect(site.branchDistances[0]).toBeLessThan(site.branchDistances[1]);
    expect(orchardRoad(layout, site).extendsAmber).toBeFalse();
  });

  it('preserves planted trees and the old route in legacy orchard records', async () => {
    const h = harness();
    const initial = await establish(h);
    const site = { version: 1, forkDistance: 840, branchDistance: 490,
      plots: [{ x: initial.layout.home.x + 125, y: initial.layout.home.y - 54 },
        { x: initial.layout.home.x + 125, y: initial.layout.home.y - 106 }] };
    h.corrupt(record => ({ ...record, orchard: { site, stages: ['planted', 'seed'] } }));
    const read = await h.service.read({ ownerUserId: OWNER });
    expect(read.orchard.site).toEqual(site);
    expect(homesteadPlacementAllowed(read, { worldX: site.plots[0].x, worldY: site.plots[0].y })).toBeFalse();
    expect(orchardRoad(read.layout, site).extendsAmber).toBeTrue();
  });

  it('adds a reserved outing to an unmapped home, with one quince claim shared by both sources', async () => {
    const clear = { obstacles: [], terrainAt: () => ({ walkable: true, placeable: true }) };
    const h = harness({ orchardEnabled: () => true,
      planOrchard: async ({ record }) => planForestOrchard(record.layout, record.parking, clear, clear),
      planOuting: async ({ record: { layout }, site, provisionerSide }) => {
        const stall = provisionerSite(layout, provisionerSide);
        return provisionerFits(stall, clear) && planWalledOrchard(layout, site, stall, clear);
      } });
    const initial = await establish(h);
    const remember = command('orchard-outing', initial.revision, { provisionerSide: -1 });
    const opened = await mutate(h, remember);
    expect(opened.layout).toEqual(initial.layout);
    expect(opened.parking).toEqual(initial.parking);
    expect((await mutate(h, remember)).operation.replayed).toBeTrue();
    const { site, outing } = opened.orchard;
    const stall = provisionerSite(opened.layout, outing.provisionerSide);
    const wall = walledOrchardSite(opened.layout, site, outing.spurLength);
    for (const point of [stall.bay, wall.apron, wall.tree, wall.opening]) {
      expect(homesteadPlacementAllowed(opened, worldPoint(point))).toBeFalse();
      expect(homesteadTerrainProtections(opened).some(p => Math.hypot(p.x - point.x, p.y - point.y) <= p.radius)).toBeTrue();
    }
    const cart = { ...DEFAULT_CART_DESIGN, supports: TANSY_CART_FRAME };
    const drive = ({ a, b }, solids) => {
      const heading = Math.atan2(b.y - a.y, b.x - a.x);
      const from = { ...worldPoint(a), heading, design: cart }, to = { ...worldPoint(b), heading, design: cart };
      const passable = p => !outingBlocks(solids, p);
      const midpoint = { ...from, worldX: (a.x + b.x) / 2, worldY: (a.y + b.y) / 2 };
      expect(cartPoseClear(to, passable)).toBeTrue();
      expect(cartSweepClear(from, midpoint, passable)).toBeTrue();
      expect(cartSweepClear(midpoint, to, passable)).toBeTrue();
      expect(cartDismount(to, passable)).not.toBeNull();
      expect(cartSweepClear(to, { ...to, heading: heading + Math.PI }, passable)).toBeTrue();
    };
    drive(stall.road, stall.solids);
    drive(wall.road, wall.solids);
    expect(outingBlocks(wall.solids, worldPoint(wall.opening, 11))).toBeFalse();
    expect(outingBlocks(wall.solids, worldPoint(wall.stones[0], 11))).toBeTrue();
    const collected = await mutate(h, command('orchard-collect', opened.revision, { branch: 0 }));
    await expectAsync(mutate(h, command('orchard-collect', collected.revision, { branch: 0 })))
      .toBeRejectedWithError('HOME_ORCHARD_CHANGED');
    expect((await h.service.read({ ownerUserId: OWNER })).orchard).toEqual(collected.orchard);
  });

  it('keeps a saved orchard and its harvest when an outing cannot fit or is disabled', async () => {
    const h = harness({ orchardEnabled: () => true, planOuting: async () => null });
    const initial = await establish(h);
    const site = { version: 1, forkDistance: 840, branchDistance: 490,
      plots: [{ x: initial.layout.home.x + 125, y: initial.layout.home.y - 54 },
        { x: initial.layout.home.x + 125, y: initial.layout.home.y - 106 }] };
    h.corrupt(record => ({ ...record, orchard: { site, stages: ['harvested', 'seed'] } }));
    const before = h.record();
    const remember = command('orchard-outing', initial.revision, { provisionerSide: -1 });
    await expectAsync(mutate(h, remember)).toBeRejectedWithError('HOME_OUTING_UNAVAILABLE');
    expect(h.record()).toEqual(before);
    const gated = buildForestHomesteadService({ ...h.options, orchardEnabled: () => false });
    await expectAsync(gated.mutate({ ownerUserId: OWNER, command: remember })).toBeRejectedWithError('HOME_DISABLED');
    const open = buildForestHomesteadService({ ...h.options, planOuting: async () => 580 });
    const saved = await open.mutate({ ownerUserId: OWNER, command: remember });
    expect(saved.orchard.site).toEqual(site);
    expect(saved.orchard.stages).toEqual(before.orchard.stages);
    expect(availableOrchardDyes(saved)).toEqual(availableOrchardDyes(before));
  });

  it('saves a hearth before mapping, then turns one daily quince into a visible batch without spending the seed', async () => {
    const empty = { find: () => ({ sort: () => ({ limit: () => ({ session: () => query([]) }) }) }) };
    const geography = buildForestHomesteadGeography({ TreeModel: empty, MarkerModel: empty,
      readGarden: async () => null, amberClearingEnabled: () => true });
    let now = new Date('2026-11-24T23:45:00Z');
    const h = harness({ ...geography, orchardEnabled: () => true, clock: () => now,
      planSite: async () => planHomeCartSite(createHomeStudyFixture({ generation: 0 })) });
    const initial = await establish(h), side = { provisionerSide: -1 };
    const setJar = command('village-set-jar', initial.revision, side);
    const prepared = await mutate(h, setJar);
    expect(prepared.orchard).toBeUndefined();
    expect((await h.service.read({ ownerUserId: OWNER })).village.cleanJar).toBeTrue();
    expect((await mutate(h, setJar)).operation.replayed).toBeTrue();
    const hearth = preservingHearth(initial.layout, side.provisionerSide);
    expect(homesteadPlacementAllowed(prepared, worldPoint(hearth.hearth))).toBeFalse();
    expect(homesteadPlacementAllowed(prepared, worldPoint(hearth.walk.at(-1)))).toBeFalse();
    expect(homesteadTerrainProtections(prepared).some(p => p.x === hearth.hearth.x && p.y === hearth.hearth.y)).toBeTrue();
    const stall = provisionerSite(initial.layout, side.provisionerSide);
    const heading = Math.atan2(stall.bay.y - stall.turn.y, stall.bay.x - stall.turn.x);
    const ridge = { ...DEFAULT_CART_DESIGN, supports: TANSY_CART_FRAME };
    const turn = { ...worldPoint(stall.turn), heading, design: ridge };
    const bay = { ...turn, ...worldPoint(stall.bay) };
    const clear = p => !outingBlocks([...stall.solids, hearth.solid], p);
    expect(cartSweepClear(turn, bay, clear)).toBeTrue();
    expect(cartSweepClear(bay, { ...bay, heading: heading + Math.PI }, clear)).toBeTrue();
    expect(cartDismount(bay, clear)).not.toBeNull();
    await expectAsync(mutate(h, command('village-pick-quince', prepared.revision, side)))
      .toBeRejectedWithError('HOME_VILLAGE_CHANGED');
    await expectAsync(mutate(h, command('orchard-outing', prepared.revision, { provisionerSide: 1 })))
      .toBeRejectedWithError('HOME_OUTING_UNAVAILABLE');
    const mapped = await mutate(h, command('orchard-outing', prepared.revision, side));
    const picked = await mutate(h, command('village-pick-quince', mapped.revision, side));
    expect(picked.village).toEqual(jasmine.objectContaining({ carryingQuince: true, cleanJar: true, pickedDay: quincePickingDay(now) }));
    expect(picked.orchard).toEqual(mapped.orchard);
    const make = command('village-make-preserves', picked.revision, side);
    const first = await mutate(h, make);
    expect((await mutate(h, make)).village.batches).toBe(1);
    expect(first.village).toEqual(jasmine.objectContaining({ carryingQuince: false, cleanJar: false, batches: 1 }));
    await expectAsync(mutate(h, command('village-pick-quince', first.revision, side)))
      .toBeRejectedWithError('HOME_VILLAGE_CHANGED');
    now = new Date('2026-11-25T00:00:00Z');
    const secondPicking = await mutate(h, command('village-pick-quince', first.revision, side));
    now = new Date('2026-11-26T00:00:00Z');
    await expectAsync(mutate(h, command('village-pick-quince', secondPicking.revision, side)))
      .toBeRejectedWithError('HOME_VILLAGE_CHANGED');
    const second = await mutate(h, command('village-make-preserves', secondPicking.revision, side));
    expect(second.village.batches).toBe(2);
    expect(second.orchard).toEqual(mapped.orchard);
    expect(second.parking).toEqual(initial.parking);
    const disabled = buildForestHomesteadService({ ...h.options, orchardEnabled: () => false });
    await expectAsync(disabled.mutate({ ownerUserId: OWNER, command: command('village-set-jar', second.revision, side) }))
      .toBeRejectedWithError('HOME_DISABLED');
  });

  it('does not add an orchard when either branch or the home plots lack safe ground', async () => {
    const clear = { obstacles: [], terrainAt: () => ({ walkable: true, placeable: true }) };
    const blocked = { obstacles: [], terrainAt: () => ({ walkable: false, placeable: false }) };
    const h = harness();
    const { layout, parking } = await establish(h);
    expect(planForestOrchard(layout, parking, blocked, clear)).toBeNull();
    expect(planForestOrchard(layout, parking, clear, blocked)).toBeNull();
    await expectAsync(mutate(h, command('orchard-survey', 1))).toBeRejectedWithError('HOME_DISABLED');
  });

  it('guides a cart to the open side on each approach to the split stone', () => {
    const road = { end: { x: 1600, y: 990 }, fork: { x: 1600, y: 1830 } };
    expect(orchardStonePassage(road, { worldX: 1640, worldY: 820 }, false))
      .toEqual({ worldX: 1563, worldY: 850, label: 'Trail' });
    expect(orchardStonePassage(road, { worldX: 1640, worldY: 1150 }, true))
      .toEqual({ worldX: 1563, worldY: 1120, label: 'Trail' });
    expect(orchardStonePassage(road, { worldX: 1555, worldY: 820 }, false))
      .toEqual({ worldX: 1555, worldY: 895, label: 'Trail' });
  });
  it('blocks walking into the cairn and leaves room for a full-size cart to take either branch', () => {
    const layout = { route: [{ x: 0, y: 0 }, { x: 0, y: 900 }] };
    for (const forkDistance of [840, -240]) {
      const { cairn, fork } = orchardRoad(layout, { forkDistance, branchDistance: 490 });
      const clear = p => !orchardCairnBlocks(cairn, p);
      expect(clear({ worldX: cairn.x + 26, worldY: cairn.y, radius: 11 })).toBeFalse();
      expect(clear({ worldX: cairn.x + 28, worldY: cairn.y, radius: 11 })).toBeTrue();
      for (const x of [-1, 1]) {
        let cart = { worldX: fork.x, worldY: fork.y + 30, heading: Math.PI / 2,
          design: { ...DEFAULT_CART_DESIGN, supports: TANSY_CART_FRAME } };
        let blocked = false;
        for (let frame = 0; frame < 60; frame++) {
          const step = stepForestCart(cart, { x, y: 0 }, 1 / 60, clear);
          blocked ||= step.blocked;
          cart = step.cart;
        }
        expect(blocked).toBeFalse();
        expect(cart.worldX * x).toBeGreaterThan(120);
      }
    }
  });
  it('lets a walker step out of a newly planted tree while keeping its trunk solid', () => {
    const tree = { x: 0, y: 0 }, next = { worldX: 12, worldY: 0, radius: 11 };
    expect(orchardTreeBlocks(tree, next, { worldX: 10, worldY: 0 })).toBeFalse();
    expect(orchardTreeBlocks(tree, next, { worldX: 14, worldY: 0 })).toBeTrue();
    expect(orchardTreeBlocks(tree, next)).toBeTrue();
  });
  it('guides a walker around the first tree to the farther orchard plot', () => {
    const home = { x: 400, y: 0 }, plot = { x: 525, y: -106 };
    expect(orchardPlotApproach(home, plot, { worldX: 503, worldY: -34 }))
      .toEqual({ worldX: 503, worldY: 22, label: 'Yard edge' });
    expect(orchardPlotApproach(home, plot, { worldX: 503, worldY: 22 }))
      .toEqual({ worldX: 587, worldY: 22, label: 'Yard edge' });
    expect(orchardPlotApproach(home, plot, { worldX: 583, worldY: 22 }))
      .toEqual({ worldX: 583, worldY: -106, label: 'Yard edge' });
    expect(orchardPlotApproach(home, plot, { worldX: 583, worldY: -91 })).toBeNull();
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

import { forestHomesteadDevelopmentEnabled, homesteadDevelopmentEnvironment } from '../server/services/forestHomesteadAvailability.js';
import { buildForestHomesteadApplication } from '../server/services/forestHomesteadApplication.js';
import { buildForestHomesteadGeography } from '../server/services/forestHomesteadGeography.js';
import { amberClearingStone, amberClearingStoneFootprint } from '../public/js/forest-amber-clearing.js';
import { discIntersectsRectangle } from '../public/js/forest-cart-motion.js';
import { DEFAULT_HOME_DESIGN, DEFAULT_CART_DESIGN } from '../public/js/forest-construction-design.js';
import { createHomesteadClient } from '../public/js/forest-homestead-client.js';
import { orchardRoad } from '../public/js/forest-orchard.js';
const OWNER = '64b00000000000000000a097';
describe('main forest homestead integration', () => {
  it('requires an exact account allowlist and refuses production mode/database flags', () => {
    const env = { FOREST_HOMESTEAD_DEV_OWNER_IDS: `other, ${OWNER}` };
    expect(forestHomesteadDevelopmentEnabled(OWNER, env)).toBeTrue();
    expect(forestHomesteadDevelopmentEnabled('64b00000000000000000a098', env)).toBeFalse();
    expect(forestHomesteadDevelopmentEnabled(OWNER, {})).toBeFalse();
    for (const flag of ['true', 'YES', ' on ', '1']) expect(forestHomesteadDevelopmentEnabled(OWNER,
      { ...env, USE_PRODUCTION_DB: flag })).toBeFalse();
    expect(forestHomesteadDevelopmentEnabled(OWNER, { ...env, NODE_ENV: 'production' })).toBeFalse();
  });
  function setup(established = true) {
    const record = { established, forestId: 'forest', revision: established ? 1 : 0 };
    const service = { read: jasmine.createSpy('read').and.resolveTo(record), mutate: jasmine.createSpy('mutate').and.resolveTo(record) };
    const world = { forestId: 'forest' }, arrival = { worldX: 12, worldY: 34 };
    const geography = { arrival: jasmine.createSpy('arrival').and.resolveTo(arrival) };
    const WorldModel = { findOne: () => ({ lean: async () => world }) };
    return { service, geography, world, record, arrival, WorldModel };
  }
  it('keeps established homes readable and recoverable when new establishment is disabled', async () => {
    if (!homesteadDevelopmentEnvironment()) return;
    const h = setup(), app = buildForestHomesteadApplication({ ...h, enabled: () => false });
    expect((await app.read({ ownerUserId: OWNER })).arrival).toEqual(h.arrival);
    await app.mutate({ ownerUserId: OWNER, command: { action: 'recover' } });
    expect(h.service.mutate).toHaveBeenCalledOnceWith({ ownerUserId: OWNER, command: { action: 'recover' } });
    const absent = setup(false), disabled = buildForestHomesteadApplication({ ...absent, enabled: () => false });
    await expectAsync(disabled.mutate({ ownerUserId: OWNER, command: { action: 'establish' } })).toBeRejectedWithError('HOME_DISABLED');
    expect(absent.service.mutate).not.toHaveBeenCalled();
  });
  it('returns recovery state without throwing away the saved designs or overwriting entrance coordinates', async () => {
    const h = setup(); h.geography.arrival.and.resolveTo(null);
    const app = buildForestHomesteadApplication({ ...h, enabled: () => true });
    const result = await app.read({ ownerUserId: OWNER });
    expect(result.recoveryRequired).toBeTrue(); expect(result.arrival).toBeNull();
    expect(result.revision).toBe(1);
    expect(h.geography.arrival).toHaveBeenCalledWith({ ownerUserId: OWNER, world: h.world, next: h.record, session: null });
  });
  it('keeps the centerline usable and refuses parking in the solid stone only when the expedition is enabled', async () => {
    const empty = { find: () => ({ sort: () => ({ limit: () => ({ session: () => ({ lean: async () => [] }) }) }) }) };
    const options = { TreeModel: empty, MarkerModel: empty, readGarden: async () => null };
    const geography = buildForestHomesteadGeography({ ...options, amberClearingEnabled: id => id === OWNER });
    const route = [{ x: 400, y: 90 }, { x: 1600, y: 90 }, { x: 1600, y: 990 }];
    const stone = amberClearingStone(route), footprint = amberClearingStoneFootprint(stone);
    const args = { ownerUserId: OWNER, world: { forestId: 'forest' }, next: {
      layout: { home: { x: 400, y: 0 }, route }, homeDesign: DEFAULT_HOME_DESIGN, cartDesign: DEFAULT_CART_DESIGN,
      parking: { worldX: 1600, worldY: 990, heading: Math.PI / 2 }
    } };
    const spot = await geography.arrival(args);
    expect(spot).not.toBeNull();
    expect(discIntersectsRectangle(spot, footprint)).toBeFalse();
    expect(discIntersectsRectangle({ worldX: stone.x, worldY: stone.y + 10, radius: 11 }, footprint)).toBeTrue();
    expect(discIntersectsRectangle({ worldX: stone.x, worldY: stone.y + 25, radius: 11 }, footprint)).toBeFalse();
    args.next.parking = { worldX: stone.x, worldY: stone.y, heading: Math.PI / 2 };
    expect(await geography.arrival(args)).toBeNull();
    expect(await buildForestHomesteadGeography(options).arrival(args)).not.toBeNull();
    const site = { forkDistance: 840, branchDistance: 490, plots: [] };
    args.next.orchard = { site, stages: ['undiscovered', 'undiscovered'] };
    const { cairn, fork } = orchardRoad(args.next.layout, site);
    args.next.parking = { worldX: cairn.x, worldY: cairn.y, heading: 0 };
    expect(await geography.arrival(args)).toBeNull();
    args.next.parking = { worldX: fork.x, worldY: fork.y, heading: 0 };
    expect(await geography.arrival(args)).not.toBeNull();
  });
  it('only suggests a clearing for an eligible owner without an established home', async () => {
    const h = setup(false);
    const site = { x: 400, y: 90 };
    h.record.terrainToken = null;
    h.geography.planSite = jasmine.createSpy('planSite').and.resolveTo({ parking: site });
    const app = buildForestHomesteadApplication({ ...h, enabled: () => true });
    const disabled = buildForestHomesteadApplication({ ...h, enabled: () => false });
    await expectAsync(disabled.suggest({ ownerUserId: OWNER })).toBeRejectedWithError('HOME_DISABLED');
    expect(await app.suggest({ ownerUserId: OWNER })).toEqual({ site, terrainToken: null, forestId: h.record.forestId });
    h.record.established = true;
    await expectAsync(app.suggest({ ownerUserId: OWNER })).toBeRejectedWithError('HOME_ALREADY_ESTABLISHED');
    expect(h.geography.planSite).toHaveBeenCalledTimes(1);
    expect(h.service.mutate).not.toHaveBeenCalled();
  });
  it('returns an unbuilt homestead without a cart recovery prompt', async () => {
    const h = setup();
    Object.assign(h.record, { ownerUserId: OWNER, cartDesign: null });
    const app = buildForestHomesteadApplication({ ...h, enabled: () => true });
    expect(await app.read({ ownerUserId: OWNER })).toEqual({
      ...h.record, arrival: null, recoveryRequired: false
    });
    expect(h.geography.arrival).not.toHaveBeenCalled();
  });
  it('binds an unestablished save retry to the same account/forest across reload', async () => {
    const values = new Map(), storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
    const initial = { ownerUserId: OWNER, forestId: 'forest', established: false, revision: 0, terrainToken: null };
    const request = jasmine.createSpy('request').and.rejectWith(new Error('lost response'));
    const first = createHomesteadClient({ initial, storage, request, uuid: () => 'same-operation' });
    await first.save('establish'); const intent = first.snapshot().pending;
    request.and.resolveTo({ ok: true, json: async () => ({ ...initial, established: true, revision: 1 }) });
    const reopened = createHomesteadClient({ initial, storage, request });
    expect(reopened.snapshot().pending).toEqual(intent); expect(await reopened.retry()).toBeTrue();
    expect(JSON.parse(request.calls.mostRecent().args[1].body)).toEqual(intent);
  });
});

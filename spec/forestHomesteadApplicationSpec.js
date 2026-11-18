import { forestHomesteadDevelopmentEnabled, homesteadDevelopmentEnvironment } from '../server/services/forestHomesteadAvailability.js';
import { buildForestHomesteadApplication } from '../server/services/forestHomesteadApplication.js';
import { createHomesteadClient } from '../public/js/forest-homestead-client.js';
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

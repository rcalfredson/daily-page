import { JSDOM } from 'jsdom';
import { createForestTraveler, findTravelerRestSite, travelerBlocksMovement } from '../public/js/forest-traveler.js';
import { provisionerSite } from '../public/js/forest-orchard-outing.js';
import { moveOwnerForestPlayer } from '../public/js/owner-forest-scene.js';
import { buildForestTravelerRouteHandler } from '../server/api/v1/forestTraveler.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';

describe('Tansy’s offer after a save error', () => {
  let dom, previous, memory, traveler, destinations, player;
  const spawn = { worldX: 0, worldY: 0, radius: 11 };
  const control = name => document.querySelector(`[data-forest-traveler-${name}]`);
  const choices = () => [...control('dialog').querySelectorAll('button:not([hidden])')].map(button => button.textContent);

  function startTraveler(provisioner, orchardProgress, navigate) {
    traveler = createForestTraveler({
      memory, spawn, provisioner, orchardProgress, navigation: { navigate, register(_group, provider) { destinations = provider; } },
      state: () => ({ player, busy: false, placements: [],
        terrain: { sample: () => ({ placeable: true }), canMove: () => true } }),
      regionLoaded: () => true, canRest: () => true, occupied: () => false,
      canTalk: () => true, fittedCart: () => null, requestRender() {}, focus() {}
    });
    traveler.update(0);
  }

  function approachTansy(time) {
    const [tansy] = destinations();
    player = { ...spawn, worldX: tansy.worldX - 40, worldY: tansy.worldY };
    traveler.update(time);
  }

  beforeEach(() => {
    dom = new JSDOM(`<button data-forest-traveler-talk>Talk to Tansy</button>
      <dialog data-forest-traveler-dialog>
        <p data-forest-traveler-line></p><p data-forest-traveler-status hidden></p>
        <button data-forest-traveler-ask>Did you make that canopy?</button>
        <button data-forest-traveler-road>Know any good roads?</button>
        <button data-forest-traveler-orchard>Seen any fruit trees?</button>
        <button data-forest-traveler-orchard-progress hidden></button>
        <button data-forest-traveler-map-orchard hidden></button>
        <button data-forest-traveler-remember hidden>Remember the clearing</button>
        <button data-forest-traveler-back hidden>Back</button>
        <button data-forest-traveler-accept hidden>Take the frame</button>
        <button data-forest-traveler-finish hidden>Maybe later</button>
        <button data-forest-traveler-leave>Leave</button>
      </dialog>`);
    previous = ['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    window.ResizeObserver = class { observe() {} };
    const dialog = control('dialog');
    dialog.show = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; };
    memory = { forestId: FOREST, introduced: false, frameOwned: false };
    player = spawn;
  });

  afterEach(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
    dom.window.close();
  });

  for (const [button, action, frameOwned] of [
    ['accept', 'Take the frame', true], ['finish', 'Maybe later', false]
  ]) {
    it(`restores both choices and lets the player retry ${action}`, async () => {
      startTraveler();
      approachTansy(1);
      const request = spyOn(globalThis, 'fetch').and.returnValues(
        Promise.reject(new TypeError('Simulated network failure')),
        Promise.resolve({ ok: true, json: async () => ({ introduced: true, frameOwned }) })
      );
      control('talk').click();
      control('ask').click();
      control(button).click();
      await Promise.resolve();
      expect(control('status').textContent).toContain('Could not confirm');
      expect(choices()).toEqual(['Take the frame', 'Maybe later']);
      expect(document.activeElement).toBe(control(button));
      expect(memory.introduced).toBeFalse();
      control(button).click();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(memory.introduced).toBeTrue();
      expect(memory.frameOwned).toBe(frameOwned);
      expect(request.calls.allArgs().map(([, options]) => JSON.parse(options.body))).toEqual(
        Array.from({ length: 2 }, () => ({ forestId: FOREST, ...(frameOwned ? { action: 'accept-frame' } : {}) }))
      );
      expect(control('dialog').open).toBe(frameOwned);
      if (frameOwned) expect(choices()).toEqual(['Leave']);
    });
  }

  it('lets a first-time visitor remember the clearing independently of the frame', async () => {
    startTraveler();
    approachTansy(1);
    const request = spyOn(globalThis, 'fetch').and.resolveTo({ ok: true, json: async () => ({ amberClearingClue: true }) });
    control('talk').click();
    control('road').click();
    expect(control('line').textContent).toContain('split stone');
    expect(choices()).toEqual(['Remember the clearing', 'Back']);
    control('remember').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(JSON.parse(request.calls.mostRecent().args[1].body)).toEqual({ forestId: FOREST, action: 'remember-amber-clearing' });
    expect(memory).toEqual({ forestId: FOREST, introduced: false, frameOwned: false, amberClearingClue: true });
    control('back').click();
    expect(choices()).toContain('Did you make that canopy?');
    control('road').click();
    expect(choices()).toEqual(['Back']);
  });

  it('keeps Tansy at the stall through an approach and return to the entrance', () => {
    const stall = provisionerSite({ route: [{ x: 400, y: 90 }, { x: 1600, y: 90 }] }, -1);
    startTraveler(() => stall);
    const [destination] = destinations();
    expect(destination).toEqual(jasmine.objectContaining({ ...stall.tansy, label: 'Tansy at the stall' }));
    expect(traveler.depthItems({ x: -160, y: -150, width: 500, height: 400 })).toEqual([]);
    expect(control('talk').hidden).toBeTrue();

    approachTansy(600);
    expect(control('talk').hidden).toBeFalse();
    expect(traveler.startConversation()).toBeTrue();
    expect(control('line').textContent).toContain('Name’s Tansy Rook');
    expect(choices()).toContain('Did you make that canopy?');
    traveler.close();

    player = spawn;
    traveler.update(1200);
    expect(destinations()).toEqual([destination]);
    expect(control('talk').hidden).toBeTrue();
  });

  it('recognizes a collected seed and offers optional planting guidance', () => {
    const navigate = jasmine.createSpy('navigate').and.returnValue(true);
    startTraveler(null, () => ({ stage: 'seed', names: ['Honey quince'], destination: 'orchard-plot-0' }), navigate);
    approachTansy(1);
    expect(traveler.startConversation()).toBeTrue();
    expect(control('line').textContent).toContain('where to plant it');
    expect(choices()).toContain('I brought back a seed');
    control('orchard-progress').click();
    expect(control('line').textContent).toContain('Honey quince');
    expect(choices()).toContain('Guide me to a planting spot');
    control('map-orchard').click();
    expect(navigate).toHaveBeenCalledOnceWith('orchard-plot-0');
    expect(control('dialog').open).toBeFalse();
  });
});

describe('Tansy’s resting spot', () => {
  const entrance = { worldX: 0, worldY: 0 };

  it('checks the cart and standing area, then tries another direction when the approach is blocked', () => {
    const clear = p => p.worldX < 180;
    const approachClear = p => p.worldY < 0;
    const site = findTravelerRestSite(entrance, clear, approachClear);
    expect(site.tansy.worldY).toBeLessThan(0);
    expect(site.footprint.every(clear)).toBeTrue();
    expect(findTravelerRestSite(entrance, clear, approachClear)).toEqual(site);
    expect(findTravelerRestSite(entrance, () => false, approachClear)).toBeNull();
  });

  it('stops the player at Tansy and the wagon while leaving room to approach and walk around', () => {
    const site = findTravelerRestSite(entrance, () => true, () => true);
    const { tansy, cart } = site;
    const playerAt = (worldX, worldY) => ({ worldX, worldY, radius: 11, movementSpeed: 108 });
    const move = (start, x, y, frames) => {
      let player = start;
      for (let i = 0; i < frames; i++) {
        player = moveOwnerForestPlayer(player, { x, y }, .05, [],
          (from, to) => !travelerBlocksMovement(site, to, from));
      }
      return player;
    };

    const nearTansy = move(playerAt(0, tansy.worldY), 1, 0, 50);
    expect(tansy.worldX - nearTansy.worldX).toBeGreaterThanOrEqual(23);
    expect(tansy.worldX - nearTansy.worldX).toBeLessThan(52);
    const around = move(move(nearTansy, 0, 1, 14), 1, 0, 35);
    expect(around.worldX).toBeGreaterThan(cart.worldX);

    const nearCart = move(playerAt(cart.worldX, cart.worldY + 80), 0, -1, 40);
    expect(nearCart.worldY - cart.worldY).toBeGreaterThan(20);
    expect(travelerBlocksMovement(site, playerAt(cart.worldX, cart.worldY))).toBeTrue();
    expect(travelerBlocksMovement(site, playerAt(cart.worldX, cart.worldY - 80),
      playerAt(cart.worldX, cart.worldY + 80))).toBeTrue();
    expect(travelerBlocksMovement(site, playerAt(tansy.worldX - 5, tansy.worldY),
      playerAt(tansy.worldX, tansy.worldY))).toBeFalse();
  });
});

describe('Tansy’s introduction save', () => {
  let updateOne, enabled, handle;

  beforeEach(() => {
    updateOne = jasmine.createSpy('updateOne').and.resolveTo({ matchedCount: 1 });
    enabled = jasmine.createSpy('enabled').and.returnValue(true);
    handle = buildForestTravelerRouteHandler({ WorldModel: { updateOne }, enabled });
  });

  async function post(changes = {}) {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; }
    };
    await handle({ user: { id: OWNER }, body: { forestId: FOREST }, query: {}, ...changes }, res);
    return { status: res.statusCode, body: res.body };
  }

  it('sets only the introduction on the authenticated owner’s active world and accepts identical retries', async () => {
    expect(await post()).toEqual({ status: 200, body: { introduced: true } });
    expect(await post()).toEqual({ status: 200, body: { introduced: true } });
    expect(updateOne.calls.allArgs()).toEqual(Array.from({ length: 2 }, () => [
      { ownerUserId: OWNER, forestId: FOREST, status: 'active', worldRole: 'primary', schemaVersion: { $in: [1, 2] } },
      { $set: { tansyIntroduced: true } }, { timestamps: false, runValidators: true }
    ]));
    updateOne.and.resolveTo({ matchedCount: 0 });
    expect((await post()).status).toBe(409);
  });

  it('rejects unauthenticated, forged and disabled requests before touching the world', async () => {
    expect((await post({ user: null })).status).toBe(401);
    expect((await post({ body: { forestId: FOREST, ownerUserId: OWNER } })).status).toBe(400);
    expect((await post({ body: { forestId: FOREST, action: 'grant-timber' } })).status).toBe(400);
    enabled.and.returnValue(false);
    expect((await post({ body: { forestId: FOREST, action: 'accept-frame' } })).status).toBe(403);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('grants one frame and records the introduction together, even on a retry before claiming a home', async () => {
    const body = { forestId: FOREST, action: 'accept-frame' };
    for (let retry = 0; retry < 2; retry++) {
      expect(await post({ body })).toEqual({ status: 200, body: { introduced: true, frameOwned: true } });
    }
    expect(updateOne.calls.allArgs()).toEqual(Array.from({ length: 2 }, () => [
      { ownerUserId: OWNER, forestId: FOREST, status: 'active', worldRole: 'primary', schemaVersion: { $in: [1, 2] } },
      { $set: { tansyIntroduced: true, tansyFrameAccepted: true } }, { timestamps: false, runValidators: true }
    ]));
  });

  it('remembers only the clearing clue and accepts retries independently of the frame', async () => {
    const body = { forestId: FOREST, action: 'remember-amber-clearing' };
    for (let retry = 0; retry < 2; retry++) {
      expect(await post({ body })).toEqual({ status: 200, body: { amberClearingClue: true } });
    }
    expect(updateOne.calls.allArgs().map(([, update]) => update)).toEqual([
      { $set: { tansyAmberClearingClue: true } }, { $set: { tansyAmberClearingClue: true } }
    ]);
  });
});

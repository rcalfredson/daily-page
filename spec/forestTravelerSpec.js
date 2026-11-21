import { findTravelerRestSite, travelerBlocksMovement } from '../public/js/forest-traveler.js';
import { moveOwnerForestPlayer } from '../public/js/owner-forest-scene.js';
import { buildForestTravelerRouteHandler } from '../server/api/v1/forestTraveler.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';

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
    enabled.and.returnValue(false);
    expect((await post()).status).toBe(403);
    expect(updateOne).not.toHaveBeenCalled();
  });
});

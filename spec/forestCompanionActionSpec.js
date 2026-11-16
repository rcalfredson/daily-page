import { createCompanionActor } from '../public/js/forest-companion-actor.js';
import { companionHarnessPose, companionPoseClear, planCompanionWalk, stepCompanionToward } from '../public/js/forest-companion-motion.js';
import { DEFAULT_CART_DESIGN } from '../public/js/forest-construction-design.js';
import { discIntersectsRectangle } from '../public/js/forest-cart-motion.js';

const cart = { worldX: 0, worldY: 0, heading: 0, design: DEFAULT_CART_DESIGN };
const body = { minX: -28, maxX: 28, minY: -20, maxY: 20 };
const clear = p => Math.abs(p.worldX) + p.radius < 500 && Math.abs(p.worldY) + p.radius < 500
  && !discIntersectsRectangle(p, body);
function scene(initial = null) {
  let time = 0, companion = initial;
  const player = { worldX: 0, worldY: 65 };
  const save = jasmine.createSpy('save').and.callFake(async event => {
    companion = { name: 'Mallow', stage: event === 'meet' ? 'acquainted' : 'joined' }; return true;
  });
  const notice = jasmine.createSpy('notice');
  const actor = createCompanionActor({ cart: () => cart, clear, save, notice, clock: () => time });
  const tick = async (seconds, options = {}) => {
    for (let i = 0; i < seconds * 60; i++) {
      time += 1000 / 60;
      const before = actor.snapshot();
      actor.update({ player, companion, elapsed: 1 / 60, time, ...options });
      const after = actor.snapshot();
      expect(Math.hypot(after.worldX - before.worldX, after.worldY - before.worldY)).toBeLessThan(2.01);
      expect(companionPoseClear(after, clear)).toBeTrue();
      await Promise.resolve();
    }
  };
  return { actor, player, save, notice, tick, companion: () => companion };
}

describe('physical companion interactions', () => {
  it('approaches the offered hand around the parked cart and saves only after contact', async () => {
    const s = scene();
    const start = s.actor.snapshot();
    expect(s.actor.act('meet', s.player, null)).toBeTrue();
    expect(s.actor.snapshot().gesture.type).toBe('offer');
    expect(s.save).not.toHaveBeenCalled();
    await s.tick(5);
    expect(s.save).toHaveBeenCalledOnceWith('meet');
    expect(s.companion().stage).toBe('acquainted');
    expect(Math.hypot(s.actor.snapshot().worldX - start.worldX, s.actor.snapshot().worldY - start.worldY)).toBeGreaterThan(20);
    expect(Math.abs(Math.hypot(s.actor.snapshot().worldX - s.player.worldX, s.actor.snapshot().worldY - s.player.worldY) - 35)).toBeLessThan(2);
  });
  it('lets walking away or cancelling end an unfinished gesture without granting acquaintance', async () => {
    const s = scene(); s.actor.act('meet', s.player, null); await s.tick(.1);
    s.player.worldY += 12; await s.tick(3);
    expect(s.save).not.toHaveBeenCalled(); expect(s.actor.snapshot().gesture).toBeNull();
    s.actor.act('meet', s.player, null); s.actor.cancel(); await s.tick(3);
    expect(s.save).not.toHaveBeenCalled();
  });
  it('supports scratching, following, waiting and physically returning to the harness', async () => {
    const s = scene({ name: 'Mallow', stage: 'acquainted' });
    s.actor.act('scratch', s.player, s.companion()); await s.tick(5);
    expect(s.save).not.toHaveBeenCalled();
    s.actor.act('follow', s.player, s.companion()); await s.tick(1);
    expect(s.save).toHaveBeenCalledOnceWith('invite');
    s.player.worldX = 140; await s.tick(5);
    expect(s.actor.snapshot().worldX).toBeGreaterThan(80);
    s.actor.act('follow', s.player, s.companion());
    const waited = s.actor.snapshot(); s.player.worldX += 25; await s.tick(2);
    expect(s.actor.snapshot().worldX).toBe(waited.worldX);
    s.actor.hitch(); await s.tick(8);
    expect(s.actor.ready).toBeTrue();
    expect(Math.abs(s.actor.snapshot().worldX - companionHarnessPose(cart).worldX)).toBeLessThan(2);
    expect(Math.abs(Math.atan2(Math.sin(s.actor.snapshot().heading), Math.cos(s.actor.snapshot().heading)))).toBeLessThan(.13);
  });
  it('recognizes a saved companion through an approach without another write, and pauses with the scene', async () => {
    const s = scene({ name: 'Mallow', stage: 'joined' }), start = s.actor.snapshot();
    await s.tick(2, { paused: true }); expect(s.actor.snapshot().worldY).toBe(start.worldY);
    await s.tick(5); expect(s.notice).toHaveBeenCalledWith('Mallow greets you.');
    expect(s.save).not.toHaveBeenCalled();
  });
  it('allows walking immediately after an invitation while its save is still pending', async () => {
    let resolve;
    const actor = createCompanionActor({ cart: () => cart, clear, notice: () => {}, clock: () => 0,
      save: () => new Promise(done => { resolve = done; }) });
    const player = { worldX: 0, worldY: 65 };
    actor.act('follow', player, { name: 'Mallow', stage: 'acquainted' });
    actor.walkAway(); actor.walkAway();
    expect(actor.snapshot().pending).toBeTrue();
    resolve(true); await Promise.resolve(); await Promise.resolve();
    expect(actor.snapshot().following).toBeTrue(); expect(actor.snapshot().pending).toBeFalse();
  });
  it('finds a short route around solid ground obstacles and bounds impossible or distant searches', () => {
    const wall = { minX: 35, maxX: 50, minY: -35, maxY: 35 };
    const allowed = p => !discIntersectsRectangle(p, wall);
    const path = planCompanionWalk({ worldX: 0, worldY: 0 }, { worldX: 100, worldY: 0 }, allowed);
    expect(path).not.toBeNull(); expect(path.some(p => Math.abs(p.worldY) > 45)).toBeTrue();
    let calls = 0;
    expect(planCompanionWalk({ worldX: 0, worldY: 0 }, { worldX: 100, worldY: 0 }, () => { calls++; return false; })).toBeNull();
    expect(calls).toBeLessThan(30);
    expect(planCompanionWalk({ worldX: 0, worldY: 0 }, { worldX: 999, worldY: 0 }, () => true)).toBeNull();
  });
  it('sweeps the animal body and stops at water or unavailable ground without jumping across it', () => {
    let pose = { worldX: 0, worldY: 0, heading: 0 };
    const allowed = p => p.worldX + p.radius < 45;
    for (let i = 0; i < 60; i++) pose = stepCompanionToward(pose, { worldX: 100, worldY: 0 }, 1, allowed).pose;
    expect(pose.worldX).toBeLessThan(24); expect(companionPoseClear(pose, allowed)).toBeTrue();
  });
  it('requires clear ground before boarding and clears stale blocked feedback on recovery', () => {
    let available = false;
    const actor = createCompanionActor({ cart: () => cart, clear: () => available,
      notice: () => {}, save: async () => true, clock: () => 0 });
    actor.hitch();
    actor.update({ player: { worldX: 0, worldY: 65 }, elapsed: .016, time: 16 });
    expect(actor.ready).toBeFalse(); expect(actor.snapshot().blocked).toBeTrue();
    available = true; actor.reset();
    expect(actor.snapshot().blocked).toBeFalse();
    actor.hitch(); actor.update({ player: { worldX: 0, worldY: 65 }, elapsed: .016, time: 32 });
    expect(actor.ready).toBeTrue();
  });
});

import { companionHarnessPose, companionPoseClear, planCompanionWalk, stepCompanionToward } from './forest-companion-motion.js';

const distance = (a, b) => Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY);
const angle = value => Math.atan2(Math.sin(value), Math.cos(value));

// Local presentation only. The existing save authority owns acquaintance and invitation facts.
export function createCompanionActor({ cart, clear, save, notice, clock = () => globalThis.performance.now() }) {
  let pose = companionHarnessPose(cart()), mode = 'rest', path = [], goal = null, plannedAt = -Infinity;
  let gesture = null, following = false, pending = false, contactAt = null, gait = 0, walking = false;
  let blocked = false, greeted = false, responseUntil = 0, sequence = 0;
  function reset() {
    pose = companionHarnessPose(cart()); mode = 'rest'; path = []; goal = null;
    gesture = null; following = false; contactAt = null; greeted = false;
    blocked = false; walking = false; responseUntil = 0; sequence++;
  }
  function cancel() {
    gesture = null; contactAt = null; blocked = false; sequence++;
    if (mode === 'approach') { mode = following ? 'follow' : 'rest'; path = []; goal = null; }
  }
  function walkAway() {
    // Walking after an invitation is the intended next action, even while its save is pending.
    if (gesture?.type === 'beckon') { gesture = null; return; }
    if (gesture || mode === 'approach') cancel();
  }
  function contactPoint(player) {
    const bearing = Math.atan2(pose.worldY - player.worldY, pose.worldX - player.worldX);
    for (const offset of [0, .5, -.5, 1, -1, 1.5, -1.5, Math.PI]) {
      const heading = bearing + offset;
      const p = { worldX: player.worldX + Math.cos(heading) * 35,
        worldY: player.worldY + Math.sin(heading) * 35, heading: heading + Math.PI };
      if (clear({ ...p, radius: 24 }) && companionPoseClear(p, clear)) return p;
    }
    return null;
  }
  async function commit(event, token) {
    pending = true;
    try {
      const success = await save(event);
      if (success && token === sequence) {
        if (event === 'invite') { following = true; mode = 'follow'; }
        notice(event === 'meet' ? 'Mallow.' : 'Mallow comes along.'); responseUntil = clock() + 1600;
      }
    } catch { notice('Could not remember that moment. Try again.'); }
    finally { pending = false; }
  }
  function act(kind, player, companion) {
    if (pending || distance(pose, player) > 120) return false;
    if (kind === 'follow' && !companion) return false;
    greeted = true;
    if (kind === 'follow') {
      cancel(); following = !following;
      if (following && companion?.stage !== 'joined') {
        if (!companion) return false;
        following = false; gesture = { type: 'beckon', origin: { ...player }, started: clock() };
        commit('invite', sequence);
      } else { mode = following ? 'follow' : 'rest'; notice(following ? 'Come along, Mallow.' : 'Mallow waits here.'); }
      return true;
    }
    const target = contactPoint(player);
    if (!target) { notice('A little more room to meet here.'); return false; }
    gesture = { type: kind === 'meet' ? 'offer' : 'scratch', origin: { ...player }, started: clock() };
    goal = target; path = []; plannedAt = -Infinity; contactAt = null; mode = 'approach'; sequence++;
    return true;
  }
  function hitch() {
    cancel(); following = false; mode = 'hitch'; path = []; goal = companionHarnessPose(cart()); plannedAt = -Infinity;
  }
  function update({ player, companion, elapsed, time, paused = false, mounted = false }) {
    walking = false;
    if (mounted) { pose = companionHarnessPose(cart()); mode = 'rest'; greeted = false; return; }
    if (paused) return;
    if (gesture?.finishing && time >= gesture.finishing) gesture = null;
    if (gesture && distance(player, gesture.origin) > 4) walkAway();
    if (gesture?.type === 'beckon' && time - gesture.started > 850) gesture = null;
    if (distance(player, pose) > 200) greeted = false;
    if (companion?.stage === 'joined' && !greeted && !gesture && mode === 'rest' && distance(player, pose) < 110) {
      greeted = true; goal = contactPoint(player); mode = goal ? 'reunion' : 'rest';
      path = []; plannedAt = -Infinity;
    }
    if (mode === 'reunion' && distance(player, pose) > 140) { mode = 'rest'; goal = null; }
    if (mode === 'follow') {
      if (distance(player, pose) < 48) { path = []; goal = null; return; }
      if (!goal || distance(goal, player) > 55) { goal = contactPoint(player); path = []; }
    }
    if (mode === 'hitch') goal = companionHarnessPose(cart());
    if (!goal || mode === 'rest') return;
    if (distance(pose, goal) > 1.5) {
      if (!path.length && time - plannedAt > 650) {
        path = planCompanionWalk(pose, goal, clear) || []; plannedAt = time;
        blocked = !path.length;
      }
      if (path.length) {
        const target = path[0];
        const moved = stepCompanionToward(pose, target, elapsed, clear, mode === 'approach' ? 65 : 116);
        pose = moved.pose; blocked = moved.blocked; walking = moved.distance > .01; gait += moved.distance * .16;
        if (blocked) path = [];
        else if (distance(pose, target) < 1.5) path.shift();
      }
      return;
    }
    const faced = stepCompanionToward(pose, { ...pose, heading: goal.heading }, elapsed, clear);
    pose = faced.pose; blocked = faced.blocked;
    if (blocked) return;
    if (Math.abs(angle((goal.heading ?? pose.heading) - pose.heading)) > .12) return;
    if (mode === 'hitch') { mode = 'ready'; return; }
    if (mode === 'reunion') { mode = 'rest'; responseUntil = time + 1600; notice('Mallow greets you.'); return; }
    if (mode === 'approach') {
      contactAt ??= time;
      if (time - contactAt > 700 && !pending) {
        const met = gesture?.type === 'offer';
        if (met && !companion) commit('meet', sequence);
        else notice('A contented lean.');
        responseUntil = time + 1800;
        gesture = gesture ? { ...gesture, finishing: time + 1200 } : null;
        mode = following ? 'follow' : 'rest'; goal = null;
      }
    }
  }
  return { act, update, cancel, walkAway, hitch, reset,
    stop() { cancel(); mode = 'rest'; following = false; goal = null; path = []; greeted = true; },
    get ready() { return mode === 'ready'; },
    snapshot: () => ({ ...pose, mode, following, pending, blocked, walking, gait,
      gesture: gesture && (!gesture.finishing || clock() < gesture.finishing) ? {
        type: gesture.type, facingRadians: Math.atan2(pose.worldY - gesture.origin.worldY, pose.worldX - gesture.origin.worldX),
        phase: (clock() - gesture.started) / 180
      } : null,
      responding: clock() < responseUntil })
  };
}

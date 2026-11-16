import { cartDefinition } from './forest-cart-motion.js';

const distance = (a, b) => Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY);
const angle = value => Math.atan2(Math.sin(value), Math.cos(value));
export function companionHarnessPose(cart) {
  const offset = cartDefinition(cart).animalOffset;
  return { worldX: cart.worldX + Math.cos(cart.heading) * offset,
    worldY: cart.worldY + Math.sin(cart.heading) * offset, heading: cart.heading };
}
export function companionPoseClear(pose, clear) {
  return [-10, 0, 10].every(offset => clear({
    worldX: pose.worldX + Math.cos(pose.heading) * offset,
    worldY: pose.worldY + Math.sin(pose.heading) * offset, radius: 11
  }));
}

// Short, bounded local paths. Unloaded terrain and blocked paths remain impassable.
export function planCompanionWalk(from, to, clear) {
  if (distance(from, to) > 360) return null;
  const segment = (a, b) => {
    const count = Math.max(1, Math.ceil(distance(a, b) / 6));
    for (let i = 0; i <= count; i++) if (!clear({ worldX: a.worldX + (b.worldX - a.worldX) * i / count,
      worldY: a.worldY + (b.worldY - a.worldY) * i / count, radius: 22 })) return false;
    return true;
  };
  if (segment(from, to)) return [{ ...to }];
  const origin = { x: 0, y: 0, worldX: from.worldX, worldY: from.worldY, cost: 0, parent: null };
  const open = [origin], seen = new Map([['0:0', origin]]), closed = new Set();
  for (let visited = 0; open.length && visited < 384; visited++) {
    open.sort((a, b) => a.cost + distance(a, to) - b.cost - distance(b, to));
    const current = open.shift(), key = `${current.x}:${current.y}`;
    if (closed.has(key)) continue;
    closed.add(key);
    if (distance(current, to) < 18 && segment(current, to)) {
      const path = [{ ...to }];
      for (let node = current; node.parent; node = node.parent) path.unshift({ worldX: node.worldX, worldY: node.worldY });
      return path;
    }
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
      if (!x && !y) continue;
      const next = { x: current.x + x, y: current.y + y,
        worldX: current.worldX + x * 12, worldY: current.worldY + y * 12,
        cost: current.cost + Math.hypot(x, y) * 12, parent: current };
      const nextKey = `${next.x}:${next.y}`;
      if (closed.has(nextKey) || next.cost >= (seen.get(nextKey)?.cost ?? Infinity)
        || distance(from, next) > 384 || !segment(current, next)) continue;
      seen.set(nextKey, next); open.push(next);
    }
  }
  return null;
}

export function stepCompanionToward(from, target, elapsed, clear, speed = 100) {
  const dt = Math.max(0, Math.min(.05, elapsed)), remaining = distance(from, target);
  const desired = remaining > 1 ? Math.atan2(target.worldY - from.worldY, target.worldX - from.worldX)
    : target.heading ?? from.heading;
  const turn = Math.max(-5 * dt, Math.min(5 * dt, angle(desired - from.heading)));
  const heading = from.heading + turn;
  const travel = Math.min(remaining, speed * dt * Math.max(0, Math.cos(angle(desired - heading))));
  const next = { worldX: from.worldX + Math.cos(desired) * travel,
    worldY: from.worldY + Math.sin(desired) * travel, heading };
  const steps = Math.max(1, Math.ceil((travel + Math.abs(turn) * 21) / 2));
  for (let i = 1; i <= steps; i++) {
    if (!companionPoseClear({ worldX: from.worldX + (next.worldX - from.worldX) * i / steps,
      worldY: from.worldY + (next.worldY - from.worldY) * i / steps,
      heading: from.heading + turn * i / steps }, clear)) return { pose: from, distance: 0, blocked: true };
  }
  return { pose: next, distance: travel, blocked: false };
}

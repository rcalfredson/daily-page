// Bounded vehicle geometry shared by the development study and its Node checks.
// No durable state, resource authority or terrain-generation changes.
import { constructionCartGeometry } from './forest-construction-design.js';
export const CART_STUDY_VARIANTS = Object.freeze({
  compact: Object.freeze({ halfLength: 18, halfWidth: 12, animalOffset: 48, speed: 224 }),
  canopy: Object.freeze({ halfLength: 26, halfWidth: 18, animalOffset: 62, speed: 224 })
});
export const CART_TURN_RATE = 2.6;
export const CART_SWEEP_STEP = 2;
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function cartDefinition(id) {
  if (typeof id === 'object' && id !== null) {
    if (id.design) return constructionCartGeometry(id.design);
    id = id.variant;
  }
  const definition = CART_STUDY_VARIANTS[id];
  if (!definition) throw new Error('Unknown cart study variant.');
  return definition;
}

export function cartFootprint(cart) {
  const d = cartDefinition(cart);
  if (![cart.worldX, cart.worldY, cart.heading].every(Number.isFinite)) throw new Error('Invalid cart pose.');
  const local = [];
  const count = Math.ceil(d.halfLength * 2 / 12);
  for (let i = 0; i <= count; i++) {
    local.push({ offset: -d.halfLength + d.halfLength * 2 * i / count, radius: d.halfWidth + 2 });
  }
  for (let offset = d.halfLength; offset < d.animalOffset; offset += 8) local.push({ offset, radius: 6 });
  local.push({ offset: d.animalOffset - 8, radius: 11 }, { offset: d.animalOffset + 8, radius: 10 });
  return local.map(({ offset, radius }) => ({
    worldX: cart.worldX + Math.cos(cart.heading) * offset,
    worldY: cart.worldY + Math.sin(cart.heading) * offset, radius
  }));
}

export function cartPoseClear(cart, clearDisc) {
  return cartFootprint(cart).every(clearDisc);
}

// Cover translation AND rotating extremities, with conservative overlap between poses.
export function cartSweepClear(from, to, clearDisc) {
  const fromDefinition = cartDefinition(from), toDefinition = cartDefinition(to);
  if (Object.keys(fromDefinition).some(key => fromDefinition[key] !== toDefinition[key])) return false;
  const reach = fromDefinition.animalOffset + 18;
  const distance = Math.hypot(to.worldX - from.worldX, to.worldY - from.worldY);
  const turn = angleDelta(from.heading, to.heading);
  const steps = Math.max(1, Math.ceil((distance + Math.abs(turn) * reach) / CART_SWEEP_STEP));
  if (steps > 256) return false;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!cartPoseClear({ ...from,
      worldX: from.worldX + (to.worldX - from.worldX) * t,
      worldY: from.worldY + (to.worldY - from.worldY) * t,
      heading: from.heading + turn * t
    }, p => clearDisc({ ...p, radius: p.radius + CART_SWEEP_STEP / 2 }))) return false;
  }
  return true;
}

export function stepForestCart(cart, input, elapsedSeconds, clearDisc) {
  const d = cartDefinition(cart);
  if (![input.x, input.y, elapsedSeconds].every(Number.isFinite)) throw new Error('Invalid cart input.');
  const dt = Math.max(0, Math.min(0.1, elapsedSeconds));
  const magnitude = Math.min(1, Math.hypot(input.x, input.y));
  if (!magnitude || !dt) return { cart, blocked: false, distance: 0 };
  const target = Math.atan2(input.y, input.x) + (input.reverse ? Math.PI : 0);
  const delta = angleDelta(cart.heading, target);
  const turn = Math.max(-CART_TURN_RATE * dt, Math.min(CART_TURN_RATE * dt, delta));
  const turned = { ...cart, heading: cart.heading + turn };
  let next = cartSweepClear(cart, turned, clearDisc) ? turned : cart;
  const alignment = Math.max(0, Math.cos(angleDelta(next.heading, target)));
  const travel = d.speed * dt * magnitude * alignment * (input.reverse ? -0.6 : 1);
  const destination = { ...next,
    worldX: next.worldX + Math.cos(next.heading) * travel,
    worldY: next.worldY + Math.sin(next.heading) * travel
  };
  const steps = Math.max(1, Math.ceil(Math.abs(travel) / CART_SWEEP_STEP));
  let blocked = next === cart && Math.abs(turn) > 0.0001;
  for (let i = 1; i <= steps; i++) {
    const candidate = { ...next,
      worldX: turned.worldX + (destination.worldX - turned.worldX) * i / steps,
      worldY: turned.worldY + (destination.worldY - turned.worldY) * i / steps
    };
    if (!cartSweepClear(next, candidate, clearDisc)) { blocked = true; break; }
    next = candidate;
  }
  return { cart: next, blocked, distance: Math.hypot(next.worldX - cart.worldX, next.worldY - cart.worldY) };
}

export function discIntersectsRectangle(p, rect) {
  const dx = Math.max(rect.minX - p.worldX, 0, p.worldX - rect.maxX);
  const dy = Math.max(rect.minY - p.worldY, 0, p.worldY - rect.maxY);
  return Math.hypot(dx, dy) <= p.radius;
}

export function cartDismount(cart, clearDisc, radius = 11) {
  const d = cartDefinition(cart);
  for (const along of [0, -d.halfLength - 22, d.halfLength + 12]) {
    for (const side of [1, -1]) {
      const across = side * (d.halfWidth + radius + 12);
      const p = {
        worldX: cart.worldX + Math.cos(cart.heading) * along - Math.sin(cart.heading) * across,
        worldY: cart.worldY + Math.sin(cart.heading) * along + Math.cos(cart.heading) * across, radius
      };
      if (!clearDisc(p) || cartFootprint(cart).some(c => Math.hypot(c.worldX - p.worldX,
        c.worldY - p.worldY) < c.radius + radius)) continue;
      // Terrain/house clearance all the way from the passenger's position.
      const steps = Math.ceil(Math.hypot(along, across) / 2);
      if (Array.from({ length: steps + 1 }, (_, i) => ({
        worldX: cart.worldX + (p.worldX - cart.worldX) * i / steps,
        worldY: cart.worldY + (p.worldY - cart.worldY) * i / steps, radius
      })).every(clearDisc)) return p;
    }
  }
  return null;
}

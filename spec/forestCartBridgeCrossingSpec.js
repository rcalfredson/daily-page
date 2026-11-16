import { stepForestCart, cartPoseClear } from '../public/js/forest-cart-motion.js';
import { DEFAULT_CART_DESIGN } from '../public/js/forest-construction-design.js';
import { queryOwnerTerrain, sampleOwnerTerrain } from '../public/js/owner-forest-terrain-authority.js';

const seed = 'abcdefghijklmnopqrstuvwxyzABCDEF';
function crossings(generationVersion) {
  const scene = queryOwnerTerrain({ seed, generationVersion, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } });
  return generationVersion === 4 ? scene.features.flatMap(f => f.bridges) : scene.districts.map(d => d.bridge).filter(Boolean);
}
function route(generationVersion, bridge, design, offset = 0, reverse = false) {
  const scene = queryOwnerTerrain({ seed, generationVersion, bounds: { minX: bridge.x - 450,
    maxX: bridge.x + 450, minY: bridge.y - 450, maxY: bridge.y + 450 } });
  const clear = p => sampleOwnerTerrain(scene, { x: p.worldX, y: p.worldY }, p.radius).walkable;
  const start = bridge.halfLength + 150;
  let cart = { design, heading: Math.atan2(bridge.uy, bridge.ux) + (reverse ? Math.PI : 0),
    worldX: bridge.x - bridge.ux * start - bridge.uy * offset,
    worldY: bridge.y - bridge.uy * start + bridge.ux * offset };
  let blocked = false;
  for (let i = 0; i < Math.ceil(2 * start / 3.6) + 1; i++) {
    const step = stepForestCart(cart, { x: 0, y: reverse ? 1 : -1, precision: true }, .05, clear);
    cart = step.cart; blocked ||= step.blocked;
  }
  return { cart, blocked, clear, progress: (cart.worldX - bridge.x) * bridge.ux + (cart.worldY - bridge.y) * bridge.uy };
}

describe('careful cart driving across footbridges', () => {
  it('allows all offered widths and lengths across an angled bridge using its actual generation-3/4 terrain', () => {
    for (const generation of [3, 4]) for (const width of [24, 30, 36]) for (const length of [36, 44, 52]) {
      const b = crossings(generation)[0];
      const result = route(generation, b, { ...DEFAULT_CART_DESIGN, width, length }, 1);
      expect(result.blocked).toBeFalse(); expect(result.progress).toBeGreaterThan(b.halfLength + 145);
      expect(cartPoseClear(result.cart, result.clear)).toBeTrue();
    }
  });
  it('lets narrow carts cross each regional bridge forwards and backwards', () => {
    for (const b of crossings(4)) for (const reverse of [false, true]) {
      const result = route(4, b, { ...DEFAULT_CART_DESIGN, width: 24, length: 36 }, 0, reverse);
      expect(result.blocked).toBeFalse(); expect(result.progress).toBeGreaterThan(b.halfLength + 145);
    }
  });
  it('still blocks water beside the bridge rather than granting careful driving extra clearance', () => {
    const b = crossings(4)[0], result = route(4, b, DEFAULT_CART_DESIGN, b.halfWidth + 30);
    expect(result.blocked).toBeTrue(); expect(result.progress).toBeLessThan(b.halfLength);
  });
  it('steers without rolling, preserves arbitrary headings when rolling, and keeps large steps bounded', () => {
    const cart = { design: DEFAULT_CART_DESIGN, heading: .38, worldX: 0, worldY: 0 };
    const turned = stepForestCart(cart, { x: 1, y: 0, precision: true }, .05, () => true);
    expect(turned.distance).toBe(0); expect(turned.cart.heading).toBeCloseTo(.425, 5);
    const rolled = stepForestCart(cart, { x: 0, y: -1, precision: true }, 100, () => true);
    expect(rolled.cart.heading).toBe(cart.heading); expect(rolled.distance).toBeCloseTo(7.2, 5);
    const blocked = stepForestCart(cart, { x: 1, y: -1, precision: true }, .05, () => false);
    expect(blocked.cart).toEqual(cart); expect(blocked.blocked).toBeTrue();
  });
});

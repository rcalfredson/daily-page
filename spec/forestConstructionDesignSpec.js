import { DEFAULT_CART_DESIGN, DEFAULT_HOME_DESIGN, CART_DESIGN_OPTIONS, HOME_DESIGN_OPTIONS,
  validateConstructionDesign, constructionCartGeometry, constructionHomeFootprint, advanceCartPresentation
} from '../public/js/forest-construction-design.js';
import { cartFootprint, cartPoseClear, cartSweepClear, stepForestCart } from '../public/js/forest-cart-motion.js';
import { queryOwnerTerrain, sampleOwnerTerrain } from '../public/js/owner-forest-terrain-authority.js';
import { STUDY_SEEDS } from '../scripts/lib/forestHomeCartStudy.js';

describe('bounded construction designs', () => {
  it('rejects unknown versions, missing or extra fields, unsupported parts and out-of-bounds dimensions', () => {
    for (const [kind, base] of [['home', DEFAULT_HOME_DESIGN], ['cart', DEFAULT_CART_DESIGN]]) {
      expect(validateConstructionDesign(kind, base)).toBeTrue();
      for (const change of [{ version: 2 }, { extra: true }, { width: 1000 }, { width: NaN }, { width: '36' }]) {
        expect(validateConstructionDesign(kind, { ...base, ...change })).toBeFalse();
      }
      const missing = { ...base }; delete missing.width;
      expect(validateConstructionDesign(kind, missing)).toBeFalse();
      expect(validateConstructionDesign(kind, null)).toBeFalse();
    }
    expect(validateConstructionDesign('cart', { ...DEFAULT_CART_DESIGN, wheels: 'jet' })).toBeFalse();
    expect(validateConstructionDesign('castle', DEFAULT_HOME_DESIGN)).toBeFalse();
    expect(() => constructionCartGeometry({ ...DEFAULT_CART_DESIGN, length: 300 })).toThrow();
  });
  it('holds the house door and all supported footprints inside the original reserved structure', () => {
    const home = { x: 400, y: -800 };
    for (const [width] of HOME_DESIGN_OPTIONS.width) for (const [depth] of HOME_DESIGN_OPTIONS.depth) {
      const r = constructionHomeFootprint(home, { ...DEFAULT_HOME_DESIGN, width, depth });
      expect(r.minX).toBeGreaterThanOrEqual(home.x - 90); expect(r.maxX).toBeLessThanOrEqual(home.x + 90);
      expect(r.minY).toBeGreaterThanOrEqual(home.y - 135); expect(r.maxY).toBe(home.y - 35);
    }
  });
  it('keeps finishes and compatible attachments independent of collision and speed', () => {
    const expected = constructionCartGeometry(DEFAULT_CART_DESIGN);
    for (const key of ['body', 'wheels', 'supports', 'canopy', 'wood', 'cloth']) {
      for (const [value] of CART_DESIGN_OPTIONS[key]) {
        expect(constructionCartGeometry({ ...DEFAULT_CART_DESIGN, [key]: value })).toEqual(expected);
      }
    }
  });
  it('covers every supported cart size and maintains the terrain sampling bound', () => {
    for (const [length] of CART_DESIGN_OPTIONS.length) for (const [width] of CART_DESIGN_OPTIONS.width) {
      const design = { ...DEFAULT_CART_DESIGN, length, width };
      const d = constructionCartGeometry(design);
      expect(d.halfLength).toBeLessThanOrEqual(26); expect(d.halfWidth).toBeLessThanOrEqual(18);
      expect(d.animalOffset).toBeLessThanOrEqual(62);
      for (const heading of [0, .6, Math.PI / 2, 2.6, Math.PI, 4.8]) {
        const pose = { design, worldX: 0, worldY: 0, heading }, discs = cartFootprint(pose);
        expect(discs.every(p => p.radius <= 24)).toBeTrue();
        for (const x of [-d.halfLength, 0, d.halfLength]) for (const y of [-d.halfWidth, d.halfWidth]) {
          const wx = Math.cos(heading) * x - Math.sin(heading) * y, wy = Math.sin(heading) * x + Math.cos(heading) * y;
          expect(discs.some(p => Math.hypot(wx - p.worldX, wy - p.worldY) <= p.radius)).toBeTrue();
        }
      }
    }
  });
  it('does not sweep a changing footprint through the world as if it were an ordinary move', () => {
    const pose = { design: DEFAULT_CART_DESIGN, worldX: 0, worldY: 0, heading: 0 };
    expect(cartSweepClear(pose, { ...pose, design: { ...pose.design, length: 36 } }, () => true)).toBeFalse();
  });
  for (const generationVersion of [3, 4]) it(`fits all supported cart sizes on a generation ${generationVersion} bridge`, () => {
    const args = { generationVersion, seed: STUDY_SEEDS[0], records: [] };
    const initial = queryOwnerTerrain({ ...args, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } });
    const b = generationVersion === 3 ? initial.districts[0].bridge : initial.features[0].bridges[0];
    const scene = queryOwnerTerrain({ ...args, bounds: { minX: b.x - 130, maxX: b.x + 130, minY: b.y - 130, maxY: b.y + 130 } });
    const clear = p => sampleOwnerTerrain(scene, { x: p.worldX, y: p.worldY }, p.radius).walkable;
    for (const [length] of CART_DESIGN_OPTIONS.length) for (const [width] of CART_DESIGN_OPTIONS.width) {
      const pose = { design: { ...DEFAULT_CART_DESIGN, length, width }, worldX: b.x, worldY: b.y, heading: Math.atan2(b.uy, b.ux) };
      expect(cartPoseClear(pose, clear)).toBeTrue();
      expect(cartPoseClear({ ...pose, worldX: b.x - b.uy * 60, worldY: b.y + b.ux * 60 }, clear)).toBeFalse();
    }
  });
});

describe('cart travel presentation', () => {
  const from = { design: DEFAULT_CART_DESIGN, worldX: 0, worldY: 0, heading: 0 };
  const state = { wheel: 3, gait: 4 };
  it('advances with actual travel, reverses with backing up and stays still against an obstacle', () => {
    const forward = stepForestCart(from, { x: 1, y: 0 }, .05, () => true).cart;
    const back = stepForestCart(from, { x: -1, y: 0, reverse: true }, .05, () => true).cart;
    const blocked = stepForestCart(from, { x: 1, y: 0 }, .05, () => false).cart;
    expect(advanceCartPresentation(state, from, forward).wheel).toBeGreaterThan(state.wheel);
    expect(advanceCartPresentation(state, from, back).wheel).toBeLessThan(state.wheel);
    expect(advanceCartPresentation(state, from, blocked)).toEqual(state);
    expect(advanceCartPresentation(state, from, { ...from, heading: .8 })).toEqual(state);
  });
  it('keeps animation independent of frame subdivision and disables it for reduced motion', () => {
    const mid = { ...from, worldX: 10 }, to = { ...from, worldX: 30 };
    const whole = advanceCartPresentation(state, from, to);
    const split = advanceCartPresentation(advanceCartPresentation(state, from, mid), mid, to);
    expect(split.wheel).toBeCloseTo(whole.wheel, 10); expect(split.gait).toBeCloseTo(whole.gait, 10);
    expect(advanceCartPresentation(state, from, to, true)).toEqual({ wheel: 0, gait: 0 });
  });
});

import { cartFootprint, cartPoseClear, cartSweepClear, cartDismount, stepForestCart,
  discIntersectsRectangle, CART_STUDY_VARIANTS } from '../public/js/forest-cart-motion.js';
import { createHomeStudyFixture, planHomeCartSite, STUDY_SEEDS, HOME_STUDY_LIMITS } from '../scripts/lib/forestHomeCartStudy.js';
import { queryOwnerTerrain, sampleOwnerTerrain } from '../public/js/owner-forest-terrain-authority.js';
import { createOwnerForestTerrainScene } from '../public/js/owner-forest-terrain-scene.js';

const cart = (variant = 'canopy') => ({ variant, worldX: 0, worldY: 0, heading: 0 });
const pointClear = obstacle => p => Math.hypot(p.worldX - obstacle.x, p.worldY - obstacle.y) > p.radius;

describe('home/cart movement study', () => {
  it('covers body corners, shafts and animal with supported small discs at every heading', () => {
    for (const variant of Object.keys(CART_STUDY_VARIANTS)) for (const heading of [0, .7, 1.8, 3.1]) {
      const d = CART_STUDY_VARIANTS[variant], pose = { ...cart(variant), heading };
      const discs = cartFootprint(pose);
      expect(discs.every(p => p.radius <= 24)).toBeTrue();
      for (const [x, y] of [[-d.halfLength, -d.halfWidth], [d.halfLength, d.halfWidth],
        [d.halfLength + 10, 0], [d.animalOffset + 12, 0]]) {
        const world = { x: Math.cos(heading) * x - Math.sin(heading) * y,
          y: Math.sin(heading) * x + Math.cos(heading) * y };
        expect(discs.some(p => Math.hypot(world.x - p.worldX, world.y - p.worldY) <= p.radius)).toBeTrue();
      }
    }
  });
  it('rejects a translation through a thin obstacle even when both endpoints clear it', () => {
    const a = cart(), b = { ...a, worldX: 200 }, clear = pointClear({ x: 110, y: 0 });
    expect(cartPoseClear(a, clear)).toBeTrue(); expect(cartPoseClear(b, clear)).toBeTrue();
    expect(cartSweepClear(a, b, clear)).toBeFalse();
  });
  it('sweeps the animal through turns instead of checking only the chassis or endpoints', () => {
    const a = cart(), b = { ...a, heading: Math.PI / 2 }, clear = pointClear({ x: 48, y: 48 });
    expect(cartPoseClear(a, clear)).toBeTrue(); expect(cartPoseClear(b, clear)).toBeTrue();
    expect(cartSweepClear(a, b, clear)).toBeFalse();
  });
  it('stops before an unloaded boundary and resumes after it becomes available', () => {
    let pose = cart();
    for (let i = 0; i < 100; i++) pose = stepForestCart(pose, { x: 1, y: 0 }, .05,
      p => p.worldX + p.radius < 200).cart;
    expect(Math.max(...cartFootprint(pose).map(p => p.worldX + p.radius))).toBeLessThan(200);
    const next = stepForestCart(pose, { x: 1, y: 0 }, .05, () => true);
    expect(next.cart.worldX).toBeGreaterThan(pose.worldX);
  });
  it('clamps a suspended frame and supports backing up without a turn', () => {
    const a = cart();
    expect(stepForestCart(a, { x: 1, y: 0 }, 100, () => true).distance).toBeLessThanOrEqual(22.400001);
    const backwards = stepForestCart(a, { x: -1, y: 0, reverse: true }, .05, () => true).cart;
    expect(backwards.worldX).toBeLessThan(0); expect(Math.abs(backwards.heading)).toBeLessThan(.0001);
    expect(stepForestCart(a, { x: 0, y: 0 }, .05, () => true).cart).toEqual(a);
  });
  it('finds a clear dismount on the other side and refuses to teleport across a barrier', () => {
    const pose = cart();
    const p = cartDismount(pose, disc => disc.worldY - disc.radius < 15);
    expect(p.worldY).toBeLessThan(0);
    expect(cartFootprint(pose).every(c => Math.hypot(c.worldX - p.worldX, c.worldY - p.worldY) >= c.radius + p.radius)).toBeTrue();
    expect(cartDismount(pose, () => false)).toBeNull();
  });
  it('checks rectangle corners and large cart clearance in narrow passages', () => {
    const rect = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    expect(discIntersectsRectangle({ worldX: -7, worldY: -7, radius: 11 }, rect)).toBeTrue();
    expect(discIntersectsRectangle({ worldX: -9, worldY: -9, radius: 11 }, rect)).toBeFalse();
    const passage = p => Math.abs(p.worldY) + p.radius < 18;
    expect(cartPoseClear(cart('compact'), passage)).toBeTrue();
    expect(cartPoseClear(cart('canopy'), passage)).toBeFalse();
  });
  for (const generationVersion of [3, 4]) {
    it(`uses generation ${generationVersion} bridge and water authority for the whole cart`, () => {
      const args = { generationVersion, seed: STUDY_SEEDS[0], records: [] };
      const initial = queryOwnerTerrain({ ...args, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } });
      const b = generationVersion === 3 ? initial.districts[0].bridge : initial.features[0].bridges[0];
      const scene = queryOwnerTerrain({ ...args, bounds: { minX: b.x - 130, maxX: b.x + 130, minY: b.y - 130, maxY: b.y + 130 } });
      const clear = p => sampleOwnerTerrain(scene, { x: p.worldX, y: p.worldY }, p.radius).walkable;
      const pose = { ...cart(), worldX: b.x, worldY: b.y, heading: Math.atan2(b.uy, b.ux) };
      expect(cartPoseClear(pose, clear)).toBeTrue();
      expect(cartSweepClear(pose, { ...pose, heading: pose.heading + Math.PI / 2 }, clear)).toBeFalse();
      expect(cartPoseClear({ ...pose, worldX: b.x - b.uy * 60, worldY: b.y + b.ux * 60 }, clear)).toBeFalse();
    });
  }
  it('cannot drive into a scene whose terrain response has the wrong activation token', async () => {
    const terrain = createOwnerForestTerrainScene({ descriptor: { schemaVersion: 1, generationVersion: 3,
      districtSize: 1920, token: 'a9300000-0000-4000-8000-000000000002:1', regionPath: '/api/v1/forest/terrain-regions' },
    fetchRegion: async () => ({ schemaVersion: 1, generationVersion: 3, token: 'changed', districts: [] }) });
    await expectAsync(terrain.ensure({ worldX: 0, worldY: 0 })).toBeRejected();
    expect(stepForestCart(cart(), { x: 1, y: 0 }, .1, p => terrain.sample(p).walkable).cart).toEqual(cart());
  });
});

describe('bounded, non-publishing home geography study', () => {
  for (const generation of [0, 3, 4]) {
    it(`finds a repeatable connected site on the representative generation ${generation} fixture`, () => {
      const fixture = createHomeStudyFixture({ generation });
      const before = JSON.stringify(fixture.obstacles), first = planHomeCartSite(fixture), second = planHomeCartSite(fixture);
      expect(first.status).toBe('ready'); expect(second.home).toEqual(first.home);
      expect(second.route).toEqual(first.route); expect(JSON.stringify(fixture.obstacles)).toBe(before);
      expect(first.metrics.homeAttempts).toBeLessThanOrEqual(HOME_STUDY_LIMITS.homeCandidates);
      expect(first.metrics.terrainSamples).toBeLessThanOrEqual(HOME_STUDY_LIMITS.terrainSamples);
      for (const path of [first.approach, first.route]) for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i], steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
        for (let j = 0; j <= steps; j++) {
          expect(discIntersectsRectangle({ worldX: a.x + (b.x - a.x) * j / steps,
            worldY: a.y + (b.y - a.y) * j / steps, radius: 11 }, first.house)).toBeFalse();
        }
      }
    });
    it(`reports impossible generation ${generation} geography without publishing anything`, () => {
      const result = planHomeCartSite(createHomeStudyFixture({ generation, occupancy: 'blocked' }));
      expect(result.status).toBe('unavailable'); expect(result.home).toBeUndefined();
      expect(result.metrics.homeAttempts).toBe(32);
    });
  }
  it('distinguishes a budget stop from proof that no site exists', () => {
    const result = planHomeCartSite(createHomeStudyFixture(), { terrainSamples: 2 });
    expect(result.reason).toBe('sample-budget-exhausted'); expect(result.metrics.terrainSamples).toBe(2);
  });
  it('does not route an entrance approach through a northern house', () => {
    const result = planHomeCartSite(createHomeStudyFixture({ generation: 4, seed: STUDY_SEEDS[1] }));
    expect(result.status).toBe('ready');
    for (const p of result.approach) expect(discIntersectsRectangle({ worldX: p.x, worldY: p.y, radius: 11 }, result.house)).toBeFalse();
  });
});

import { homeLayoutFromPlan, homePlacementAllowed, homeTerrainBounds, validateHomeLayout } from '../public/js/forest-home-reservations.js';
import { createHomeStudyFixture, planHomeCartSite } from '../scripts/lib/forestHomeCartStudy.js';
import { replaceConstructionCommitment, checkConstructionRevision } from '../server/services/forestConstructionAccounting.js';

describe('home reservation contract', () => {
  const layout = () => homeLayoutFromPlan(planHomeCartSite(createHomeStudyFixture({ generation: 0 })));
  it('retains a bounded, versioned layout independent of the mutable planning result', () => {
    const plan = planHomeCartSite(createHomeStudyFixture({ generation: 0 }));
    const saved = homeLayoutFromPlan(plan);
    plan.home.x += 1; plan.route[0].x += 1;
    expect(validateHomeLayout(saved)).toBeTrue();
    expect(saved.home.x).not.toBe(plan.home.x);
    expect(() => homeLayoutFromPlan({ status: 'unavailable' })).toThrowError('HOME_SITE_UNAVAILABLE');
  });
  it('rejects unknown layouts, detached roads and unbounded or diagonal paths', () => {
    const valid = layout();
    for (const value of [{ ...valid, version: 2 }, { ...valid, extra: true },
      { ...valid, route: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { ...valid, parking: { x: 0, y: NaN } },
      { ...valid, route: [valid.parking, { x: valid.parking.x + 99999, y: valid.parking.y }] }]) {
      expect(validateHomeLayout(value)).toBeFalse();
      expect(() => homePlacementAllowed(value, { x: 0, y: 0, radius: 9, writer: 'garden' })).toThrow();
    }
  });
  it('protects the largest structure even when a smaller house is selected', () => {
    const saved = layout();
    for (const writer of ['writing', 'garden', 'marker']) {
      expect(homePlacementAllowed(saved, { x: saved.home.x + 89, y: saved.home.y - 70, radius: 9, writer })).toBeFalse();
    }
  });
  it('allows gardening in the yard while keeping generated writing out', () => {
    const saved = layout(), p = { x: saved.home.x + 135, y: saved.home.y - 60, radius: 9 };
    expect(homePlacementAllowed(saved, { ...p, writer: 'garden' })).toBeTrue();
    expect(homePlacementAllowed(saved, { ...p, writer: 'marker' })).toBeTrue();
    expect(homePlacementAllowed(saved, { ...p, writer: 'writing' })).toBeFalse();
  });
  it('includes object radius and protects passage at endpoints and corners', () => {
    const saved = layout(), end = saved.route.at(-1);
    for (const writer of ['writing', 'garden', 'marker']) {
      expect(homePlacementAllowed(saved, { x: end.x, y: end.y + 90, radius: 9, writer })).toBeFalse();
      expect(homePlacementAllowed(saved, { x: end.x, y: end.y + 95, radius: 9, writer })).toBeTrue();
      expect(homePlacementAllowed(saved, { x: saved.parking.x, y: saved.parking.y, radius: 9, writer })).toBeFalse();
    }
  });
  for (const generation of [0, 3, 4]) it(`represents generation ${generation} plans with bounded terrain query coverage`, () => {
    const saved = homeLayoutFromPlan(planHomeCartSite(createHomeStudyFixture({ generation })));
    const bounds = homeTerrainBounds(saved);
    for (const p of [...saved.route, ...saved.approach]) {
      expect(p.x - 84).toBeGreaterThanOrEqual(bounds.minX);
      expect(p.y + 84).toBeLessThanOrEqual(bounds.maxY);
    }
  });
  it('rejects unsupported writer kinds and malformed placement queries', () => {
    for (const query of [{ x: 0, y: 0, radius: -1, writer: 'garden' },
      { x: Infinity, y: 0, radius: 9, writer: 'garden' }, { x: 0, y: 0, radius: 9, writer: 'unknown' }]) {
      expect(() => homePlacementAllowed(layout(), query)).toThrow();
    }
  });
});

describe('construction material commitments', () => {
  const base = () => ({ holdings: { timber: 20, cloth: 5 }, previousCommitment: { timber: 10, cloth: 2 },
    nextCost: { timber: 15, cloth: 1 }, capacity: { timber: 100, cloth: 30 } });
  it('refunds recorded costs and commits the replacement without mutating the inputs', () => {
    const input = base(), before = JSON.stringify(input), next = replaceConstructionCommitment(input);
    expect(next).toEqual({ holdings: { timber: 15, cloth: 6 }, commitment: { timber: 15, cloth: 1 } });
    expect(JSON.stringify(input)).toBe(before);
    const refund = replaceConstructionCommitment({ ...input, holdings: next.holdings, previousCommitment: next.commitment, nextCost: {} });
    expect(refund.holdings).toEqual({ timber: 30, cloth: 7 });
  });
  it('cannot create material through repeated redesigns or changed prices', () => {
    let state = base();
    for (let i = 0; i < 100; i++) {
      const nextCost = i % 2 ? { timber: 1, cloth: 7 } : { timber: 30, cloth: 0 };
      const next = replaceConstructionCommitment({ ...state, nextCost });
      expect(next.holdings.timber + (next.commitment.timber || 0)).toBe(30);
      expect(next.holdings.cloth + (next.commitment.cloth || 0)).toBe(7);
      state = { ...state, holdings: next.holdings, previousCommitment: next.commitment };
    }
  });
  it('reserves capacity for refunds, including other constructed objects', () => {
    expect(() => replaceConstructionCommitment({ ...base(), otherCommitments: { timber: 71 } })).toThrowError('CONSTRUCTION_CAPACITY');
    expect(() => replaceConstructionCommitment({ ...base(), capacity: { timber: 29, cloth: 30 } })).toThrowError('CONSTRUCTION_CAPACITY');
  });
  it('refuses insufficient, unknown, fractional and overflowing holdings without partial spending', () => {
    for (const changes of [{ nextCost: { timber: 31 } }, { nextCost: { stone: 1 } },
      { holdings: { timber: -1 } }, { nextCost: { timber: 1.2 } },
      { holdings: { timber: Number.MAX_SAFE_INTEGER } }]) {
      const input = { ...base(), ...changes }, before = JSON.stringify(input);
      expect(() => replaceConstructionCommitment(input)).toThrow(); expect(JSON.stringify(input)).toBe(before);
    }
  });
  it('rejects stale competing edits and invalid revision increments', () => {
    expect(checkConstructionRevision(5, 5)).toBe(6);
    expect(() => checkConstructionRevision(6, 5)).toThrowError('CONSTRUCTION_CONFLICT');
    expect(() => checkConstructionRevision(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toThrow();
  });
});

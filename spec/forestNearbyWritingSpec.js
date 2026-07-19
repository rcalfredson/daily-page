import {
  FOREST_BENCH_NEARBY_WRITING_MAXIMUM,
  FOREST_BENCH_NEARBY_WRITING_RADIUS,
  nearbyForestWritingForBench,
  renderNearbyForestWritingCandidates
} from '../public/js/forest-nearby-writing.js';
import { JSDOM } from 'jsdom';
import {
  createForestClearingObject,
  forestClearingMaterialLedger
} from '../public/js/forest-clearing-objects.js';
import { FOREST_STONE_BENCH_TYPE } from '../public/js/forest-world-overlay.js';
import { createForestExploration } from '../server/services/forestSceneExploration.js';
import { generateForestSceneLayout } from '../server/services/forestSceneLayout.js';

const fixtures = [
  { id: 'fixture-a', title: 'A', roomName: 'Room A', createdAt: '2026-01-01', excerpt: 'A.' },
  { id: 'fixture-b', title: 'B', roomName: 'Room B', createdAt: '2026-01-02', excerpt: 'B.' },
  { id: 'fixture-c', title: 'C', roomName: 'Room C', createdAt: '2026-01-03', excerpt: 'C.' },
  { id: 'fixture-d', title: 'D', roomName: 'Room D', createdAt: '2026-01-04', excerpt: 'D.' }
];

function bench(x = 100, y = 100) {
  return createForestClearingObject(FOREST_STONE_BENCH_TYPE, x, y,
    'forest-clearing-v1-stone-bench-01');
}

function placement(id, fixtureId, worldX, worldY) {
  return { id, fixtureId, worldX, worldY };
}

describe('Activity Forest nearby bench writing', () => {
  it('uses a fixed radius, caps results, and orders distance before stable identities', () => {
    const placements = [
      placement('tree-z', 'fixture-d', 100 + FOREST_BENCH_NEARBY_WRITING_RADIUS + 1, 100),
      placement('tree-c', 'fixture-c', 140, 100),
      placement('tree-b', 'fixture-b', 120, 100),
      placement('tree-a', 'fixture-a', 80, 100),
      placement('tree-d', 'fixture-d', 100, 130)
    ];
    const result = nearbyForestWritingForBench(bench(), placements, fixtures);

    expect(FOREST_BENCH_NEARBY_WRITING_RADIUS).toBe(360);
    expect(FOREST_BENCH_NEARBY_WRITING_MAXIMUM).toBe(3);
    expect(result.qualifyingPlacementCount).toBe(4);
    expect(result.candidates.map(({ placementId }) => placementId))
      .toEqual(['tree-a', 'tree-b', 'tree-d']);
  });

  it('deduplicates fixture identity at its nearest stable placement', () => {
    const result = nearbyForestWritingForBench(bench(), [
      placement('tree-far', 'fixture-a', 170, 100),
      placement('tree-near-z', 'fixture-a', 130, 100),
      placement('tree-near-a', 'fixture-a', 100, 130),
      placement('tree-other', 'fixture-b', 140, 100)
    ], fixtures);

    expect(result.qualifyingPlacementCount).toBe(4);
    expect(result.candidates.map(({ fixtureId, placementId }) => ({ fixtureId, placementId })))
      .toEqual([
        { fixtureId: 'fixture-a', placementId: 'tree-near-a' },
        { fixtureId: 'fixture-b', placementId: 'tree-other' }
      ]);
  });

  it('omits missing or unknown fixture data and has a calm empty result', () => {
    const malformedFixtures = [...fixtures, {
      id: 'fixture-bad', title: '', roomName: 'Room', createdAt: '2026-01-01', excerpt: 'Missing title'
    }];
    const result = nearbyForestWritingForBench(bench(), [
      placement('tree-unknown', 'fixture-unknown', 100, 100),
      placement('tree-missing', null, 100, 100),
      placement('tree-bad', 'fixture-bad', 100, 100)
    ], malformedFixtures);

    expect(result).toEqual({
      benchId: 'forest-clearing-v1-stone-bench-01',
      radius: FOREST_BENCH_NEARBY_WRITING_RADIUS,
      qualifyingPlacementCount: 0,
      candidates: []
    });
  });

  it('is independent of placement input order and unrelated transient state', () => {
    const placements = [
      placement('tree-c', 'fixture-c', 150, 100),
      placement('tree-a', 'fixture-a', 110, 100),
      placement('tree-b', 'fixture-b', 130, 100)
    ];
    const original = nearbyForestWritingForBench(bench(), placements, fixtures);
    const shuffled = nearbyForestWritingForBench(
      bench(), [...placements].reverse(), [...fixtures].reverse()
    );
    const transientSceneState = {
      camera: { x: 999, y: 888 }, loadedAssetKeys: [], animationTime: 1234, focusedId: 'other'
    };

    expect(shuffled).toEqual(original);
    expect(nearbyForestWritingForBench(bench(), placements, fixtures)).toEqual(original);
    expect(transientSceneState).toEqual({
      camera: { x: 999, y: 888 }, loadedAssetKeys: [], animationTime: 1234, focusedId: 'other'
    });
  });

  it('changes with a bench move without changing identity, cost, or personal state', () => {
    const firstBench = bench(100, 100);
    const movedBench = bench(900, 100);
    const placements = [
      placement('tree-west', 'fixture-a', 120, 100),
      placement('tree-east', 'fixture-b', 880, 100)
    ];
    const inventory = { 'fallen-twigs': 0, 'smooth-stones': 2, 'seed-pods': 0 };
    const overlay = { revision: 7, objects: [firstBench] };
    const before = JSON.parse(JSON.stringify({ overlay, inventory }));

    expect(nearbyForestWritingForBench(firstBench, placements, fixtures)
      .candidates.map(({ fixtureId }) => fixtureId)).toEqual(['fixture-a']);
    expect(nearbyForestWritingForBench(movedBench, placements, fixtures)
      .candidates.map(({ fixtureId }) => fixtureId)).toEqual(['fixture-b']);
    expect(movedBench.id).toBe(firstBench.id);
    expect(forestClearingMaterialLedger(inventory, [firstBench]).committed)
      .toEqual(forestClearingMaterialLedger(inventory, [movedBench]).committed);
    expect({ overlay, inventory }).toEqual(before);
  });

  it('stays bounded for representative and large-world fixture scenes', () => {
    for (const options of [{}, {
      seed: 'nearby-writing-large',
      world: { width: 6000, height: 3600 },
      placementCount: 600,
      assetPoolSize: 60
    }]) {
      const scene = createForestExploration(generateForestSceneLayout(options));
      const selected = nearbyForestWritingForBench(
        bench(scene.world.width / 2, scene.world.height / 2),
        scene.placements,
        scene.exploration.fixtures
      );
      expect(selected.candidates.length).toBeLessThanOrEqual(
        FOREST_BENCH_NEARBY_WRITING_MAXIMUM
      );
      expect(selected.qualifyingPlacementCount).toBeLessThanOrEqual(scene.placements.length);
      expect(JSON.parse(JSON.stringify(selected))).toEqual(selected);
    }
  });

  it('renders safe non-canvas buttons, activates them, and exposes a fixed empty state', () => {
    const dom = new JSDOM(`<section hidden>
      <p data-forest-bench-writing-empty hidden>No fixture writing is nearby.</p>
      <ol data-forest-bench-writing-list></ol>
    </section>`);
    const surface = dom.window.document.querySelector('section');
    const unsafeFixture = { ...fixtures[0], title: '<img src=x onerror=alert(1)>' };
    const selection = nearbyForestWritingForBench(bench(), [
      placement('tree-a', 'fixture-a', 110, 100)
    ], [unsafeFixture]);
    let opened = null;
    const button = renderNearbyForestWritingCandidates(
      surface, selection, (candidate) => { opened = candidate.fixtureId; }
    );

    expect(surface.hidden).toBeFalse();
    expect(surface.querySelector('img')).toBeNull();
    expect(button.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(button.getAttribute('aria-label')).toContain('<img src=x onerror=alert(1)>');
    button.click();
    expect(opened).toBe('fixture-a');

    renderNearbyForestWritingCandidates(surface, { candidates: [] }, () => {});
    expect(surface.querySelector('[data-forest-bench-writing-empty]').hidden).toBeFalse();
    expect(surface.querySelectorAll('button').length).toBe(0);
  });
});

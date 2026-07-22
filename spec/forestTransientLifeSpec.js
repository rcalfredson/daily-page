import {
  advanceForestTransientLife,
  createForestTransientLife,
  FOREST_TRANSIENT_BIRD_LIMIT,
  FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS,
  FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE,
  forestBirdPerchPoint,
  forestTransientBirdsForTree,
  forestTransientFlights,
  forestTransientLifeDiagnostic,
  validateForestTransientLife,
  validForestPerchAnchor
} from '../public/js/forest-transient-life.js';

function fixture() {
  const placements = Array.from({ length: 16 }, (_, index) => ({
    id: `tree-${String(index).padStart(2, '0')}`,
    assetKey: `asset-${index}`,
    worldX: 300 + ((index % 8) * 70),
    worldY: 700 + (Math.floor(index / 8) * 90),
    scale: index % 2 ? 2 : 1,
    phenotypeId: index % 2 ? 'sunset-lanternwood' : 'open-crown-deciduous',
    originatingHabitatId: index % 3 ? 'neutral-grove' : 'rocky-edge',
    groundSurfaceId: index % 3 ? 'grove-moss' : 'weathered-rock-grass',
    collisionRadius: 16,
    fixtureId: `writing-${index}`,
    wordCount: 100000 - index,
    reactionCount: 50000 - index
  }));
  const scene = {
    seed: 'transient-spec',
    world: { width: 1600, height: 1000 },
    placements,
    exploration: { spawn: { worldX: 560, worldY: 780 } }
  };
  const assetsByKey = new Map(placements.map((placement, index) => [
    placement.assetKey,
    {
      anchor: { x: 48, y: 120 },
      perchAnchors: [
        { id: 'perch-041', x: 35 + (index % 3), y: 66, depth: -2, layer: 'behind-wood' },
        { id: 'perch-068', x: 62, y: 72, depth: 4, layer: 'front-of-wood' }
      ]
    }
  ]));
  return { scene, assetsByKey };
}

describe('Activity Forest transient-life boundary', () => {
  it('creates a stable, bounded, JSON-safe cast without post-metric prestige', () => {
    const { scene } = fixture();
    const first = createForestTransientLife(scene);
    const repeated = createForestTransientLife(scene);
    const metricsChanged = createForestTransientLife({
      ...scene,
      placements: scene.placements.map(placement => ({
        ...placement, wordCount: 0, reactionCount: 0, roomId: 'unrelated-room'
      }))
    });

    expect(first).toEqual(repeated);
    expect(metricsChanged).toEqual(first);
    expect(first.actors.length).toBe(FOREST_TRANSIENT_BIRD_LIMIT);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(validateForestTransientLife(first)).toBeTrue();
    expect(JSON.stringify(first)).not.toMatch(/inventory|reward|discovery|post|fixture|overlay/i);
  });

  it('validates exact perch shapes and resolves feet to transported tree geometry', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const point = forestBirdPerchPoint(life.actors[0], scene.placements, assetsByKey, 0);

    expect(validForestPerchAnchor({
      id: 'perch-001', x: 42, y: 60, depth: -1.2, layer: 'behind-wood'
    })).toBeTrue();
    expect(validForestPerchAnchor({
      id: 'perch-001', x: 42, y: 60, depth: -1.2, layer: 'behind-wood', fake: true
    })).toBeFalse();
    expect(point).not.toBeNull();
    expect(point.anchorId).toMatch(/^perch-/);
    expect(point.projectedY).toBeLessThan(point.y);
    expect(point.layer).toMatch(/^(behind|front-of)-wood$/);
  });

  it('uses bounded fixed steps, pauses while hidden, and freezes for reduced motion', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const initial = JSON.parse(JSON.stringify(life.actors));
    const options = { placements: scene.placements, assetsByKey,
      viewport: { x: 0, y: 0, width: 1200, height: 1000 } };

    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 10000,
      documentHidden: true });
    expect(life.actors).toEqual(initial);
    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 10000,
      reducedMotion: true });
    expect(life.actors).toEqual(initial);
    expect(life.diagnostics.suppressedByReducedMotion).toBeTrue();
    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 10000 });
    expect(life.diagnostics.lastStepCount).toBe(FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE);
    expect(life.elapsedMilliseconds).toBe(
      FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS * FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE
    );
  });

  it('produces frame-rate-independent flight and never starts an unbounded flock', () => {
    const { scene, assetsByKey } = fixture();
    const coarse = createForestTransientLife(scene);
    const fine = createForestTransientLife(scene);
    const options = { placements: scene.placements, assetsByKey,
      viewport: { x: 0, y: 0, width: 1200, height: 1000 } };
    coarse.actors.forEach(actor => { actor.behavior.durationMilliseconds = 0; });
    fine.actors.forEach(actor => { actor.behavior.durationMilliseconds = 0; });

    advanceForestTransientLife(coarse, { ...options, elapsedMilliseconds: 200 });
    for (let index = 0; index < 4; index += 1) {
      advanceForestTransientLife(fine, { ...options, elapsedMilliseconds: 50 });
    }
    expect(coarse.actors).toEqual(fine.actors);
    expect(coarse.elapsedMilliseconds).toBe(fine.elapsedMilliseconds);
    expect(coarse.remainderMilliseconds).toBe(fine.remainderMilliseconds);
    expect(coarse.diagnostics.autonomousTransitions)
      .toBe(fine.diagnostics.autonomousTransitions);
    expect(forestTransientFlights(coarse, options.viewport).length).toBe(1);
    expect(forestTransientLifeDiagnostic(coarse).autonomousTransitions).toBe(1);
  });

  it('does not simulate actors outside the margin and keeps reduced-motion birds still', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    life.actors.forEach(actor => { actor.behavior.durationMilliseconds = 0; });

    advanceForestTransientLife(life, {
      elapsedMilliseconds: 200,
      placements: scene.placements,
      assetsByKey,
      viewport: { x: 1300, y: 0, width: 100, height: 100 }
    });
    expect(life.actors.every(actor => actor.behavior.state === 'perched')).toBeTrue();
    const reducedBirds = life.actors.flatMap(actor => forestTransientBirdsForTree(
      life, actor.route[actor.behavior.routeIndex], true
    )).filter((actor, index, actors) => actors.indexOf(actor) === index);
    expect(reducedBirds.length).toBeLessThanOrEqual(2);
  });
});

import {
  advanceForestTransientLife,
  createForestTransientLife,
  FOREST_TRANSIENT_BIRD_LIMIT,
  FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS,
  FOREST_TRANSIENT_GROUND_BIRD_COUNT,
  FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS,
  FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE,
  FOREST_TRANSIENT_STARTLE_RADIUS,
  FOREST_TRANSIENT_STARTLE_RESET_RADIUS,
  forestBirdForagePecking,
  forestBirdPerchPoint,
  forestTransientBirdsForTree,
  forestTransientDepthItems,
  forestTransientFlightAboveBridgeRails,
  forestTransientFlights,
  forestTransientGroundBirds,
  forestTransientGroundSuitability,
  forestTransientLifeDiagnostic,
  selectForestTransientGroundGroup,
  validateForestTransientLife,
  validForestPerchAnchor
} from '../public/js/forest-transient-life.js';
import {
  createForestEnvironmentManifest,
  forestStreamCenterY
} from '../public/js/forest-environment.js';

function fixture() {
  const placements = Array.from({ length: 16 }, (_, index) => ({
    id: `tree-${String(index).padStart(2, '0')}`,
    assetKey: `asset-${index}`,
    worldX: 300 + ((index % 8) * 70),
    worldY: 620 + (Math.floor(index / 8) * 90),
    scale: index % 2 ? 2 : 1,
    phenotypeId: index % 2 ? 'sunset-lanternwood' : 'open-crown-deciduous',
    originatingHabitatId: index % 3 ? 'neutral-grove' : 'rocky-edge',
    groundSurfaceId: index % 3 ? 'grove-moss' : 'weathered-rock-grass',
    collisionRadius: 16,
    fixtureId: `writing-${index}`,
    wordCount: 100000 - index,
    reactionCount: 50000 - index
  }));
  const world = { width: 1600, height: 1100 };
  const scene = {
    seed: 'transient-spec',
    world,
    environment: createForestEnvironmentManifest({ seed: 'transient-spec', world }),
    placements,
    terrainFeatures: [{ id: 'rock', worldX: 980, worldY: 700, collisionRadius: 18 }],
    crossings: [{
      id: 'bridge', type: 'arched-footbridge', worldX: 900, worldY: 850,
      angleMilliradians: 0, halfWidth: 28, halfLength: 90, maximumElevationPixels: 12
    }],
    exploration: { spawn: { worldX: 560, worldY: 930, radius: 10 } }
  };
  const assetsByKey = new Map(placements.map((placement, index) => [
    placement.assetKey,
    {
      anchor: { x: 48, y: 120 },
      perchAnchors: [
        { id: 'perch-041', x: 35 + (index % 3), y: 66, depth: -2, layer: 'behind-wood' },
        { id: 'perch-068', x: 62, y: 72, depth: 4, layer: 'front-of-wood' },
        { id: 'perch-079', x: 72, y: 80, depth: 2, layer: 'front-of-wood' }
      ]
    }
  ]));
  return { scene, assetsByKey };
}

function activeOptions(scene, assetsByKey, player = null) {
  return {
    scene,
    placements: scene.placements,
    assetsByKey,
    viewport: { x: 0, y: 0, width: 1400, height: 1100 },
    player
  };
}

describe('Activity Forest transient-life boundary', () => {
  it('creates a stable, bounded, JSON-safe mixed cast without post-metric prestige', () => {
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
    expect(first.actors.filter(({ behavior }) => behavior.state === 'ground-forage').length)
      .toBe(FOREST_TRANSIENT_GROUND_BIRD_COUNT);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(validateForestTransientLife(first)).toBeTrue();
    expect(JSON.stringify(first)).not.toMatch(/inventory|reward|discovery|post|fixture|overlay/i);
  });

  it('selects one dry, bounded ground group outside trees, terrain, bridges, and authored objects', () => {
    const { scene } = fixture();
    const selection = selectForestTransientGroundGroup(scene);

    expect(selection.exhausted).toBeFalse();
    expect(forestTransientGroundSuitability(scene, selection.point).valid).toBeTrue();
    expect(forestTransientGroundSuitability({ ...scene, environment: null }, {
      worldX: scene.placements[0].worldX, worldY: scene.placements[0].worldY
    }).reason).toBe('tree-ground');
    expect(forestTransientGroundSuitability(scene, {
      worldX: scene.crossings[0].worldX, worldY: scene.crossings[0].worldY
    }).reason).toBe('bridge-ground');
    const streamX = 1200;
    expect(forestTransientGroundSuitability(scene, {
      worldX: streamX, worldY: forestStreamCenterY(scene.environment, streamX)
    }).reason).toBe('wet-or-bank-ground');
    expect(forestTransientGroundSuitability(scene, {
      worldX: selection.point.worldX, worldY: selection.point.worldY
    }, [{ worldX: selection.point.worldX, worldY: selection.point.worldY,
      collisionRadius: 12 }]).reason).toBe('authored-object-ground');
  });

  it('validates exact perch shapes and favors a readable real anchor for one-third of identities', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const actor = life.actors.find(({ behavior }) => behavior.state === 'perched');
    actor.anchorChoice = actor.anchorChoice - (actor.anchorChoice % 3);
    const point = forestBirdPerchPoint(actor, scene.placements, assetsByKey, 0);

    expect(validForestPerchAnchor({
      id: 'perch-001', x: 42, y: 60, depth: -1.2, layer: 'behind-wood'
    })).toBeTrue();
    expect(validForestPerchAnchor({
      id: 'perch-001', x: 42, y: 60, depth: -1.2, layer: 'behind-wood', fake: true
    })).toBeFalse();
    expect(point.anchorId).toBe('perch-079');
    expect(point.projectedY).toBeLessThan(point.y);
  });

  it('performs a bounded real-anchor branch hop before returning to a quiet perch', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const actor = life.actors[0];
    actor.behavior.durationMilliseconds = 0;
    const options = activeOptions(scene, assetsByKey);

    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 50 });
    expect(actor.behavior.state).toBe('branch-hop');
    expect(actor.behavior.motion.from.anchorId).not.toBe(actor.behavior.motion.to.anchorId);
    expect(actor.behavior.durationMilliseconds).toBe(420);
    for (let index = 0; index < 9; index += 1) {
      advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 50 });
    }
    expect(actor.behavior.state).toBe('perched');
    expect(actor.behavior.hopsAtTree).toBe(1);
    expect(life.diagnostics.branchHops).toBe(1);
  });

  it('gives each ground bird a stable individual pecking rhythm', () => {
    const { scene } = fixture();
    const life = createForestTransientLife(scene);
    const groundBirds = life.actors.filter(({ behavior }) => behavior.state === 'ground-forage');
    const samples = groundBirds.map(actor => Array.from({ length: 80 }, (_, index) => {
      actor.behavior.elapsedMilliseconds = index * 50;
      return forestBirdForagePecking(actor);
    }));

    expect(samples[0]).not.toEqual(samples[1]);
    expect(samples.every(pattern => pattern.includes(true) && pattern.includes(false))).toBeTrue();
    expect(forestBirdForagePecking(groundBirds[0], false)).toBeFalse();
  });

  it('lets one ground bird wander independently while its flock mate keeps foraging', () => {
    const { scene, assetsByKey } = fixture();
    const first = createForestTransientLife(scene, { sessionSeed: 101 });
    const second = createForestTransientLife(scene, { sessionSeed: 202 });
    const firstBirds = first.actors.filter(({ groupId }) => groupId);
    const secondBirds = second.actors.filter(({ groupId }) => groupId);
    firstBirds[0].behavior.wanderDurationMilliseconds = 0;
    firstBirds[1].behavior.wanderDurationMilliseconds = 10000;
    secondBirds[0].behavior.wanderDurationMilliseconds = 0;
    secondBirds[1].behavior.wanderDurationMilliseconds = 10000;
    const initialSpacing = Math.hypot(
      firstBirds[0].behavior.groundPoint.x - firstBirds[1].behavior.groundPoint.x,
      firstBirds[0].behavior.groundPoint.y - firstBirds[1].behavior.groundPoint.y
    );
    const firstOptions = activeOptions(scene, assetsByKey, scene.exploration.spawn);

    advanceForestTransientLife(first, { ...firstOptions, elapsedMilliseconds: 50 });
    advanceForestTransientLife(second, { ...firstOptions, elapsedMilliseconds: 50 });
    const firstWanderers = first.actors.filter(({ behavior }) => (
      behavior.state === 'ground-wander'
    ));
    const secondWanderers = second.actors.filter(({ behavior }) => (
      behavior.state === 'ground-wander'
    ));

    expect(firstWanderers.length).toBe(1);
    expect(secondWanderers.length).toBe(1);
    expect(firstBirds[1].behavior.state).toBe('ground-forage');
    expect(firstWanderers[0].behavior.motion.to).not.toEqual(
      secondWanderers[0].behavior.motion.to
    );
    const spacing = Math.hypot(
      firstWanderers[0].behavior.motion.to.x - firstBirds[1].behavior.groundPoint.x,
      firstWanderers[0].behavior.motion.to.y - firstBirds[1].behavior.groundPoint.y
    );
    expect(spacing).toBeGreaterThanOrEqual(14);
    expect(spacing).toBeLessThanOrEqual(64);
    expect(spacing).not.toBeCloseTo(initialSpacing, 0);
    expect(first.groundGroup.home).toBeUndefined();
    expect(forestTransientGroundSuitability(scene, {
      worldX: firstWanderers[0].behavior.motion.to.x,
      worldY: firstWanderers[0].behavior.motion.to.y
    }).valid).toBeTrue();

    for (let index = 0; index < 15; index += 1) {
      advanceForestTransientLife(first, { ...firstOptions, elapsedMilliseconds: 50 });
    }
    const previousDestination = { ...firstBirds[0].behavior.groundPoint };
    firstBirds[0].behavior.wanderDurationMilliseconds = 0;
    firstBirds[1].behavior.wanderDurationMilliseconds = 10000;
    advanceForestTransientLife(first, { ...firstOptions, elapsedMilliseconds: 50 });
    expect(firstBirds[0].behavior.state).toBe('ground-wander');
    expect(firstBirds[0].behavior.motion.from).toEqual(previousDestination);
  });

  it('chooses distinct nearest retreat trees from the birds current ground positions', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const birds = life.actors.filter(({ groupId }) => groupId);
    birds.forEach((bird, index) => {
      const placement = scene.placements[index * 5];
      bird.behavior.groundPoint = {
        ...bird.behavior.groundPoint,
        x: placement.worldX + 24,
        y: placement.worldY + 24,
        projectedY: placement.worldY + 24
      };
    });
    const center = {
      worldX: Math.round((birds[0].behavior.groundPoint.x
        + birds[1].behavior.groundPoint.x) / 2),
      worldY: Math.round((birds[0].behavior.groundPoint.y
        + birds[1].behavior.groundPoint.y) / 2)
    };
    const farPlayer = { worldX: center.worldX + FOREST_TRANSIENT_STARTLE_RESET_RADIUS + 10,
      worldY: center.worldY };
    const nearPlayer = { ...center };

    advanceForestTransientLife(life, {
      ...activeOptions(scene, assetsByKey, farPlayer), elapsedMilliseconds: 50
    });
    advanceForestTransientLife(life, {
      ...activeOptions(scene, assetsByKey, nearPlayer), elapsedMilliseconds: 50
    });

    const reserved = new Set();
    birds.forEach((bird) => {
      const nearestAvailable = [...scene.placements].sort((left, right) => (
        Math.hypot(left.worldX - bird.behavior.groundPoint.x,
          left.worldY - bird.behavior.groundPoint.y)
          - Math.hypot(right.worldX - bird.behavior.groundPoint.x,
            right.worldY - bird.behavior.groundPoint.y)
        || left.id.localeCompare(right.id)
      )).find(({ id }) => !reserved.has(id));
      expect(bird.route[0]).toBe(nearestAvailable.id);
      reserved.add(bird.route[0]);
    });
    expect(new Set(birds.map(({ route }) => route[0])).size).toBe(2);
  });

  it('caps unavailable retreat retries and safely restores a calm ground flock', () => {
    const { scene } = fixture();
    const life = createForestTransientLife(scene);
    const birds = life.actors.filter(({ groupId }) => groupId);
    const center = life.groundGroup.center;
    const farPlayer = { worldX: center.worldX + FOREST_TRANSIENT_STARTLE_RESET_RADIUS + 10,
      worldY: center.worldY };
    const nearPlayer = { ...center };
    const unavailableOptions = activeOptions(scene, new Map(), farPlayer);

    advanceForestTransientLife(life, { ...unavailableOptions, elapsedMilliseconds: 50 });
    for (let index = 0; index < 180 && (life.groundGroup.armed
      || life.groundGroup.startled); index += 1) {
      advanceForestTransientLife(life, {
        ...unavailableOptions, player: nearPlayer, elapsedMilliseconds: 50
      });
    }

    expect(life.groundGroup.startled).toBeFalse();
    expect(birds.every(({ behavior }) => behavior.state === 'ground-forage')).toBeTrue();
    expect(birds.every(({ behavior }) => (
      behavior.retreatAttempts === FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS
    ))).toBeTrue();
    expect(life.diagnostics.selectionExhaustions)
      .toBe(FOREST_TRANSIENT_GROUND_BIRD_COUNT * FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS);
    expect(validateForestTransientLife(life)).toBeTrue();
  });

  it('returns a perched flock mate when the other bird exhausts its retreat', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const center = life.groundGroup.center;
    const farPlayer = { worldX: center.worldX + FOREST_TRANSIENT_STARTLE_RESET_RADIUS + 10,
      worldY: center.worldY };
    const nearPlayer = { ...center };
    const options = activeOptions(scene, assetsByKey, farPlayer);

    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 50 });
    advanceForestTransientLife(life, {
      ...options, player: nearPlayer, elapsedMilliseconds: 50
    });
    const departed = life.actors.find(({ groupId, behavior }) => (
      groupId && behavior.state === 'flight'
    ));
    const grounded = life.actors.find(({ groupId, behavior }) => (
      groupId && behavior.state === 'ground-forage'
    ));
    const unavailable = scene.placements.filter(({ id }) => id !== departed.route[0]).slice(0, 3);
    grounded.route = unavailable.map(({ id }) => id);
    unavailable.forEach(({ assetKey }) => assetsByKey.delete(assetKey));

    for (let index = 0; index < 220 && life.groundGroup.startled; index += 1) {
      advanceForestTransientLife(life, {
        ...options, player: nearPlayer, elapsedMilliseconds: 50
      });
    }

    expect(grounded.behavior.retreatAttempts).toBe(FOREST_TRANSIENT_MAX_RETREAT_ATTEMPTS);
    expect(life.groundGroup.startled).toBeFalse();
    expect(life.actors.filter(({ groupId }) => groupId)
      .every(({ behavior }) => behavior.state === 'ground-forage')).toBeTrue();
    expect(validateForestTransientLife(life)).toBeTrue();
  });

  it('arms outside the group, startles inside the threshold, and staggers flock takeoff', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const center = life.groundGroup.center;
    const farPlayer = { worldX: center.worldX + FOREST_TRANSIENT_STARTLE_RESET_RADIUS + 10,
      worldY: center.worldY };
    const nearPlayer = { worldX: center.worldX + FOREST_TRANSIENT_STARTLE_RADIUS - 2,
      worldY: center.worldY };

    advanceForestTransientLife(life, {
      ...activeOptions(scene, assetsByKey, farPlayer), elapsedMilliseconds: 50
    });
    expect(life.groundGroup.armed).toBeTrue();
    advanceForestTransientLife(life, {
      ...activeOptions(scene, assetsByKey, nearPlayer), elapsedMilliseconds: 50
    });
    expect(life.groundGroup.startled).toBeTrue();
    expect(forestTransientFlights(life, null).length).toBe(1);
    expect(forestTransientGroundBirds(life, null).length).toBe(1);
    for (let index = 0; index < 3; index += 1) {
      advanceForestTransientLife(life, {
        ...activeOptions(scene, assetsByKey, nearPlayer), elapsedMilliseconds: 50
      });
    }
    expect(forestTransientFlights(life, null).length).toBe(2);
    expect(life.diagnostics.playerStartledTransitions).toBe(2);
    expect(validateForestTransientLife(life)).toBeTrue();
  });

  it('returns a startled group after a quiet cooldown instead of losing or exploiting it', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const center = life.groundGroup.center;
    const farPlayer = { worldX: center.worldX + FOREST_TRANSIENT_STARTLE_RESET_RADIUS + 20,
      worldY: center.worldY };
    const nearPlayer = { worldX: center.worldX, worldY: center.worldY };
    const options = activeOptions(scene, assetsByKey, farPlayer);
    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 50 });
    advanceForestTransientLife(life, {
      ...activeOptions(scene, assetsByKey, nearPlayer), elapsedMilliseconds: 200
    });

    for (let index = 0; index < 500 && life.groundGroup.startled; index += 1) {
      advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 200 });
    }
    expect(life.groundGroup.startled).toBeFalse();
    expect(life.actors.filter(({ groupId }) => groupId)
      .every(({ behavior }) => behavior.state === 'ground-forage')).toBeTrue();
    expect(life.groundGroup.armed).toBeTrue();
  });

  it('uses bounded fixed steps, pauses while hidden, and freezes for reduced motion', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const initial = JSON.parse(JSON.stringify(life.actors));
    const options = activeOptions(scene, assetsByKey);

    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 10000,
      documentHidden: true });
    expect(life.actors).toEqual(initial);
    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 10000,
      reducedMotion: true });
    expect(life.actors).toEqual(initial);
    expect(life.diagnostics.suppressedByReducedMotion).toBeTrue();
    expect(forestTransientGroundBirds(life, null, true)).toEqual([]);
    advanceForestTransientLife(life, { ...options, elapsedMilliseconds: 10000 });
    expect(life.diagnostics.lastStepCount).toBe(FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE);
    expect(life.elapsedMilliseconds).toBe(
      FOREST_TRANSIENT_FIXED_STEP_MILLISECONDS * FOREST_TRANSIENT_MAX_STEPS_PER_UPDATE
    );
  });

  it('keeps autonomous motion frame-rate-independent and singular', () => {
    const { scene, assetsByKey } = fixture();
    const coarse = createForestTransientLife(scene);
    const fine = createForestTransientLife(scene);
    const options = activeOptions(scene, assetsByKey);
    coarse.actors[0].behavior.durationMilliseconds = 0;
    fine.actors[0].behavior.durationMilliseconds = 0;

    advanceForestTransientLife(coarse, { ...options, elapsedMilliseconds: 200 });
    for (let index = 0; index < 4; index += 1) {
      advanceForestTransientLife(fine, { ...options, elapsedMilliseconds: 50 });
    }
    expect(coarse.actors).toEqual(fine.actors);
    expect(coarse.elapsedMilliseconds).toBe(fine.elapsedMilliseconds);
    expect(coarse.actors.filter(({ behavior }) => (
      ['flight', 'branch-hop'].includes(behavior.state)
    )).length).toBe(1);
  });

  it('orders ground and flight contact honestly and lifts high bridge flights above rails', () => {
    const { scene, assetsByKey } = fixture();
    const life = createForestTransientLife(scene);
    const center = life.groundGroup.center;
    const farPlayer = { worldX: center.worldX + FOREST_TRANSIENT_STARTLE_RESET_RADIUS + 10,
      worldY: center.worldY };
    const nearPlayer = { worldX: center.worldX, worldY: center.worldY };
    advanceForestTransientLife(life, {
      ...activeOptions(scene, assetsByKey, farPlayer), elapsedMilliseconds: 50
    });
    advanceForestTransientLife(life, {
      ...activeOptions(scene, assetsByKey, nearPlayer), elapsedMilliseconds: 50
    });
    const flight = forestTransientFlights(life, null)[0];
    flight.behavior.motion.x = scene.crossings[0].worldX;
    flight.behavior.motion.y = scene.crossings[0].worldY;
    flight.behavior.motion.z = 60;
    flight.behavior.motion.projectedY = flight.behavior.motion.y - 60;

    expect(forestTransientFlightAboveBridgeRails(flight, scene.crossings)).toBeTrue();
    const depth = forestTransientDepthItems(life, null, false, scene.crossings);
    expect(depth.highBridgeFlights).toEqual([flight]);
    expect(depth.items.find(({ kind }) => kind === 'transient-ground-bird').worldY)
      .toBe(life.actors.find(({ behavior }) => behavior.state === 'ground-forage')
        .behavior.groundPoint.y);
  });

  it('does not simulate actors outside the margin or participate in focus and persistence', () => {
    const { scene, assetsByKey } = fixture();
    const sceneSnapshot = JSON.parse(JSON.stringify(scene));
    const life = createForestTransientLife(scene);
    const actor = life.actors[0];
    actor.behavior.durationMilliseconds = 0;

    advanceForestTransientLife(life, {
      elapsedMilliseconds: 200,
      placements: scene.placements,
      assetsByKey,
      viewport: { x: 1450, y: 0, width: 100, height: 100 },
      player: { worldX: life.groundGroup.center.worldX,
        worldY: life.groundGroup.center.worldY }
    });
    expect(actor.behavior.state).toBe('perched');
    expect(life.groundGroup.startled).toBeFalse();
    expect(forestTransientBirdsForTree(life, actor.route[0], true)).toContain(actor);
    const diagnostic = forestTransientLifeDiagnostic(life);
    expect(diagnostic.counts['ground-forage']).toBe(2);
    expect(JSON.stringify(life)).not.toMatch(/focus|prompt|persist|localStorage|reward|inventory/i);
    expect(scene).toEqual(sceneSnapshot);
  });
});

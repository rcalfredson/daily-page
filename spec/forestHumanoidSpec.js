import {
  advanceForestHumanoidMotion,
  createForestHumanoidMotion,
  FOREST_HUMANOID_MAX_RUN_CYCLES_PER_SECOND,
  FOREST_HUMANOID_PRESENTATION_VERSION,
  FOREST_HUMANOID_RUN_THRESHOLD,
  forestHumanoidCadence,
  forestHumanoidFootTravel,
  forestHumanoidGait
} from '../public/js/forest-humanoid.js';

describe('Activity Forest humanoid presentation', () => {
  it('uses a versioned exact motion shape and derives facing from actual travel', () => {
    const initial = createForestHumanoidMotion();
    const moved = advanceForestHumanoidMotion(initial, {
      from: { worldX: 20, worldY: 30 },
      to: { worldX: 32, worldY: 34 },
      elapsedSeconds: 0.2
    });

    expect(FOREST_HUMANOID_PRESENTATION_VERSION).toBe(3);
    expect(Object.keys(moved).sort()).toEqual([
      'distance', 'facingRadians', 'speed', 'stepPhase', 'targetFacingRadians'
    ]);
    expect(moved.targetFacingRadians).toBeCloseTo(Math.atan2(4, 12));
    expect(moved.facingRadians).not.toBe(initial.facingRadians);
    expect(moved.distance).toBeCloseTo(Math.hypot(12, 4));
    expect(moved.speed).toBeCloseTo(Math.hypot(12, 4) / 0.2);
  });

  it('scales the gait from walking to running according to travel rate', () => {
    const walking = advanceForestHumanoidMotion(createForestHumanoidMotion(), {
      from: { worldX: 0, worldY: 0 }, to: { worldX: 8, worldY: 0 }, elapsedSeconds: 0.1
    });
    const running = advanceForestHumanoidMotion(createForestHumanoidMotion(), {
      from: { worldX: 0, worldY: 0 }, to: { worldX: 15, worldY: 0 }, elapsedSeconds: 0.1
    });

    expect(walking.speed).toBeLessThan(FOREST_HUMANOID_RUN_THRESHOLD);
    expect(forestHumanoidGait(walking).running).toBeFalse();
    expect(running.speed).toBeGreaterThan(FOREST_HUMANOID_RUN_THRESHOLD);
    expect(forestHumanoidGait(running).running).toBeTrue();
    expect(running.stepPhase).toBeGreaterThan(walking.stepPhase);
  });

  it('uses an explicit running cadence and caps hyper-speed leg motion', () => {
    const ordinaryRun = forestHumanoidCadence(150);
    const impossibleSprint = forestHumanoidCadence(10000);

    expect(ordinaryRun).toBeGreaterThan(forestHumanoidCadence(80));
    expect(ordinaryRun).toBeLessThanOrEqual(FOREST_HUMANOID_MAX_RUN_CYCLES_PER_SECOND);
    expect(impossibleSprint).toBe(FOREST_HUMANOID_MAX_RUN_CYCLES_PER_SECOND);
  });

  it('keeps walking cadence legible and gives each foot a planted and recovery phase', () => {
    expect(forestHumanoidCadence(30)).toBeGreaterThan(1.5);
    expect(forestHumanoidFootTravel(0)).toBe(1);
    expect(forestHumanoidFootTravel(Math.PI * 2 * 0.62)).toBeCloseTo(-1);
    expect(forestHumanoidFootTravel(Math.PI * 2 * 0.81)).toBeCloseTo(0);
    expect(forestHumanoidFootTravel(Math.PI * 2 * 0.99)).toBeGreaterThan(0.9);
  });

  it('preserves travel and facing while suppressing reduced-motion animation', () => {
    const reduced = advanceForestHumanoidMotion(createForestHumanoidMotion('left'), {
      from: { worldX: 40, worldY: 40 }, to: { worldX: 40, worldY: 20 },
      elapsedSeconds: 0.1, reducedMotion: true
    });

    expect(reduced.facingRadians).toBeCloseTo(-Math.PI / 2);
    expect(reduced.targetFacingRadians).toBeCloseTo(-Math.PI / 2);
    expect(reduced.distance).toBe(20);
    expect(reduced.speed).toBe(0);
    expect(reduced.stepPhase).toBe(0);
    expect(forestHumanoidGait(reduced, true).moving).toBeFalse();
  });

  it('eases toward analog intent even when collision prevents travel', () => {
    const initial = createForestHumanoidMotion('down');
    const turning = advanceForestHumanoidMotion(initial, {
      from: { worldX: 20, worldY: 20 },
      to: { worldX: 20, worldY: 20 },
      direction: { x: -0.8, y: -0.6 },
      elapsedSeconds: 0.05
    });

    expect(turning.speed).toBe(0);
    expect(turning.targetFacingRadians).toBeCloseTo(Math.atan2(-0.6, -0.8));
    expect(turning.facingRadians).not.toBe(initial.facingRadians);
    expect(turning.facingRadians).not.toBe(turning.targetFacingRadians);
  });
});

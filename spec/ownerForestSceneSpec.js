import {
  FOREST_OWNER_GROUND_PRESENTATION_CONFIG,
  sampleOwnerForestEnvironment,
  sampleOwnerForestGroundPresentation
} from '../public/js/owner-forest-environment.js';
import {
  decodeOwnerForestRaster,
  moveOwnerForestPlayer,
  ownerForestAssetBatches,
  ownerForestCamera,
  ownerForestCellId,
  ownerForestCellsAround,
  ownerForestJoystickOffset,
  ownerForestMovementDirection,
  ownerForestPlacementAtPoint
} from '../public/js/owner-forest-scene.js';
import {
  forestTouchGestureIntent,
  touchMovement
} from '../public/js/forest-scene-math.js';
import { resolveForestOwnerEnvironment } from '../server/services/forestOwnerEnvironmentResolver.js';

describe('owner forest browser scene policy', () => {
  it('selects a canonical 3x3 signed-cell neighborhood around the player', () => {
    const cells = ownerForestCellsAround({ worldX: -1, worldY: 721 }, 720);

    expect(cells.length).toBe(9);
    expect(cells.map(ownerForestCellId)).toEqual([
      '-2:0', '-1:0', '0:0',
      '-2:1', '-1:1', '0:1',
      '-2:2', '-1:2', '0:2'
    ]);
  });

  it('chunks unique visual identities into bounded preparation batches', () => {
    expect(ownerForestAssetBatches(['a', 'b', 'a', 'c', 'd', 'e'], 2)).toEqual([
      ['a', 'b'], ['c', 'd'], ['e']
    ]);
  });

  it('moves and centers the camera on a signed unbounded ground plane', () => {
    const player = { worldX: -40, worldY: -20, radius: 10, movementSpeed: 100 };
    const moved = moveOwnerForestPlayer(player, { x: -1, y: 0 }, 0.5, []);

    expect(moved.worldX).toBe(-90);
    expect(ownerForestCamera(moved, { width: 800, height: 600 })).toEqual({
      width: 800, height: 600, x: -490, y: -320
    });
  });

  it('pauses keyboard and pointer movement while writing inspection is open', () => {
    expect(ownerForestMovementDirection({
      inspectionOpen: true,
      keyboardDirection: { x: 1, y: 0 },
      pointerDirection: { x: 0, y: -1 },
    })).toEqual({ x: 0, y: 0 });
    expect(ownerForestMovementDirection({
      inspectionOpen: false,
      keyboardDirection: { x: 0, y: 0 },
      pointerDirection: { x: 0, y: -1 },
    })).toEqual({ x: 0, y: -1 });
  });

  it('gives touch movement a dead zone and bounds its floating joystick', () => {
    expect(touchMovement(4, 6)).toEqual({ x: 0, y: 0 });
    expect(touchMovement(30, 40)).toEqual({ x: 0.6, y: 0.8 });

    expect(ownerForestJoystickOffset(3, 4)).toEqual({ x: 3, y: 4 });
    const bounded = ownerForestJoystickOffset(30, 40);
    expect(Math.hypot(bounded.x, bounded.y)).toBeCloseTo(34, 8);
  });

  it('uses maximum touch displacement to distinguish inspection taps from movement', () => {
    expect(forestTouchGestureIntent(10)).toBe('tap');
    expect(forestTouchGestureIntent(10.01)).toBe('drag');
  });

  it('falls back to image decoding when an available bitmap decoder rejects a raster', async () => {
    const source = { type: 'image/png' };
    const image = {};
    Object.defineProperty(image, 'src', {
      get: () => image.sourceUrl,
      set: (value) => {
        image.sourceUrl = value;
        Promise.resolve().then(() => image.onload());
      }
    });
    const revoked = [];
    const decoded = decodeOwnerForestRaster(source, {
      createImageBitmap: async () => { throw new Error('unsupported bitmap'); },
      createImage: () => image,
      urlApi: {
        createObjectURL: value => value === source ? 'blob:owner-tree' : null,
        revokeObjectURL: value => revoked.push(value)
      }
    });

    expect(await decoded).toBe(image);
    expect(image.src).toBe('blob:owner-tree');
    expect(revoked).toEqual(['blob:owner-tree']);
  });

  it('preserves tree collision without treating the browser as placement authority', () => {
    const player = { worldX: 0, worldY: 0, radius: 10, movementSpeed: 100 };
    const tree = { worldX: 40, worldY: 0, collisionRadius: 20 };
    const moved = moveOwnerForestPlayer(player, { x: 1, y: 0 }, 0.2, [tree]);

    expect(moved.worldX).toBe(0);
  });

  it('selects only a nearby tree whose visual bounds contain a pointer or touch point', () => {
    const nearby = {
      id: 'nearby',
      assetKey: 'deciduous',
      worldX: 40,
      worldY: 20,
      scale: 1,
      collisionRadius: 18,
    };
    const distant = {
      ...nearby,
      id: 'distant',
      worldX: 400,
    };
    const assetsByKey = new Map([['deciduous', {
      anchor: { x: 48, y: 120 },
      dimensions: { width: 96, height: 128 },
    }]]);

    expect(ownerForestPlacementAtPoint({
      point: { worldX: 40, worldY: -30 },
      player: { worldX: 0, worldY: 0 },
      placements: [distant, nearby],
      assetsByKey,
      interactionRadius: 48,
    })).toBe(nearby);
    expect(ownerForestPlacementAtPoint({
      point: { worldX: 400, worldY: -30 },
      player: { worldX: 0, worldY: 0 },
      placements: [distant],
      assetsByKey,
      interactionRadius: 48,
    })).toBeNull();
  });

  it('keeps browser ground presentation exactly aligned with server environment policy', () => {
    const worldSeed = 'owner-environment-browser-parity';
    for (const [worldX, worldY] of [[0, 0], [-2400, 1800], [4800, -4320]]) {
      const browser = sampleOwnerForestEnvironment({ worldSeed, worldX, worldY });
      const server = resolveForestOwnerEnvironment({ worldSeed, worldX, worldY });
      expect(browser).toEqual({
        regionId: server.originatingEnvironment.regionId,
        habitatId: server.originatingEnvironment.habitatId,
        groundSurfaceId: server.originatingEnvironment.groundSurfaceId,
        transitionState: server.originatingEnvironment.transitionState,
        rockinessPermille: server.ecology.rockinessPermille,
        treeDensityPermille: server.ecology.treeDensityPermille,
        treeAllowed: server.suitability.treeAllowed
      });
    }
  });

  it('derives stable quiet ground detail without changing environment identity', () => {
    const worldSeed = 'owner-ground-presentation-spec';
    const first = sampleOwnerForestGroundPresentation({
      worldSeed, worldX: 24, worldY: 24
    });
    const second = sampleOwnerForestGroundPresentation({
      worldSeed, worldX: 24, worldY: 24
    });
    const environment = sampleOwnerForestEnvironment({
      worldSeed, worldX: 24, worldY: 24
    });

    expect(second).toEqual(first);
    expect(first.presentationVersion).toBe(2);
    expect(first.originClearingPermille).toBe(1000);
    expect(first.rockinessPermille).toBeLessThanOrEqual(environment.rockinessPermille);
    expect(Object.values(first.color).every(channel => (
      Number.isSafeInteger(channel) && channel >= 0 && channel <= 255
    ))).toBeTrue();
    expect(FOREST_OWNER_GROUND_PRESENTATION_CONFIG.tileSize).toBe(48);
  });

  it('distributes bounded ground motifs across calm, transition, and rocky areas', () => {
    const details = [];
    for (let worldY = -2400; worldY <= 2400; worldY += 96) {
      for (let worldX = -2400; worldX <= 2400; worldX += 96) {
        const presentation = sampleOwnerForestGroundPresentation({
          worldSeed: 'owner-ground-detail-distribution', worldX, worldY
        });
        if (presentation.detail) details.push(presentation.detail);
      }
    }

    expect(details.length).toBeGreaterThan(300);
    expect(new Set(details.map(detail => detail.kind))).toEqual(
      new Set(['grass', 'moss', 'pebbles', 'stone'])
    );
    expect(details.every(detail => (
      Math.abs(detail.offsetXPermille) <= 280
      && Math.abs(detail.offsetYPermille) <= 280
      && detail.scalePermille >= 720
      && detail.scalePermille <= 1239
    ))).toBeTrue();
  });
});

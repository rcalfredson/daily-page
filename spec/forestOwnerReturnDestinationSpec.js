import { buildForestOwnerReturnDestinationService } from '../server/services/forestOwnerReturnDestination.js';
import { forestReturnTreeId } from '../public/js/forest-writing-navigation.js';
import { ownerForestReturnSpawn, ownerForestCellsAround } from '../public/js/owner-forest-scene.js';
import { FOREST_OWNER_SCENE_SPAWN as SPAWN } from '../server/services/forestOwnerSceneBootstrap.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const TREE = '22222222-2222-4222-8222-222222222222';
const TARGET = { id: TREE, worldX: -721, worldY: 719, collisionRadius: 20 };
const page = (placements, nextCursor = null) => ({ status: 'ready', placements, page: { nextCursor } });

function harness({ inspection, placement = TARGET, pages = [page([TARGET])] } = {}) {
  const inspectTree = jasmine.createSpy('inspectTree').and.resolveTo(inspection || {
    status: 'ready', tree: { id: TREE, recordRevision: 7 }
  });
  const ForestWritingTreeModel = { findOne: jasmine.createSpy('findOne').and.returnValue({
    lean: () => Promise.resolve(placement ? { placement } : null)
  }) };
  const readManifest = jasmine.createSpy('readManifest').and.returnValues(...pages.map(value => Promise.resolve(value)));
  const resolve = buildForestOwnerReturnDestinationService({ ForestWritingTreeModel, inspectTree, readManifest });
  return {
    inspectTree, ForestWritingTreeModel, readManifest,
    resolve: (overrides = {}) => resolve({
      ownerUserId: OWNER, forestId: FOREST, writingTreeId: TREE, preferredContentLang: 'es',
      spawn: SPAWN, cellSize: 720, ...overrides
    })
  };
}

describe('owner forest return destination', () => {
  it('reauthorizes current writing and scopes the placement to owner, world and inspected revision', async () => {
    const test = harness();
    const destination = await test.resolve();
    expect(test.inspectTree).toHaveBeenCalledOnceWith({ ownerUserId: OWNER, writingTreeId: TREE, preferredContentLang: 'es' });
    expect(test.ForestWritingTreeModel.findOne).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER, forestId: FOREST, writingTreeId: TREE, recordRevision: 7,
      sourceState: 'active', hiddenFromForest: false
    }, { _id: 0, placement: 1 });
    expect(destination).toEqual({ treeId: TREE, spawn: { ...SPAWN, worldX: TARGET.worldX, worldY: TARGET.worldY + 39 } });
    expect(test.readManifest).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER, cells: ownerForestCellsAround(TARGET, 720), cursor: null, limit: 250
    });
    expect(JSON.stringify(destination)).not.toContain(OWNER);
    expect(JSON.stringify(destination)).not.toContain(FOREST);
  });

  it('ignores malformed, duplicated and object-shaped locators without private reads', async () => {
    for (const value of ['bad', ['a', 'b'], {}, null, 'https://example.com']) {
      const test = harness();
      expect(await test.resolve({ writingTreeId: value })).toBeNull();
      expect(test.inspectTree).not.toHaveBeenCalled();
    }
    expect(forestReturnTreeId(TREE.toUpperCase())).toBe(TREE);
  });

  it('falls back without placement reads for hidden, inactive, foreign or unauthorized writing', async () => {
    const test = harness();
    test.inspectTree.and.rejectWith(new Error('TREE_INSPECTION_NOT_FOUND'));
    expect(await test.resolve()).toBeNull();
    expect(test.ForestWritingTreeModel.findOne).not.toHaveBeenCalled();
    expect(test.readManifest).not.toHaveBeenCalled();
  });

  it('falls back while reconciling or when inspected identity is inconsistent', async () => {
    for (const inspection of [{ status: 'reconciling' }, { status: 'ready', tree: { id: FOREST } }]) {
      const test = harness({ inspection });
      expect(await test.resolve()).toBeNull();
      expect(test.readManifest).not.toHaveBeenCalled();
    }
  });

  it('falls back if a tree disappears or changes after inspection', async () => {
    const test = harness({ placement: null });
    expect(await test.resolve()).toBeNull();
    expect(test.readManifest).not.toHaveBeenCalled();
  });

  it('rejects unsupported coordinates before regional lookup', async () => {
    for (const placement of [{ worldX: 1e9 + 1, worldY: 0 }, { worldX: 1.5, worldY: 0 }]) {
      const test = harness({ placement });
      expect(await test.resolve()).toBeNull();
      expect(test.readManifest).not.toHaveBeenCalled();
    }
  });

  it('finishes pagination before choosing a position clear of all nearby trees', async () => {
    const blocker = { id: 'another', worldX: TARGET.worldX, worldY: TARGET.worldY + 39, collisionRadius: 20 };
    const test = harness({ pages: [page([TARGET], 'page-two'), page([blocker])] });
    const destination = await test.resolve();
    expect(test.readManifest.calls.mostRecent().args[0].cursor).toBe('page-two');
    expect(Math.hypot(destination.spawn.worldX - blocker.worldX, destination.spawn.worldY - blocker.worldY))
      .toBeGreaterThanOrEqual(SPAWN.radius + blocker.collisionRadius);
  });

  it('falls back rather than scanning beyond four pages or using incomplete evidence', async () => {
    const test = harness({ pages: Array.from({ length: 4 }, (_, index) => page(index ? [] : [TARGET], `page-${index + 1}`)) });
    expect(await test.resolve()).toBeNull();
    expect(test.readManifest).toHaveBeenCalledTimes(4);
  });

  it('falls back on absent, moved, unsupported or failed region results without private logs', async () => {
    for (const result of [page([]), page([{ ...TARGET, worldX: 42 }]), { status: 'reconciling' }]) {
      expect(await harness({ pages: [result] }).resolve()).toBeNull();
    }
    const test = harness();
    test.readManifest.and.rejectWith(new Error('private database details'));
    spyOn(console, 'error');
    expect(await test.resolve()).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('owner forest arrival position', () => {
  it('is repeatable, non-colliding and within interaction range', () => {
    const destination = ownerForestReturnSpawn(SPAWN, TARGET, [TARGET]);
    const distance = Math.hypot(destination.worldX - TARGET.worldX, destination.worldY - TARGET.worldY);
    expect(distance).toBeGreaterThan(SPAWN.radius + TARGET.collisionRadius);
    expect(distance).toBeLessThan(SPAWN.interactionRadius + TARGET.collisionRadius);
    expect(ownerForestReturnSpawn(SPAWN, TARGET, [TARGET])).toEqual(destination);
    expect(destination.movementSpeed).toBe(SPAWN.movementSpeed);
  });

  it('avoids coordinate overflow at each signed world corner', () => {
    for (const worldX of [-1e9, 1e9]) for (const worldY of [-1e9, 1e9]) {
      const target = { ...TARGET, worldX, worldY };
      const destination = ownerForestReturnSpawn(SPAWN, target, [target]);
      expect(destination).not.toBeNull();
      expect(Math.abs(destination.worldX)).toBeLessThanOrEqual(1e9);
      expect(Math.abs(destination.worldY)).toBeLessThanOrEqual(1e9);
    }
  });

  it('declines crowded or absent targets', () => {
    expect(ownerForestReturnSpawn(SPAWN, null, [])).toBeNull();
    expect(ownerForestReturnSpawn(SPAWN, TARGET, [TARGET, { ...TARGET, collisionRadius: 100 }])).toBeNull();
  });
});

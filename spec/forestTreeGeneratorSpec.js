import {
  FOREST_RENDERER_VERSION,
  deriveForestTreeTraits,
  generateForestTree
} from '../server/services/forestTreeGenerator.js';

describe('forest tree generator', () => {
  const post = {
    id: 'post-forest-1',
    roomId: 'united-states',
    createdAt: '2026-07-06T12:00:00.000Z',
    wordCount: 1250,
    collaboratorCount: 1,
    translationCount: 2,
    commentCount: 8,
    reactionCount: 12,
    questApproved: true
  };

  it('produces stable versioned traits and pixels for the same post', () => {
    const first = generateForestTree(post);
    const second = generateForestTree({ ...post });

    expect(first).toEqual(second);
    expect(first.traits.rendererVersion).toBe(FOREST_RENDERER_VERSION);
  });

  it('maps meaningful contribution attributes to tree details', () => {
    const traits = deriveForestTreeTraits(post);

    expect(traits.splitTrunk).toBeTrue();
    expect(traits.blossomCount).toBe(2);
    expect(traits.fruitCount).toBeGreaterThan(0);
    expect(traits.flowerCount).toBe(4);
    expect(traits.fireflyCount).toBe(4);
  });

  it('emits compact, integer-aligned runs within its logical canvas', () => {
    const tree = generateForestTree(post);

    expect(tree.width).toBe(40);
    expect(tree.height).toBe(48);
    expect(tree.runs.length).toBeGreaterThan(20);
    for (const run of tree.runs) {
      expect(Number.isInteger(run.x)).toBeTrue();
      expect(Number.isInteger(run.y)).toBeTrue();
      expect(Number.isInteger(run.width)).toBeTrue();
      expect(run.x).toBeGreaterThanOrEqual(0);
      expect(run.x + run.width).toBeLessThanOrEqual(tree.width);
      expect(run.y).toBeGreaterThanOrEqual(0);
      expect(run.y).toBeLessThan(tree.height);
    }
  });

  it('anchors the crown to the shared trunk and branch skeleton', () => {
    const tree = generateForestTree(post);

    expect(Math.abs(tree.anatomy.supportDelta)).toBeLessThanOrEqual(2);
    expect(tree.anatomy.crownCenter.y).toBeLessThan(tree.anatomy.trunkTopY);
    expect(tree.anatomy.leftTip.x).toBeLessThan(tree.anatomy.trunkTopX);
    expect(tree.anatomy.rightTip.x).toBeGreaterThan(tree.anatomy.trunkTopX);
  });

  it('records designed motifs in their semantic placement zones', () => {
    const tree = generateForestTree(post);
    const motifsByType = type => tree.motifs.filter(motif => motif.type === type);

    expect(motifsByType('blossom').length).toBe(tree.traits.blossomCount);
    expect(motifsByType('fruit').length).toBe(tree.traits.fruitCount);
    expect(motifsByType('flower').length).toBe(tree.traits.flowerCount);
    expect(motifsByType('firefly').length).toBe(tree.traits.fireflyCount);
    expect(motifsByType('flower').every(motif => motif.y >= 40)).toBeTrue();
    expect(motifsByType('firefly').every(motif => motif.y < 36)).toBeTrue();
  });

  it('changes stable traits when the post identity changes', () => {
    const first = deriveForestTreeTraits(post);
    const second = deriveForestTreeTraits({ ...post, id: 'post-forest-2' });

    expect(second.seed).not.toBe(first.seed);
    expect(second).not.toEqual(first);
  });

  it('rejects incomplete post projections', () => {
    expect(() => generateForestTree({ id: 'post-1' })).toThrowError(
      'Forest trees require post id, roomId, and createdAt.'
    );
  });
});

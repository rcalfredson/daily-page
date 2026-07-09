import {
  generateForestTreeGraph,
  generateForestTreeV3
} from '../server/services/forestTreeGeneratorV3.js';

describe('v3 forest branch graph generator', () => {
  const post = { id: 'post-forest-v3-1' };

  it('is structurally deterministic for the same post and seed', () => {
    const first = generateForestTreeGraph(post);
    const second = generateForestTreeGraph({ ...post });

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('uses the explicit seed and produces different growth for another seed', () => {
    const first = generateForestTreeGraph(post, { seed: 101 });
    const repeated = generateForestTreeGraph(post, { seed: 101 });
    const second = generateForestTreeGraph(post, { seed: 202 });

    expect(first).toEqual(repeated);
    expect(second.nodes).not.toEqual(first.nodes);
  });

  it('derives a deterministic, bounded branch starting height for each specimen', () => {
    const observedHeights = new Set();
    for (let seed = 0; seed < 100; seed += 1) {
      const graph = generateForestTreeGraph(post, { seed });
      const [minimum, maximum] = graph.phenotype.architecture.branchStartHeight;
      const { branchStartHeight } = graph.architecture;
      const primaryOrigins = graph.segments
        .filter(segment => graph.nodes[segment.fromId].generation === 0
          && graph.nodes[segment.toId].generation === 1)
        .map(segment => graph.phenotype.groundY - graph.nodes[segment.fromId].worldY);

      expect(branchStartHeight).toBeGreaterThanOrEqual(minimum);
      expect(branchStartHeight).toBeLessThanOrEqual(maximum);
      expect(primaryOrigins.length).toBeGreaterThanOrEqual(graph.phenotype.primaryBranchCount);
      expect(primaryOrigins.every(height => height >= branchStartHeight)).toBeTrue();
      observedHeights.add(branchStartHeight);
    }
    expect(observedHeights.size).toBeGreaterThan(10);
  });

  it('creates a valid rooted graph with one parent per non-root node', () => {
    const graph = generateForestTreeGraph(post);
    const incoming = Array(graph.nodes.length).fill(0);

    expect(graph.nodes[0].parentId).toBeNull();
    expect(graph.segments.length).toBe(graph.nodes.length - 1);
    for (const segment of graph.segments) {
      expect(graph.nodes[segment.fromId]).toBeDefined();
      expect(graph.nodes[segment.toId]).toBeDefined();
      expect(graph.nodes[segment.toId].parentId).toBe(segment.fromId);
      expect(segment.fromId).toBeLessThan(segment.toId);
      incoming[segment.toId] += 1;
    }
    expect(incoming[0]).toBe(0);
    expect(incoming.slice(1).every(count => count === 1)).toBeTrue();
  });

  it('keeps nodes and attraction points within fixed simulation bounds', () => {
    for (const seed of [1, 101, 202, 303, 404, 4294967295]) {
      const graph = generateForestTreeGraph(post, { seed });
      const { phenotype } = graph;
      for (const node of graph.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(phenotype.width);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(phenotype.groundY);
        expect(node.generation).toBeLessThanOrEqual(phenotype.maxGeneration);
        if (node.generation > 0) {
          const dx = node.worldX
            / (phenotype.crown.radiusX * phenotype.growthEnvelopeOverscan);
          const dy = (node.worldY - phenotype.crown.centerY)
            / (phenotype.crown.radiusY * phenotype.growthEnvelopeOverscan);
          const dz = node.worldZ
            / (phenotype.crown.radiusZ * phenotype.growthEnvelopeOverscan);
          expect((dx * dx) + (dy * dy) + (dz * dz)).toBeLessThanOrEqual(1);
        }
      }
      for (const point of graph.attractionPoints) {
        const dx = point.worldX / phenotype.crown.radiusX;
        const dy = (point.worldY - phenotype.crown.centerY) / phenotype.crown.radiusY;
        const dz = point.worldZ / phenotype.crown.radiusZ;
        expect((dx * dx) + (dy * dy) + (dz * dz)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('terminates cleanly and respects structural guardrails across a seed sweep', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const graph = generateForestTreeGraph(post, { seed });
      expect(graph.stats.iterations).toBeLessThanOrEqual(graph.phenotype.maxIterations);
      expect(graph.nodes.length).toBeLessThanOrEqual(graph.phenotype.maxNodes);
      expect(graph.nodes.length).toBeGreaterThan(20);
      expect(graph.terminalNodeIds.length).toBeGreaterThan(3);
      expect(graph.diagnostics.sharpTurnCount).toBe(0);
      expect(graph.diagnostics.crowdedTerminalPairCount)
        .toBeLessThanOrEqual(graph.terminalNodeIds.length);
      expect(graph.diagnostics.maximumTortuosity).toBeLessThan(1.35);
      expect(['node-limit', 'iteration-limit', 'points-consumed', 'growth-exhausted'])
        .toContain(graph.stats.terminationReason);
    }
  });

  it('identifies leaves of the graph as terminal nodes and assigns positive radii', () => {
    const graph = generateForestTreeGraph(post);
    const parents = new Set(graph.segments.map(segment => segment.fromId));
    const expectedTerminals = graph.nodes
      .map(node => node.id)
      .filter(id => !parents.has(id));

    expect(graph.terminalNodeIds).toEqual(expectedTerminals);
    expect(graph.segments.every(segment => segment.radius > 0)).toBeTrue();
    expect(graph.segments.every(segment => segment.fromRadius >= segment.toRadius)).toBeTrue();
  });

  it('grows a persistent leader with primary, secondary, and tertiary branch orders', () => {
    const graph = generateForestTreeGraph(post, { seed: 202 });
    const generations = new Set(graph.nodes.map(node => node.generation));
    const primaryBranches = graph.segments.filter(segment => (
      graph.nodes[segment.fromId].generation === 0
      && graph.nodes[segment.toId].generation === 1
    ));

    expect(generations.has(0)).toBeTrue();
    expect(generations.has(1)).toBeTrue();
    expect(generations.has(2)).toBeTrue();
    expect(generations.has(3)).toBeTrue();
    expect(primaryBranches.length).toBeGreaterThanOrEqual(graph.phenotype.primaryBranchCount);
    for (const segment of graph.segments) {
      const parentOrder = graph.nodes[segment.fromId].generation;
      const childOrder = graph.nodes[segment.toId].generation;
      expect([parentOrder, parentOrder + 1]).toContain(childOrder);
    }
  });

  it('distributes primary scaffolds around the trunk in three dimensions', () => {
    const graph = generateForestTreeGraph(post, { seed: 202 });
    const primaryTips = graph.segments
      .filter(segment => graph.nodes[segment.fromId].generation === 0
        && graph.nodes[segment.toId].generation === 1)
      .map(segment => graph.nodes[segment.toId]);

    expect(primaryTips.some(node => node.worldZ < -0.5)).toBeTrue();
    expect(primaryTips.some(node => node.worldZ > 0.5)).toBeTrue();
    expect(primaryTips.some(node => Math.abs(node.worldX) > 0.5)).toBeTrue();
  });

  it('keeps lower scaffold growth near level instead of strongly pendulous', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const graph = generateForestTreeGraph(post, { seed });
      const lowerBranchSegments = graph.segments.filter(segment => {
        const from = graph.nodes[segment.fromId];
        return from.generation > 0 && from.worldY >= graph.phenotype.lowerBranchFloorY;
      });
      for (const segment of lowerBranchSegments) {
        const from = graph.nodes[segment.fromId];
        const to = graph.nodes[segment.toId];
        const downwardSlope = (to.worldY - from.worldY) / graph.phenotype.internodeLength;
        expect(downwardSlope).toBeLessThanOrEqual(
          graph.phenotype.lowerBranchMaximumDroop + 1e-9
        );
      }
    }
  });

  it('rasterizes deterministic, bounded wood pixels and compact runs', () => {
    const first = generateForestTreeV3(post, { seed: 303 });
    const second = generateForestTreeV3(post, { seed: 303 });

    expect(first.wood).toEqual(second.wood);
    expect(first.wood.runs.length).toBeGreaterThan(50);
    for (const run of first.wood.runs) {
      expect(Number.isInteger(run.x)).toBeTrue();
      expect(Number.isInteger(run.y)).toBeTrue();
      expect(Number.isInteger(run.width)).toBeTrue();
      expect(run.x).toBeGreaterThanOrEqual(0);
      expect(run.x + run.width).toBeLessThanOrEqual(first.wood.width);
      expect(run.y).toBeGreaterThanOrEqual(0);
      expect(run.y).toBeLessThan(first.wood.height);
    }
  });

  it('anchors every individual leaf to a high-order leaf-bearing shoot', () => {
    for (const seed of [101, 202, 303, 404]) {
      const tree = generateForestTreeV3(post, { seed });

      expect(tree.foliage.shoots.length).toBeGreaterThan(4);
      expect(tree.foliage.leaves.length).toBeGreaterThan(40);
      expect(tree.foliage.backRuns.length).toBeGreaterThan(0);
      expect(tree.foliage.frontRuns.length).toBeGreaterThan(0);
      for (const shoot of tree.foliage.shoots) {
        expect(shoot.branchOrder).toBeGreaterThanOrEqual(tree.phenotype.foliageMinimumOrder);
        if (tree.nodes[shoot.nodeId].generation < tree.phenotype.foliageMinimumOrder) {
          expect(shoot.virtual).toBeTrue();
          expect(shoot.terminal).toBeTrue();
        }
        expect(shoot.leafIds.length).toBeGreaterThan(0);
      }
      for (const leaf of tree.foliage.leaves) {
        const shoot = tree.foliage.shoots[leaf.shootId];
        expect(shoot.leafIds).toContain(leaf.id);
        expect(leaf.supportNodeId).toBe(shoot.nodeId);
      }
    }
  });

  it('gives every living terminal a leaf-bearing shoot regardless of branch order', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const tree = generateForestTreeV3(post, { seed });
      const supportedTerminals = new Set(
        tree.foliage.shoots.filter(shoot => shoot.terminal).map(shoot => shoot.nodeId)
      );
      for (const terminalId of tree.terminalNodeIds) {
        expect(supportedTerminals.has(terminalId)).toBeTrue();
      }

      const supportedCells = tree.foliage.coverageCells.filter(cell => cell.supported);
      expect(supportedCells.length).toBeGreaterThan(0);
      expect(supportedCells.filter(cell => cell.coverage === 0).length)
        .toBeLessThanOrEqual(tree.phenotype.foliageMaximumTopUpCells);
    }
  });

  it('uses compact, lineage-diverse rosettes for supplemental foliage repairs', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const tree = generateForestTreeV3(post, { seed });
      const supplemental = tree.foliage.shoots.filter(shoot => shoot.supplemental);
      const shootsByCell = new Map();
      for (const shoot of supplemental) {
        const cellShoots = shootsByCell.get(shoot.coverageCellId) || [];
        cellShoots.push(shoot);
        shootsByCell.set(shoot.coverageCellId, cellShoots);

        const shootLeaves = shoot.leafIds.map(leafId => tree.foliage.leaves[leafId]);
        expect(shoot.endpointX).toBeDefined();
        expect(shoot.endpointY).toBeDefined();
        for (const leaf of shootLeaves) {
          expect(Math.hypot(leaf.x - shoot.endpointX, leaf.y - shoot.endpointY))
            .toBeLessThan(7);
        }
      }
      for (const cellShoots of shootsByCell.values()) {
        expect(new Set(cellShoots.map(shoot => shoot.lineageId)).size)
          .toBe(cellShoots.length);
      }
    }
  });

  it('rasterizes deterministic bounded foliage while preserving crown gaps', () => {
    let foliageOutsideProjectedEllipse = 0;
    for (let seed = 0; seed < 50; seed += 1) {
      const first = generateForestTreeV3(post, { seed });
      const second = generateForestTreeV3(post, { seed });
      let crownPixels = 0;
      let foliagePixels = 0;

      expect(first.foliage).toEqual(second.foliage);
      for (const run of first.foliage.runs) {
        expect(run.x).toBeGreaterThanOrEqual(0);
        expect(run.x + run.width).toBeLessThanOrEqual(first.foliage.width);
        expect(run.y).toBeGreaterThanOrEqual(0);
        expect(run.y).toBeLessThan(first.foliage.height);
      }
      for (let y = 0; y < first.phenotype.height; y += 1) {
        for (let x = 0; x < first.phenotype.width; x += 1) {
          const dx = (x + 0.5 - first.phenotype.crown.centerX)
            / first.phenotype.crown.radiusX;
          const dy = (y + 0.5 - first.phenotype.crown.centerY)
            / first.phenotype.crown.radiusY;
          if ((dx * dx) + (dy * dy) <= 1) {
            crownPixels += 1;
            if (first.foliage.mask[y][x]) foliagePixels += 1;
          } else if (first.foliage.mask[y][x]) {
            foliageOutsideProjectedEllipse += 1;
          }
        }
      }
      const coverage = foliagePixels / crownPixels;
      expect(coverage).toBeGreaterThan(0.06);
      expect(coverage).toBeLessThan(0.68);
    }
    expect(foliageOutsideProjectedEllipse).toBeGreaterThan(0);
  });

  it('produces one connected wood silhouette including every graph node', () => {
    const tree = generateForestTreeV3(post, { seed: 404 });
    const { mask, width, height } = tree.wood;
    const occupied = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (mask[y][x]) occupied.push([x, y]);
      }
    }

    const key = (x, y) => `${x}:${y}`;
    const visited = new Set([key(...occupied[0])]);
    const queue = [occupied[0]];
    const neighbors = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => [dx, dy]))
      .filter(([dx, dy]) => dx || dy);
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of neighbors) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height
          || !mask[nextY][nextX] || visited.has(key(nextX, nextY))) continue;
        visited.add(key(nextX, nextY));
        queue.push([nextX, nextY]);
      }
    }

    expect(visited.size).toBe(occupied.length);
    for (const node of tree.nodes) {
      const x = Math.max(0, Math.min(width - 1, Math.floor(node.x)));
      const y = Math.max(0, Math.min(height - 1, Math.floor(node.y)));
      const touchesWood = neighbors.concat([[0, 0]])
        .some(([dx, dy]) => mask[y + dy]?.[x + dx]);
      expect(touchesWood).toBeTrue();
    }
  });

  it('widens the base with a root flare and tapers toward terminal twigs', () => {
    const tree = generateForestTreeV3(post, { seed: 101 });
    const root = tree.nodes[0];
    const bottomWidth = tree.wood.mask[tree.phenotype.groundY].filter(Boolean).length;
    const flareTopY = tree.phenotype.groundY - tree.phenotype.rootFlareHeight;
    const upperWidth = tree.wood.mask[flareTopY].filter(Boolean).length;
    const terminalRadii = tree.terminalNodeIds.map(id => tree.nodes[id].radius);

    expect(bottomWidth).toBeGreaterThan(upperWidth);
    expect(root.radius).toBeGreaterThan(Math.max(...terminalRadii));
  });
});

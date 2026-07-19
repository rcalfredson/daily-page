import {
  generateForestTreeGraph,
  generateForestTreeV3
} from '../server/services/forestTreeGeneratorV3.js';
import { FOREST_FOLIAGE_MOTION_GROUP_COUNT } from '../server/services/forest/v3/rasterizeFoliage.js';
import {
  DECIDUOUS_PHENOTYPE,
  HIGHLAND_CONIFER_PHENOTYPE
} from '../server/services/forest/v3/phenotype.js';

describe('v3 forest branch graph generator', () => {
  const post = { id: 'post-forest-v3-1' };

  function splitLeaderWeights(graph) {
    const children = graph.nodes.map(() => []);
    for (const segment of graph.segments) children[segment.fromId].push(segment.toId);
    const fork = graph.nodes.find(node => node.generation === 0
      && children[node.id].filter(id => graph.nodes[id].generation === 0).length === 2);
    const leaderRoots = children[fork.id]
      .map(id => graph.nodes[id])
      .filter(node => node.generation === 0);
    return leaderRoots.map(node => node.radius ** graph.phenotype.pipeExponent);
  }

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

  it('derives deterministic, bounded, meaningfully varied trunk architecture', () => {
    const observedBaseRadii = new Set();
    const observedTapers = new Set();
    const observedLeanAngles = new Set();
    const observedLeanAzimuths = new Set();
    const observedSplitHeights = new Set();
    const observedSplitAngles = new Set();
    const observedSplitStates = new Set();
    const observedLeaderBalances = new Set();
    const observedDominantLeaders = new Set();
    for (let seed = 0; seed < 100; seed += 1) {
      const first = generateForestTreeGraph(post, { seed });
      const repeated = generateForestTreeGraph(post, { seed });
      const architecture = first.architecture;
      const ranges = first.phenotype.architecture;

      expect(repeated.architecture).toEqual(architecture);
      expect(architecture.trunkBaseRadius).toBeGreaterThanOrEqual(ranges.trunkBaseRadius[0]);
      expect(architecture.trunkBaseRadius).toBeLessThanOrEqual(ranges.trunkBaseRadius[1]);
      expect(architecture.trunkTaper).toBeGreaterThanOrEqual(ranges.trunkTaper[0]);
      expect(architecture.trunkTaper).toBeLessThanOrEqual(ranges.trunkTaper[1]);
      expect(architecture.trunkLeanAngle).toBeGreaterThanOrEqual(ranges.trunkLeanAngle[0]);
      expect(architecture.trunkLeanAngle).toBeLessThanOrEqual(ranges.trunkLeanAngle[1]);
      expect(architecture.trunkLeanAzimuth).toBeGreaterThanOrEqual(ranges.trunkLeanAzimuth[0]);
      expect(architecture.trunkLeanAzimuth).toBeLessThanOrEqual(ranges.trunkLeanAzimuth[1]);
      expect(architecture.splitTrunkHeight).toBeGreaterThanOrEqual(ranges.splitTrunkHeight[0]);
      expect(architecture.splitTrunkHeight).toBeLessThanOrEqual(ranges.splitTrunkHeight[1]);
      expect(architecture.splitTrunkAngle).toBeGreaterThanOrEqual(ranges.splitTrunkAngle[0]);
      expect(architecture.splitTrunkAngle).toBeLessThanOrEqual(ranges.splitTrunkAngle[1]);
      expect(architecture.splitTrunkAzimuth).toBeGreaterThanOrEqual(ranges.splitTrunkAzimuth[0]);
      expect(architecture.splitTrunkAzimuth).toBeLessThanOrEqual(ranges.splitTrunkAzimuth[1]);
      expect(architecture.leaderBalance).toBeGreaterThanOrEqual(ranges.leaderBalance[0]);
      expect(architecture.leaderBalance).toBeLessThanOrEqual(ranges.leaderBalance[1]);
      expect([0, 1]).toContain(architecture.dominantLeaderIndex);
      expect(first.nodes[0].radius + 1e-9).toBeGreaterThanOrEqual(
        architecture.trunkBaseRadius
      );
      observedBaseRadii.add(architecture.trunkBaseRadius);
      observedTapers.add(architecture.trunkTaper);
      observedLeanAngles.add(architecture.trunkLeanAngle);
      observedLeanAzimuths.add(architecture.trunkLeanAzimuth);
      observedSplitHeights.add(architecture.splitTrunkHeight);
      observedSplitAngles.add(architecture.splitTrunkAngle);
      observedSplitStates.add(architecture.hasSplitTrunk);
      observedLeaderBalances.add(architecture.leaderBalance);
      observedDominantLeaders.add(architecture.dominantLeaderIndex);
    }
    expect(observedBaseRadii.size).toBeGreaterThan(20);
    expect(observedTapers.size).toBeGreaterThan(20);
    expect(observedLeanAngles.size).toBeGreaterThan(20);
    expect(observedLeanAzimuths.size).toBeGreaterThan(80);
    expect(observedSplitHeights.size).toBeGreaterThan(15);
    expect(observedSplitAngles.size).toBeGreaterThan(20);
    expect(observedSplitStates).toEqual(new Set([true, false]));
    expect(observedLeaderBalances.size).toBeGreaterThan(50);
    expect(observedDominantLeaders).toEqual(new Set([0, 1]));
  });

  it('keeps leader balance isolated from forced single-trunk growth', () => {
    const phenotype = generateForestTreeGraph(post, { seed: 202 }).phenotype;
    const generate = leaderBalance => generateForestTreeGraph(post, {
      seed: 202,
      phenotype: {
        ...phenotype,
        architecture: {
          ...phenotype.architecture,
          splitTrunkProbability: 0,
          leaderBalance: [leaderBalance, leaderBalance]
        }
      }
    });
    const balanced = generate(1);
    const asymmetric = generate(0.78);

    expect(balanced.architecture.hasSplitTrunk).toBeFalse();
    expect(asymmetric.architecture.hasSplitTrunk).toBeFalse();
    expect(asymmetric.nodes).toEqual(balanced.nodes);
    expect(asymmetric.segments).toEqual(balanced.segments);
    expect(asymmetric.remainingAttractionPointIds).toEqual(balanced.remainingAttractionPointIds);
  });

  it('keeps two viable leaders while balance predicts downstream pipe weight', () => {
    let strongerLeaderWins = 0;
    let asymmetricRatioTotal = 0;
    let balancedRatioTotal = 0;
    const seeds = Array.from({ length: 50 }, (_, seed) => seed);

    for (const seed of seeds) {
      const phenotype = generateForestTreeGraph(post, { seed }).phenotype;
      const generate = leaderBalance => generateForestTreeGraph(post, {
        seed,
        phenotype: {
          ...phenotype,
          architecture: {
            ...phenotype.architecture,
            splitTrunkProbability: 1,
            leaderBalance: [leaderBalance, leaderBalance]
          }
        }
      });
      const asymmetric = generate(0.78);
      const balanced = generate(1);
      const dominant = asymmetric.architecture.dominantLeaderIndex;
      const weak = 1 - dominant;
      const asymmetricWeights = splitLeaderWeights(asymmetric);
      const balancedWeights = splitLeaderWeights(balanced);
      const descendants = [0, 1].map(leaderIndex => (
        asymmetric.nodes.filter(node => node.leaderIndex === leaderIndex)
      ));

      expect(descendants.every(nodes => nodes.length > 20)).toBeTrue();
      expect(asymmetricWeights.every(weight => weight
        > asymmetric.phenotype.terminalRadius ** asymmetric.phenotype.pipeExponent)).toBeTrue();
      if (asymmetricWeights[dominant] > asymmetricWeights[weak]) strongerLeaderWins += 1;
      asymmetricRatioTotal += asymmetricWeights[dominant] / asymmetricWeights[weak];
      balancedRatioTotal += balancedWeights[dominant] / balancedWeights[weak];
    }

    expect(strongerLeaderWins).toBeGreaterThanOrEqual(45);
    expect(asymmetricRatioTotal / seeds.length)
      .toBeGreaterThan((balancedRatioTotal / seeds.length) + 0.5);
  });

  it('builds a bounded major fork with two persistent trunk leaders when enabled', () => {
    const phenotype = generateForestTreeGraph(post, { seed: 202 }).phenotype;
    const split = generateForestTreeGraph(post, {
      seed: 202,
      phenotype: {
        ...phenotype,
        architecture: { ...phenotype.architecture, splitTrunkProbability: 1 }
      }
    });
    const children = split.nodes.map(() => []);
    for (const segment of split.segments) children[segment.fromId].push(segment.toId);
    const trunkForks = split.nodes.filter(node => node.generation === 0
      && children[node.id].filter(id => split.nodes[id].generation === 0).length === 2);
    const fork = trunkForks[0];
    const trunkChildren = children[fork.id].map(id => split.nodes[id])
      .filter(node => node.generation === 0);
    const forkHeight = split.phenotype.groundY - fork.worldY;
    const primaryOrigins = split.segments
      .filter(segment => split.nodes[segment.fromId].generation === 0
        && split.nodes[segment.toId].generation === 1)
      .map(segment => split.phenotype.groundY - split.nodes[segment.fromId].worldY);

    expect(split.architecture.hasSplitTrunk).toBeTrue();
    expect(trunkForks.length).toBe(1);
    expect(Math.abs(forkHeight - split.architecture.splitTrunkHeight))
      .toBeLessThanOrEqual(split.phenotype.internodeLength);
    expect(trunkChildren.length).toBe(2);
    expect(trunkChildren.every(child => child.parentId === fork.id)).toBeTrue();
    expect(trunkChildren.every(child => child.radius < fork.radius)).toBeTrue();
    expect(primaryOrigins.every(height => height > forkHeight)).toBeTrue();
  });

  it('retains a single persistent trunk when split trunks are disabled', () => {
    const phenotype = generateForestTreeGraph(post, { seed: 202 }).phenotype;
    const single = generateForestTreeGraph(post, {
      seed: 202,
      phenotype: {
        ...phenotype,
        architecture: { ...phenotype.architecture, splitTrunkProbability: 0 }
      }
    });
    const trunkChildCounts = single.nodes.map(node => single.segments.filter(segment => (
      segment.fromId === node.id && single.nodes[segment.toId].generation === 0
    )).length);

    expect(single.architecture.hasSplitTrunk).toBeFalse();
    expect(trunkChildCounts.every(count => count <= 1)).toBeTrue();
  });

  it('applies trunk lean as a coherent scaffold direction', () => {
    const phenotype = generateForestTreeGraph(post, { seed: 202 }).phenotype;
    const architecture = {
      ...phenotype.architecture,
      splitTrunkProbability: 0,
      trunkLeanAzimuth: [0, 0]
    };
    const upright = generateForestTreeGraph(post, {
      seed: 202,
      phenotype: {
        ...phenotype,
        architecture: { ...architecture, trunkLeanAngle: [0, 0] }
      }
    });
    const leaned = generateForestTreeGraph(post, {
      seed: 202,
      phenotype: {
        ...phenotype,
        architecture: { ...architecture, trunkLeanAngle: [0.08, 0.08] }
      }
    });
    const uprightScaffoldEnd = upright.nodes.findIndex(node => node.generation === 1);
    const leanedScaffoldEnd = leaned.nodes.findIndex(node => node.generation === 1);
    const uprightTrunk = upright.nodes.slice(0, uprightScaffoldEnd);
    const leanedTrunk = leaned.nodes.slice(0, leanedScaffoldEnd);

    expect(leanedTrunk.length).toBe(uprightTrunk.length);
    expect(leanedTrunk.at(-1).worldX).toBeGreaterThan(uprightTrunk.at(-1).worldX + 4);
    expect(Math.abs(leanedTrunk.at(-1).worldZ - uprightTrunk.at(-1).worldZ))
      .toBeLessThan(0.5);
    expect(leanedTrunk.slice(1).every((node, index) => (
      node.worldX > uprightTrunk[index + 1].worldX
    ))).toBeTrue();
  });

  it('applies trunk traits without changing growth geometry or branch radii', () => {
    const phenotype = generateForestTreeGraph(post, { seed: 202 }).phenotype;
    const thinArchitecture = {
      ...phenotype.architecture,
      splitTrunkProbability: 0,
      trunkBaseRadius: [3.1, 3.1],
      trunkTaper: [0.72, 0.72]
    };
    const thickArchitecture = {
      ...phenotype.architecture,
      splitTrunkProbability: 0,
      trunkBaseRadius: [4.1, 4.1],
      trunkTaper: [1.32, 1.32]
    };
    const thin = generateForestTreeGraph(post, {
      seed: 202,
      phenotype: { ...phenotype, architecture: thinArchitecture }
    });
    const thick = generateForestTreeGraph(post, {
      seed: 202,
      phenotype: { ...phenotype, architecture: thickArchitecture }
    });

    expect(thick.nodes.map(node => [node.x, node.y, node.depth, node.parentId, node.generation]))
      .toEqual(thin.nodes.map(node => [node.x, node.y, node.depth, node.parentId, node.generation]));
    expect(thick.nodes.filter(node => node.generation > 0).map(node => node.radius))
      .toEqual(thin.nodes.filter(node => node.generation > 0).map(node => node.radius));
    expect(thick.nodes[0].radius).toBeGreaterThan(thin.nodes[0].radius);
    for (const graph of [thin, thick]) {
      const trunkRadii = graph.nodes.filter(node => node.generation === 0)
        .map(node => node.radius);
      expect(trunkRadii.every((radius, index) => index === 0
        || radius <= trunkRadii[index - 1] + 1e-9)).toBeTrue();
    }
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
      const groupByLineage = new Map();
      for (const shoot of tree.foliage.shoots) {
        expect(shoot.branchOrder).toBeGreaterThanOrEqual(tree.phenotype.foliageMinimumOrder);
        if (tree.nodes[shoot.nodeId].generation < tree.phenotype.foliageMinimumOrder) {
          expect(shoot.virtual).toBeTrue();
          expect(shoot.terminal).toBeTrue();
        }
        expect(shoot.leafIds.length).toBeGreaterThan(0);
        if (groupByLineage.has(shoot.lineageId)) {
          expect(shoot.motionGroupId).toBe(groupByLineage.get(shoot.lineageId));
        } else groupByLineage.set(shoot.lineageId, shoot.motionGroupId);
      }
      expect(new Set(groupByLineage.values()).size)
        .toBeLessThanOrEqual(FOREST_FOLIAGE_MOTION_GROUP_COUNT);
      for (const leaf of tree.foliage.leaves) {
        const shoot = tree.foliage.shoots[leaf.shootId];
        expect(shoot.leafIds).toContain(leaf.id);
        expect(leaf.supportNodeId).toBe(shoot.nodeId);
        expect(leaf.motionGroupId).toBe(shoot.motionGroupId);
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

  it('produces a narrow, single-leader conifer family with tiered needle sprays', () => {
    const ratios = { conifer: [], deciduous: [] };
    const coniferWidths = new Set();
    const coniferLeafCounts = new Set();
    let splitCount = 0;
    for (let seed = 0; seed < 24; seed += 1) {
      const conifer = generateForestTreeV3(post, {
        seed, phenotype: HIGHLAND_CONIFER_PHENOTYPE
      });
      const repeated = generateForestTreeV3(post, {
        seed, phenotype: HIGHLAND_CONIFER_PHENOTYPE
      });
      const deciduous = generateForestTreeGraph(post, { seed, phenotype: DECIDUOUS_PHENOTYPE });
      const dimensions = graph => ({
        width: Math.max(...graph.nodes.map(node => node.x))
          - Math.min(...graph.nodes.map(node => node.x)),
        height: graph.phenotype.groundY - Math.min(...graph.nodes.map(node => node.y))
      });
      const coniferSize = dimensions(conifer);
      const deciduousSize = dimensions(deciduous);
      ratios.conifer.push(coniferSize.height / coniferSize.width);
      ratios.deciduous.push(deciduousSize.height / deciduousSize.width);
      coniferWidths.add(Math.round(coniferSize.width));
      coniferLeafCounts.add(conifer.foliage.leaves.length);
      if (conifer.architecture.hasSplitTrunk) splitCount += 1;

      expect(repeated).toEqual(conifer);
      expect(conifer.stats.terminationReason).toBe('growth-exhausted');
      expect(conifer.nodes.length).toBeLessThanOrEqual(conifer.phenotype.maxNodes);
      expect(conifer.nodes.filter(node => node.generation === 0).some(
        node => node.y < conifer.phenotype.crown.centerY - (conifer.phenotype.crown.radiusY * 0.8)
      )).toBeTrue();
      expect(conifer.foliage.leaves.every(leaf => leaf.style === 'needle-spray')).toBeTrue();
      expect(new Set(conifer.foliage.coverageCells.filter(cell => cell.supported)
        .map(cell => cell.row)).size).toBeGreaterThan(5);
    }
    const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(average(ratios.conifer)).toBeGreaterThan(average(ratios.deciduous) * 1.35);
    expect(splitCount).toBeLessThanOrEqual(2);
    expect(coniferWidths.size).toBeGreaterThan(5);
    expect(coniferLeafCounts.size).toBeGreaterThan(18);
  });

  it('rejects unbounded shared crown-density, wind-bias, and foliage-style inputs', () => {
    expect(() => generateForestTreeGraph(post, {
      phenotype: { ...HIGHLAND_CONIFER_PHENOTYPE, attractionDensityByHeight: [1.2, 0.5] }
    })).toThrowError(/height-density/);
    expect(() => generateForestTreeGraph(post, {
      phenotype: {
        ...HIGHLAND_CONIFER_PHENOTYPE,
        directionalGrowthBias: { x: 0.3, y: 0, z: 0 }
      }
    })).toThrowError(/Directional growth bias/);
    expect(() => generateForestTreeV3(post, {
      phenotype: { ...HIGHLAND_CONIFER_PHENOTYPE, foliageStyle: 'frond' }
    })).toThrowError(/foliage style/);
  });
});

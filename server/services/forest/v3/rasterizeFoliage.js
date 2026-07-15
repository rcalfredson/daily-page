import { createRandom } from './random.js';

const EMPTY = null;

export const FOREST_FOLIAGE_MOTION_GROUP_COUNT = 3;

export const FOLIAGE_PALETTE = Object.freeze({
  highlight: '#9fbe59',
  light: '#73a34a',
  mid: '#4f843f',
  dark: '#2e6339',
  deep: '#214a35'
});

export function selectFoliagePalette(phenotype, seed) {
  const variants = phenotype.foliagePalettes;
  if (!variants?.length) {
    return { id: 'default', colors: phenotype.foliagePalette || FOLIAGE_PALETTE };
  }
  const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
  if (!(totalWeight > 0)) throw new Error('Foliage palette weights must total more than zero.');
  let choice = createRandom(seed ^ 0xC0104A11)() * totalWeight;
  for (const variant of variants) {
    choice -= variant.weight;
    if (choice < 0) return variant;
  }
  return variants.at(-1);
}

function makeGrid(width, height, value = EMPTY) {
  return Array.from({ length: height }, () => Array(width).fill(value));
}

function randomBetween(random, range) {
  return range[0] + ((range[1] - range[0]) * random());
}

function randomInteger(random, range) {
  return Math.floor(randomBetween(random, [range[0], range[1] + 1]));
}

function supportingSegmentByNode(graph) {
  return new Map(graph.segments.map(segment => [segment.toId, segment]));
}

function primaryLineageByNode(graph) {
  const lineages = new Map();
  const lineageFor = node => {
    if (lineages.has(node.id)) return lineages.get(node.id);
    let lineage = node;
    let parent = node.parentId === null ? null : graph.nodes[node.parentId];
    while (parent && parent.generation > 0) {
      lineage = parent;
      parent = parent.parentId === null ? null : graph.nodes[parent.parentId];
    }
    lineages.set(node.id, lineage.id);
    return lineage.id;
  };
  for (const node of graph.nodes) lineageFor(node);
  return lineages;
}

function leafCountFor(node, terminal, phenotype, random) {
  if (terminal) return randomInteger(random, phenotype.terminalLeafCount);
  if (node.generation >= 3) return randomInteger(random, phenotype.highOrderLeafCount);
  return randomInteger(random, phenotype.secondaryLeafCount);
}

export function generateLeafBearingShoots(graph, phenotype, seed) {
  const random = createRandom(seed ^ 0xF011A9E);
  const terminals = new Set(graph.terminalNodeIds);
  const incoming = supportingSegmentByNode(graph);
  const primaryLineages = primaryLineageByNode(graph);
  const candidates = graph.nodes.filter(node => incoming.has(node.id)
    && (terminals.has(node.id) || node.generation >= phenotype.foliageMinimumOrder));
  const shoots = [];
  const leaves = [];

  const addShoot = (node, options = {}) => {
    const terminal = terminals.has(node.id);
    const segment = incoming.get(node.id);
    const parent = graph.nodes[segment.fromId];
    const branchAngle = Math.atan2(node.y - parent.y, node.x - parent.x);
    const shootAngle = options.targetAngle ?? branchAngle;
    const count = options.count || leafCountFor(node, terminal, phenotype, random);
    const branchOrder = Math.max(node.generation, phenotype.foliageMinimumOrder);
    const shoot = {
      id: shoots.length,
      nodeId: node.id,
      segmentId: graph.segments.indexOf(segment),
      branchOrder,
      terminal,
      virtual: node.generation < phenotype.foliageMinimumOrder,
      supplemental: Boolean(options.supplemental),
      coverageCellId: options.coverageCellId ?? null,
      lineageId: primaryLineages.get(node.id),
      depth: node.depth,
      leafIds: []
    };
    const spread = randomBetween(random, phenotype.leafShootSpread)
      * (terminal ? 1 : 0.72);
    const targetDistance = options.supplemental
      ? Math.hypot(options.targetX - node.x, options.targetY - node.y)
      : 0;
    const endpointDistance = Math.min(targetDistance, Math.max(4, spread * 1.05));
    const endpoint = options.supplemental
      ? {
        x: node.x + (Math.cos(shootAngle) * endpointDistance),
        y: node.y + (Math.sin(shootAngle) * endpointDistance)
      }
      : null;
    const rosetteRadius = options.supplemental ? spread * (0.48 + (random() * 0.12)) : 0;
    const rosetteAspect = options.supplemental ? 0.84 + (random() * 0.32) : 1;
    if (endpoint) {
      shoot.endpointX = endpoint.x;
      shoot.endpointY = endpoint.y;
    }
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 ? -1 : 1;
      const along = count === 1 ? 0 : (index / (count - 1)) - 0.5;
      const rosetteAngle = (index * 2.399963229728653)
        + ((random() - 0.5) * 0.38);
      const fanAngle = options.supplemental
        ? rosetteAngle
        : shootAngle + (side * (0.52 + (random() * 0.46)))
          + ((random() - 0.5) * 0.24);
      const distance = spread * (0.25 + (Math.abs(along) * 0.9) + (random() * 0.22));
      const perspective = 1 + ((node.depth / phenotype.crown.radiusZ)
        * phenotype.perspectiveStrength);
      const guaranteedTerminalTip = terminal && !options.supplemental && index === 0;
      let position;
      if (options.supplemental) {
        const radius = rosetteRadius * Math.sqrt((index + 0.45) / count)
          * (0.82 + (random() * 0.28));
        position = {
          x: endpoint.x + (Math.cos(rosetteAngle) * radius * rosetteAspect),
          y: endpoint.y + (Math.sin(rosetteAngle) * radius / rosetteAspect)
        };
      } else if (guaranteedTerminalTip) {
        position = { x: node.x, y: node.y };
      } else {
        position = {
          x: node.x + (Math.cos(fanAngle) * distance)
            + (Math.cos(branchAngle) * along * spread * 0.8),
          y: node.y + (Math.sin(fanAngle) * distance * 0.66)
            + (Math.sin(branchAngle) * along * spread * 0.8)
        };
      }
      if (!guaranteedTerminalTip && leaves.some(existing => Math.hypot(
        existing.x - position.x,
        existing.y - position.y
      ) < phenotype.foliageMinimumLeafSpacing)) continue;
      const leaf = {
        id: leaves.length,
        shootId: shoot.id,
        supportNodeId: node.id,
        branchOrder,
        x: position.x,
        y: position.y,
        depth: node.depth + ((random() - 0.5) * 2.4),
        angle: fanAngle + (Math.PI / 2)
          + ((random() - 0.5) * (options.supplemental ? 0.72 : 0.32)),
        radiusX: randomBetween(random, phenotype.leafRadiusX) * perspective,
        radiusY: randomBetween(random, phenotype.leafRadiusY) * perspective,
        tone: random(),
        massLight: 0
      };
      const crownX = (leaf.x - phenotype.crown.centerX) / phenotype.crown.radiusX;
      const crownY = (leaf.y - phenotype.crown.centerY) / phenotype.crown.radiusY;
      leaf.massLight = clampLight(
        0.52 - (crownX * 0.16) - (crownY * 0.3)
          + ((leaf.depth / phenotype.crown.radiusZ) * 0.08)
      );
      leaves.push(leaf);
      shoot.leafIds.push(leaf.id);
    }
    if (shoot.leafIds.length) shoots.push(shoot);
  };

  for (const node of candidates) {
    const terminal = terminals.has(node.id);
    if (!terminal && node.generation === phenotype.foliageMinimumOrder
      && random() > phenotype.secondaryShootProbability) continue;
    addShoot(node);
  }

  const coverageCells = measureCoverageCells(leaves, candidates, phenotype);
  const topUpCells = coverageCells
    .filter(cell => cell.supported && cell.coverage < phenotype.foliageMinimumCellCoverage)
    .sort((first, second) => first.coverage - second.coverage || first.id - second.id)
    .slice(0, phenotype.foliageMaximumTopUpCells);
  for (const cell of topUpCells) {
    const rankedSupports = candidates.slice().sort((first, second) => (
      Math.hypot(first.x - cell.x, first.y - cell.y)
      - Math.hypot(second.x - cell.x, second.y - cell.y)
      || second.generation - first.generation
      || first.id - second.id
    ));
    const usedLineages = new Set();
    const supports = [];
    for (const support of rankedSupports) {
      const lineageId = primaryLineages.get(support.id);
      if (usedLineages.has(lineageId)) continue;
      usedLineages.add(lineageId);
      supports.push(support);
      if (supports.length >= phenotype.foliageTopUpSupportsPerCell) break;
    }
    for (const support of supports) {
      addShoot(support, {
        count: randomInteger(random, phenotype.foliageSupplementalLeafCount),
        supplemental: true,
        coverageCellId: cell.id,
        targetAngle: Math.atan2(cell.y - support.y, cell.x - support.x),
        targetX: cell.x,
        targetY: cell.y
      });
    }
  }
  return {
    shoots,
    leaves,
    coverageCells: measureCoverageCells(leaves, candidates, phenotype)
  };
}

function clampLight(value) {
  return Math.max(0, Math.min(1, value));
}

function leafContainsPoint(leaf, x, y) {
  const cosine = Math.cos(leaf.angle);
  const sine = Math.sin(leaf.angle);
  const dx = x - leaf.x;
  const dy = y - leaf.y;
  const localX = (dx * cosine) + (dy * sine);
  const localY = (-dx * sine) + (dy * cosine);
  return Math.abs(localX / leaf.radiusX) ** 1.55
    + Math.abs(localY / leaf.radiusY) ** 1.18 <= 1;
}

function measureCoverageCells(leaves, supports, phenotype) {
  const cells = [];
  const left = phenotype.crown.centerX - phenotype.crown.radiusX;
  const top = phenotype.crown.centerY - phenotype.crown.radiusY;
  const cellWidth = (phenotype.crown.radiusX * 2) / phenotype.foliageCoverageColumns;
  const cellHeight = (phenotype.crown.radiusY * 2) / phenotype.foliageCoverageRows;
  for (let row = 0; row < phenotype.foliageCoverageRows; row += 1) {
    for (let column = 0; column < phenotype.foliageCoverageColumns; column += 1) {
      const x = left + ((column + 0.5) * cellWidth);
      const y = top + ((row + 0.5) * cellHeight);
      const supported = supports.some(node => Math.hypot(node.x - x, node.y - y)
        <= phenotype.foliageSupportRadius);
      let covered = 0;
      let samples = 0;
      for (let sampleY = 0; sampleY < phenotype.foliageCoverageSamples; sampleY += 1) {
        for (let sampleX = 0; sampleX < phenotype.foliageCoverageSamples; sampleX += 1) {
          const pointX = x + (((sampleX + 0.5) / phenotype.foliageCoverageSamples - 0.5)
            * cellWidth);
          const pointY = y + (((sampleY + 0.5) / phenotype.foliageCoverageSamples - 0.5)
            * cellHeight);
          samples += 1;
          if (leaves.some(leaf => leafContainsPoint(leaf, pointX, pointY))) covered += 1;
        }
      }
      cells.push({
        id: cells.length,
        row,
        column,
        x,
        y,
        supported,
        coverage: covered / samples
      });
    }
  }
  return cells;
}

function paintLeaf(mask, owner, leaf, phenotype) {
  const radius = Math.max(leaf.radiusX, leaf.radiusY) + 1;
  const minimumX = Math.max(0, Math.floor(leaf.x - radius));
  const maximumX = Math.min(phenotype.width - 1, Math.ceil(leaf.x + radius));
  const minimumY = Math.max(0, Math.floor(leaf.y - radius));
  const maximumY = Math.min(phenotype.height - 1, Math.ceil(leaf.y + radius));
  const cosine = Math.cos(leaf.angle);
  const sine = Math.sin(leaf.angle);
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const dx = x + 0.5 - leaf.x;
      const dy = y + 0.5 - leaf.y;
      const localX = (dx * cosine) + (dy * sine);
      const localY = (-dx * sine) + (dy * cosine);
      const normalizedX = localX / leaf.radiusX;
      const normalizedY = localY / leaf.radiusY;
      const almond = Math.abs(normalizedX) ** 1.55 + Math.abs(normalizedY) ** 1.18;
      if (almond > 1) continue;
      mask[y][x] = true;
      owner[y][x] = { leaf, localX, localY, normalizedX, normalizedY };
    }
  }
}

function shadeLeaves(mask, owner, palette) {
  const pixels = makeGrid(mask[0].length, mask.length);
  for (let y = 0; y < mask.length; y += 1) {
    for (let x = 0; x < mask[y].length; x += 1) {
      if (!mask[y][x]) continue;
      const sample = owner[y][x];
      const { leaf } = sample;
      const upperLeft = sample.normalizedX + sample.normalizedY < -0.38;
      const centralVein = Math.abs(sample.localX) < 0.48;
      if (upperLeft && leaf.massLight > 0.68 && leaf.tone > 0.62) {
        pixels[y][x] = palette.highlight;
      } else if (centralVein && sample.normalizedY < 0.35
        && leaf.massLight > 0.52 && leaf.tone > 0.42) {
        pixels[y][x] = palette.light;
      } else if (leaf.massLight < 0.3 || leaf.depth < -8 || leaf.tone < 0.14) {
        pixels[y][x] = palette.deep;
      } else if (sample.normalizedX > 0.3) pixels[y][x] = palette.dark;
      else pixels[y][x] = palette.mid;
    }
  }
  return pixels;
}

function compactRuns(pixels) {
  const runs = [];
  for (let y = 0; y < pixels.length; y += 1) {
    let x = 0;
    while (x < pixels[y].length) {
      const color = pixels[y][x];
      if (!color) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < pixels[y].length && pixels[y][x] === color) x += 1;
      runs.push({ x: start, y, width: x - start, color });
    }
  }
  return runs;
}

function assignFoliageMotionGroups(graph, shoots, leaves) {
  const lineages = new Map();
  for (const shoot of shoots) {
    if (!lineages.has(shoot.lineageId)) lineages.set(shoot.lineageId, { x: 0, count: 0 });
    const lineage = lineages.get(shoot.lineageId);
    for (const leafId of shoot.leafIds) {
      lineage.x += leaves[leafId].x;
      lineage.count += 1;
    }
  }
  const orderedLineageIds = [...lineages.entries()].sort((first, second) => (
    (first[1].x / first[1].count) - (second[1].x / second[1].count)
      || first[0] - second[0]
  )).map(([lineageId]) => lineageId);
  const groupByLineage = new Map(orderedLineageIds.map((lineageId, index) => [
    lineageId,
    Math.min(FOREST_FOLIAGE_MOTION_GROUP_COUNT - 1, Math.floor(
      (index * FOREST_FOLIAGE_MOTION_GROUP_COUNT) / orderedLineageIds.length
    ))
  ]));
  for (const shoot of shoots) {
    shoot.motionGroupId = groupByLineage.get(shoot.lineageId);
    for (const leafId of shoot.leafIds) leaves[leafId].motionGroupId = shoot.motionGroupId;
  }
  return Array.from({ length: FOREST_FOLIAGE_MOTION_GROUP_COUNT }, (_, index) => {
    const groupShoots = shoots.filter(shoot => shoot.motionGroupId === index);
    const attachment = groupShoots.reduce((sum, shoot) => ({
      x: sum.x + graph.nodes[shoot.nodeId].x,
      y: sum.y + graph.nodes[shoot.nodeId].y
    }), { x: 0, y: 0 });
    const groupSize = Math.max(1, groupShoots.length);
    return {
      id: `crown-${index}`,
      index,
      attachment: {
        x: Number((attachment.x / groupSize).toFixed(2)),
        y: Number((attachment.y / groupSize).toFixed(2))
      },
      windResponse: {
        phaseOffset: (index - 1) * 0.72,
        amplitude: [0.82, 1, 0.9][index]
      }
    };
  });
}

function compactMotionGroups(pixels, owner, motionGroups) {
  const groupPixels = Array.from({ length: FOREST_FOLIAGE_MOTION_GROUP_COUNT }, () => (
    makeGrid(pixels[0].length, pixels.length)
  ));
  for (let y = 0; y < pixels.length; y += 1) {
    for (let x = 0; x < pixels[y].length; x += 1) {
      if (pixels[y][x]) groupPixels[owner[y][x].leaf.motionGroupId][y][x] = pixels[y][x];
    }
  }
  return groupPixels.map((group, index) => ({
    ...motionGroups[index],
    runs: compactRuns(group)
  })).filter(group => group.runs.length);
}

function rasterizeLayer(leaves, layer, phenotype, palette, motionGroups) {
  const mask = makeGrid(phenotype.width, phenotype.height, false);
  const owner = makeGrid(phenotype.width, phenotype.height);
  const layerLeaves = leaves
    .filter(leaf => (leaf.depth >= 0 ? 'front' : 'back') === layer)
    .sort((first, second) => first.depth - second.depth || first.id - second.id);
  for (const leaf of layerLeaves) paintLeaf(mask, owner, leaf, phenotype);
  const pixels = shadeLeaves(mask, owner, palette);
  return {
    mask,
    pixels,
    runs: compactRuns(pixels),
    motionGroups: compactMotionGroups(pixels, owner, motionGroups)
  };
}

export function rasterizeFoliage(graph, phenotype, seed) {
  const paletteVariant = selectFoliagePalette(phenotype, seed);
  const palette = paletteVariant.colors;
  const { shoots, leaves, coverageCells } = generateLeafBearingShoots(graph, phenotype, seed);
  const motionGroups = assignFoliageMotionGroups(graph, shoots, leaves);
  const back = rasterizeLayer(leaves, 'back', phenotype, palette, motionGroups);
  const front = rasterizeLayer(leaves, 'front', phenotype, palette, motionGroups);
  const mask = makeGrid(phenotype.width, phenotype.height, false);
  const pixels = makeGrid(phenotype.width, phenotype.height);
  for (let y = 0; y < phenotype.height; y += 1) {
    for (let x = 0; x < phenotype.width; x += 1) {
      mask[y][x] = back.mask[y][x] || front.mask[y][x];
      pixels[y][x] = front.pixels[y][x] || back.pixels[y][x];
    }
  }
  return {
    width: phenotype.width,
    height: phenotype.height,
    mask,
    pixels,
    runs: compactRuns(pixels),
    backRuns: back.runs,
    frontRuns: front.runs,
    backMotionGroups: back.motionGroups,
    frontMotionGroups: front.motionGroups,
    shoots,
    leaves,
    coverageCells,
    paletteId: paletteVariant.id,
    palette
  };
}

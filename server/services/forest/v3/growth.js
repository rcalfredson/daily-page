import { createRandom } from './random.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function dot(first, second) {
  return (first.x * second.x) + (first.y * second.y) + (first.z * second.z);
}

function angleBetween(first, second) {
  return Math.acos(clamp(dot(normalize(first), normalize(second)), -1, 1));
}

function constrainToward(from, target, maximumAngle) {
  const start = normalize(from);
  const end = normalize(target);
  const angle = angleBetween(start, end);
  if (angle <= maximumAngle) return end;
  const ratio = maximumAngle / Math.max(angle, 1e-9);
  const sine = Math.sin(angle);
  if (Math.abs(sine) < 1e-6) return normalize({
    x: start.x + ((end.x - start.x) * ratio),
    y: start.y + ((end.y - start.y) * ratio),
    z: start.z + ((end.z - start.z) * ratio)
  });
  const startWeight = Math.sin((1 - ratio) * angle) / sine;
  const endWeight = Math.sin(ratio * angle) / sine;
  return normalize({
    x: (start.x * startWeight) + (end.x * endWeight),
    y: (start.y * startWeight) + (end.y * endWeight),
    z: (start.z * startWeight) + (end.z * endWeight)
  });
}

function projectPosition(position, phenotype) {
  const cosine = Math.cos(phenotype.cameraYaw);
  const sine = Math.sin(phenotype.cameraYaw);
  const cameraX = (position.x * cosine) + (position.z * sine);
  const cameraZ = (-position.x * sine) + (position.z * cosine);
  const perspective = 1 + ((cameraZ / phenotype.crown.radiusZ) * phenotype.perspectiveStrength);
  return {
    x: phenotype.crown.centerX + (cameraX * perspective),
    y: phenotype.crown.centerY + ((position.y - phenotype.crown.centerY) * perspective),
    depth: cameraZ
  };
}

function insideCrown(position, phenotype, overscan = 1) {
  const dx = position.x / (phenotype.crown.radiusX * overscan);
  const dy = (position.y - phenotype.crown.centerY) / (phenotype.crown.radiusY * overscan);
  const dz = position.z / (phenotype.crown.radiusZ * overscan);
  return (dx * dx) + (dy * dy) + (dz * dz) <= 1;
}

export function generateAttractionPoints(seed, phenotype) {
  const random = createRandom(seed ^ 0xA77AC710);
  const points = [];
  let attempts = 0;
  const maximumAttempts = phenotype.attractionPointCount * 60;
  while (points.length < phenotype.attractionPointCount && attempts < maximumAttempts) {
    attempts += 1;
    const position = {
      x: (random() * 2 - 1) * phenotype.crown.radiusX,
      y: phenotype.crown.centerY + ((random() * 2 - 1) * phenotype.crown.radiusY),
      z: (random() * 2 - 1) * phenotype.crown.radiusZ
    };
    const normalizedHeight = (phenotype.crown.centerY + phenotype.crown.radiusY - position.y)
      / (phenotype.crown.radiusY * 2);
    if (insideCrown(position, phenotype)
      && random() >= phenotype.attractionGap * (0.45 + normalizedHeight)) {
      const projected = projectPosition(position, phenotype);
      points.push({
        id: points.length,
        worldX: position.x,
        worldY: position.y,
        worldZ: position.z,
        x: projected.x,
        y: projected.y,
        depth: projected.depth
      });
    }
  }
  return points;
}

function constrainDirection(node, desired, phenotype) {
  let constrained = constrainToward(node.direction, desired, phenotype.maximumTurnAngle);
  constrained = constrainToward(
    node.axisDirection,
    constrained,
    phenotype.maximumAxisDeviation
  );
  if (node.generation > 0) {
    const transitionStart = phenotype.lowerBranchFloorY
      - phenotype.lowerBranchTransitionHeight;
    const transition = clamp(
      (node.worldY - transitionStart) / phenotype.lowerBranchTransitionHeight,
      0,
      1
    );
    const maximumDroop = 1 + ((phenotype.lowerBranchMaximumDroop - 1) * transition);
    if (constrained.y > maximumDroop) {
      const horizontalLength = Math.hypot(constrained.x, constrained.z) || 1;
      const targetHorizontal = Math.sqrt(1 - (maximumDroop ** 2));
      constrained = {
        x: (constrained.x / horizontalLength) * targetHorizontal,
        y: maximumDroop,
        z: (constrained.z / horizontalLength) * targetHorizontal
      };
    }
  }
  return constrained;
}

function appendNode(nodes, parent, direction, phenotype, properties = {}) {
  const position = {
    x: parent.worldX + (direction.x * phenotype.internodeLength),
    y: parent.worldY + (direction.y * phenotype.internodeLength),
    z: parent.worldZ + (direction.z * phenotype.internodeLength)
  };
  const projected = projectPosition(position, phenotype);
  const node = {
    id: nodes.length,
    worldX: position.x,
    worldY: position.y,
    worldZ: position.z,
    x: projected.x,
    y: projected.y,
    depth: projected.depth,
    parentId: parent.id,
    generation: properties.generation ?? parent.generation,
    vigor: properties.vigor ?? parent.vigor,
    step: properties.step ?? parent.step,
    direction,
    axisDirection: properties.axisDirection || parent.axisDirection
  };
  nodes.push(node);
  return node;
}

function appendSegment(segments, parent, child) {
  segments.push({
    fromId: parent.id,
    toId: child.id,
    generation: child.generation,
    depth: (parent.depth + child.depth) / 2,
    radius: 0
  });
}

function buildScaffold(nodes, segments, phenotype, random) {
  let leader = nodes[0];
  const trunkNodes = [];
  while (leader.worldY - phenotype.internodeLength > phenotype.trunkTopY) {
    const direction = normalize({
      x: leader.direction.x * 0.8 + ((random() - 0.5) * 0.025),
      y: -1,
      z: leader.direction.z * 0.8 + ((random() - 0.5) * 0.025)
    });
    const child = appendNode(nodes, leader, direction, phenotype, {
      generation: 0,
      step: leader.step + 1,
      axisDirection: { x: 0, y: -1, z: 0 }
    });
    appendSegment(segments, leader, child);
    leader = child;
    if (leader.worldY <= phenotype.branchStartY) trunkNodes.push(leader);
  }

  const primaryTips = [];
  const usableTrunkNodes = trunkNodes.slice(1, -2);
  const spacing = usableTrunkNodes.length / phenotype.primaryBranchCount;
  const azimuthOffset = random() * Math.PI * 2;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < phenotype.primaryBranchCount; index += 1) {
    const parent = usableTrunkNodes[Math.min(
      usableTrunkNodes.length - 1,
      Math.floor((index + 0.45) * spacing)
    )];
    if (!parent) continue;
    const heightProgress = index / Math.max(1, phenotype.primaryBranchCount - 1);
    const tilt = phenotype.primaryBranchAngle - (heightProgress * 0.22)
      + ((random() - 0.5) * 0.12);
    const azimuth = azimuthOffset + (index * goldenAngle) + ((random() - 0.5) * 0.18);
    const horizontal = Math.sin(tilt);
    const direction = normalize({
      x: Math.cos(azimuth) * horizontal,
      y: -Math.cos(tilt),
      z: Math.sin(azimuth) * horizontal
    });
    const child = appendNode(nodes, parent, direction, phenotype, {
      generation: 1,
      vigor: 0.8 - (heightProgress * 0.08),
      step: 0,
      axisDirection: direction
    });
    appendSegment(segments, parent, child);
    primaryTips.push(child);
  }
  return [leader, ...primaryTips];
}

function directionToPoint(node, point) {
  return normalize({
    x: point.worldX - node.worldX,
    y: point.worldY - node.worldY,
    z: point.worldZ - node.worldZ
  });
}

function blendedDirection(node, points, phenotype) {
  let x = node.direction.x * phenotype.parentDirectionWeight;
  let y = node.direction.y * phenotype.parentDirectionWeight;
  let z = node.direction.z * phenotype.parentDirectionWeight;
  for (const point of points) {
    const toward = directionToPoint(node, point);
    x += toward.x;
    y += toward.y;
    z += toward.z;
  }
  x /= Math.max(1, points.length);
  y /= Math.max(1, points.length);
  z /= Math.max(1, points.length);
  y -= phenotype.apicalDominance + phenotype.phototropism;
  return constrainDirection(node, normalize({ x, y, z }), phenotype);
}

function splitAssignments(node, assigned, phenotype, random) {
  if (assigned.length < phenotype.minimumForkPoints || random() >= phenotype.forkProbability) {
    return [assigned];
  }
  const reference = Math.abs(node.direction.y) > 0.88
    ? { x: 1, y: 0, z: 0 } : { x: 0, y: -1, z: 0 };
  const normal = normalize({
    x: (node.direction.y * reference.z) - (node.direction.z * reference.y),
    y: (node.direction.z * reference.x) - (node.direction.x * reference.z),
    z: (node.direction.x * reference.y) - (node.direction.y * reference.x)
  });
  const negative = [];
  const positive = [];
  for (const point of assigned) {
    const side = ((point.worldX - node.worldX) * normal.x)
      + ((point.worldY - node.worldY) * normal.y)
      + ((point.worldZ - node.worldZ) * normal.z);
    (side < 0 ? negative : positive).push(point);
  }
  if (negative.length < 2 || positive.length < 2) return [assigned];
  return angleBetween(
    blendedDirection(node, negative, phenotype),
    blendedDirection(node, positive, phenotype)
  ) >= phenotype.forkSeparation ? [negative, positive] : [assigned];
}

function pointDistance(first, second) {
  return Math.hypot(
    first.worldX - second.worldX,
    first.worldY - second.worldY,
    first.worldZ - second.worldZ
  );
}

function directionIsClear(parent, direction, nodes, phenotype) {
  const candidate = {
    worldX: parent.worldX + (direction.x * phenotype.internodeLength),
    worldY: parent.worldY + (direction.y * phenotype.internodeLength),
    worldZ: parent.worldZ + (direction.z * phenotype.internodeLength)
  };
  if (candidate.worldY <= 0 || candidate.worldY >= phenotype.groundY) return false;
  if (parent.generation > 0 && !insideCrown({
    x: candidate.worldX,
    y: candidate.worldY,
    z: candidate.worldZ
  }, phenotype, phenotype.growthEnvelopeOverscan)) return false;
  for (const node of nodes) {
    if (node.id === parent.id || node.id === parent.parentId) continue;
    if (pointDistance(candidate, node) < 1.05) return false;
  }
  return true;
}

function calculateRadii(nodes, segments, phenotype) {
  const children = Array.from({ length: nodes.length }, () => []);
  for (const segment of segments) children[segment.fromId].push(segment.toId);
  const radii = Array(nodes.length).fill(phenotype.terminalRadius);
  for (let id = nodes.length - 1; id >= 0; id -= 1) {
    if (!children[id].length) continue;
    const area = children[id].reduce(
      (sum, childId) => sum + (radii[childId] ** phenotype.pipeExponent), 0
    );
    radii[id] = Math.max(
      phenotype.terminalRadius,
      ...children[id].map(childId => radii[childId]),
      area ** (1 / phenotype.pipeExponent)
    );
  }
  for (const node of nodes) node.radius = radii[node.id];
  for (const segment of segments) {
    segment.fromRadius = radii[segment.fromId];
    segment.toRadius = radii[segment.toId];
    segment.radius = segment.toRadius;
  }
}

export function growBranchGraph(seed, phenotype) {
  const random = createRandom(seed ^ 0xB4A9C135);
  const attractionPoints = generateAttractionPoints(seed, phenotype);
  let remainingPoints = attractionPoints.slice();
  const rootProjection = projectPosition({ x: 0, y: phenotype.groundY, z: 0 }, phenotype);
  const nodes = [{
    id: 0,
    worldX: 0,
    worldY: phenotype.groundY,
    worldZ: 0,
    x: rootProjection.x,
    y: rootProjection.y,
    depth: rootProjection.depth,
    parentId: null,
    generation: 0,
    vigor: 1,
    step: 0,
    direction: { x: 0, y: -1, z: 0 },
    axisDirection: { x: 0, y: -1, z: 0 }
  }];
  const segments = [];
  let terminals = buildScaffold(nodes, segments, phenotype, random);
  let iterations = 0;

  while (iterations < phenotype.maxIterations && remainingPoints.length && terminals.length
    && nodes.length < phenotype.maxNodes) {
    iterations += 1;
    const assignments = new Map(terminals.map(node => [node.id, []]));
    remainingPoints = remainingPoints.filter(point => {
      let nearest = null;
      let nearestDistance = Infinity;
      for (const terminal of terminals) {
        const distance = Math.hypot(
          point.worldX - terminal.worldX,
          point.worldY - terminal.worldY,
          point.worldZ - terminal.worldZ
        );
        if (distance < phenotype.killRadius) return false;
        const influence = phenotype.influenceRadius * (1 - (terminal.generation * 0.08));
        if (distance < nearestDistance && distance <= influence) {
          nearest = terminal;
          nearestDistance = distance;
        }
      }
      if (nearest) assignments.get(nearest.id).push(point);
      return true;
    });

    const nextTerminals = [];
    for (const terminal of terminals) {
      const assigned = assignments.get(terminal.id);
      if (!assigned.length || terminal.vigor < phenotype.minimumVigor) continue;
      let groups = splitAssignments(terminal, assigned, phenotype, random);
      if (terminal.generation >= phenotype.maxGeneration) groups = [assigned];
      const options = groups.map(points => ({
        direction: blendedDirection(terminal, points, phenotype), points
      })).sort((first, second) => (
        angleBetween(terminal.direction, first.direction)
        - angleBetween(terminal.direction, second.direction)
      ));
      for (let index = 0; index < options.length && nodes.length < phenotype.maxNodes; index += 1) {
        const { direction } = options[index];
        if (!directionIsClear(terminal, direction, nodes, phenotype)) continue;
        const lateral = index > 0;
        const child = appendNode(nodes, terminal, direction, phenotype, {
          generation: Math.min(
            phenotype.maxGeneration,
            terminal.generation + (lateral ? 1 : 0)
          ),
          vigor: terminal.vigor * phenotype.vigorDecay * (lateral ? 0.72 : 0.97),
          step: iterations,
          axisDirection: lateral ? direction : terminal.axisDirection
        });
        appendSegment(segments, terminal, child);
        nextTerminals.push(child);
      }
    }
    terminals = nextTerminals;
  }

  calculateRadii(nodes, segments, phenotype);
  const terminalNodeIds = new Set(nodes.map(node => node.id));
  for (const segment of segments) terminalNodeIds.delete(segment.fromId);
  const terminationReason = nodes.length >= phenotype.maxNodes
    ? 'node-limit'
    : iterations >= phenotype.maxIterations ? 'iteration-limit'
      : remainingPoints.length === 0 ? 'points-consumed' : 'growth-exhausted';
  return {
    nodes: nodes.map(node => ({
      id: node.id,
      x: node.x,
      y: node.y,
      depth: node.depth,
      worldX: node.worldX,
      worldY: node.worldY,
      worldZ: node.worldZ,
      parentId: node.parentId,
      generation: node.generation,
      vigor: node.vigor,
      step: node.step,
      radius: node.radius
    })),
    segments,
    terminalNodeIds: [...terminalNodeIds].sort((a, b) => a - b),
    attractionPoints,
    remainingAttractionPointIds: remainingPoints.map(point => point.id),
    stats: { iterations, terminationReason }
  };
}

function orientation(a, b, c) {
  return ((b.x - a.x) * (c.y - a.y)) - ((b.y - a.y) * (c.x - a.x));
}

function segmentsCross(a, b, c, d) {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return ((first > 0 && second < 0) || (first < 0 && second > 0))
    && ((third > 0 && fourth < 0) || (third < 0 && fourth > 0));
}

function angleBetween(first, second) {
  const firstLength = Math.hypot(first.x, first.y, first.z || 0) || 1;
  const secondLength = Math.hypot(second.x, second.y, second.z || 0) || 1;
  const cosine = ((first.x * second.x) + (first.y * second.y)
    + ((first.z || 0) * (second.z || 0)))
    / (firstLength * secondLength);
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}

export function analyzeBranchGraph(graph, phenotype) {
  const sameOrderChildren = Array.from({ length: graph.nodes.length }, () => []);
  for (const segment of graph.segments) {
    if (graph.nodes[segment.fromId].generation === graph.nodes[segment.toId].generation) {
      sameOrderChildren[segment.fromId].push(segment.toId);
    }
  }

  let crossingCount = 0;
  for (let firstIndex = 0; firstIndex < graph.segments.length; firstIndex += 1) {
    const first = graph.segments[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < graph.segments.length; secondIndex += 1) {
      const second = graph.segments[secondIndex];
      const sharesNode = first.fromId === second.fromId || first.fromId === second.toId
        || first.toId === second.fromId || first.toId === second.toId;
      if (sharesNode) continue;
      if (segmentsCross(
        graph.nodes[first.fromId],
        graph.nodes[first.toId],
        graph.nodes[second.fromId],
        graph.nodes[second.toId]
      )) crossingCount += 1;
    }
  }

  let sharpTurnCount = 0;
  let maximumTurn = 0;
  for (const node of graph.nodes) {
    if (node.parentId === null) continue;
    const parent = graph.nodes[node.parentId];
    if (parent.parentId === null) continue;
    if (node.generation !== parent.generation) continue;
    if (node.generation === 0 && sameOrderChildren[parent.id].length > 1) continue;
    const grandparent = graph.nodes[parent.parentId];
    const turn = angleBetween(
      {
        x: parent.worldX - grandparent.worldX,
        y: parent.worldY - grandparent.worldY,
        z: parent.worldZ - grandparent.worldZ
      },
      {
        x: node.worldX - parent.worldX,
        y: node.worldY - parent.worldY,
        z: node.worldZ - parent.worldZ
      }
    );
    maximumTurn = Math.max(maximumTurn, turn);
    if (turn > phenotype.maximumTurnAngle + 0.1) sharpTurnCount += 1;
  }

  let crowdedTerminalPairCount = 0;
  for (let firstIndex = 0; firstIndex < graph.terminalNodeIds.length; firstIndex += 1) {
    const first = graph.nodes[graph.terminalNodeIds[firstIndex]];
    for (let secondIndex = firstIndex + 1;
      secondIndex < graph.terminalNodeIds.length; secondIndex += 1) {
      const second = graph.nodes[graph.terminalNodeIds[secondIndex]];
      if (Math.hypot(first.x - second.x, first.y - second.y) < phenotype.internodeLength) {
        crowdedTerminalPairCount += 1;
      }
    }
  }

  let maximumTortuosity = 1;
  const branchPaths = Array(graph.nodes.length);
  for (const node of graph.nodes) {
    if (node.parentId === null) {
      branchPaths[node.id] = { origin: node, length: 0 };
      continue;
    }
    const parent = graph.nodes[node.parentId];
    const segmentLength = Math.hypot(
      node.worldX - parent.worldX,
      node.worldY - parent.worldY,
      node.worldZ - parent.worldZ
    );
    const path = node.generation === parent.generation
      ? {
        origin: branchPaths[parent.id].origin,
        length: branchPaths[parent.id].length + segmentLength
      }
      : { origin: parent, length: segmentLength };
    branchPaths[node.id] = path;
    const directDistance = Math.hypot(
      node.worldX - path.origin.worldX,
      node.worldY - path.origin.worldY,
      node.worldZ - path.origin.worldZ
    );
    if (directDistance > 0) maximumTortuosity = Math.max(
      maximumTortuosity,
      path.length / directDistance
    );
  }

  return {
    crossingCount,
    sharpTurnCount,
    crowdedTerminalPairCount,
    maximumTurn,
    maximumTortuosity
  };
}

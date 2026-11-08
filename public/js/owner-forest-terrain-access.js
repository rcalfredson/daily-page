import { terrainPointSegmentDistance } from './owner-forest-terrain.js';
import { sampleOwnerTerrain as sampleTerrainProof, ownerTerrainMovementAllowed as terrainProofMovementAllowed }
  from './owner-forest-terrain-authority.js';

// Include the actual verification grid, including a rounded vertex just over a loading edge.
export function ownerTerrainAccessBounds(p) {
  return { minX: Math.floor((Math.min(p.x, p.accessEnd.x) - 96) / 8) * 8,
    maxX: Math.ceil((Math.max(p.x, p.accessEnd.x) + 96) / 8) * 8,
    minY: Math.floor((Math.min(p.y, p.accessEnd.y) - 96) / 8) * 8,
    maxY: Math.ceil((Math.max(p.y, p.accessEnd.y) + 96) / 8) * 8 };
}

// Activation-only bounded clearance validation, not a runtime navigation mesh.
export function validateOwnerTerrainAccess(scene, protection) {
  const step = 8;
  const halfWidth = 96;
  const end = protection.accessEnd;
  const minX = Math.floor((Math.min(protection.x, end.x) - halfWidth) / step);
  const maxX = Math.ceil((Math.max(protection.x, end.x) + halfWidth) / step);
  const minY = Math.floor((Math.min(protection.y, end.y) - halfWidth) / step);
  const maxY = Math.ceil((Math.max(protection.y, end.y) + halfWidth) / step);
  const maximumPositions = scene.generationVersion === 4 ? 32_000 : 20_000;
  if ((maxX - minX + 1) * (maxY - minY + 1) > maximumPositions) return false;
  const trees = scene.protections.filter(p => p.id.startsWith('tree:'))
    .map(p => ({ ...p, solidRadius: p.radius - 36 }));
  if (trees.some(p => p.solidRadius < 1 || p.solidRadius > 13)) return false;
  const solidRadius = protection.id.startsWith('tree:') ? protection.radius - 36 : 0;
  const clearCache = new Map();
  const clear = p => {
    const key = `${p.x}:${p.y}`;
    if (!clearCache.has(key)) clearCache.set(key, sampleTerrainProof(scene, p, 11).walkable
      && trees.every(tree => Math.hypot(p.x - tree.x, p.y - tree.y) >= tree.solidRadius + 11));
    return clearCache.get(key);
  };
  if (protection.id === 'entrance' && !clear(protection)) return false;
  const queue = [];
  const visited = new Set();
  const startRadius = solidRadius + 16;
  for (let i = 0; i < 16; i += 1) {
    const angle = i * Math.PI / 8;
    const p = { x: Math.round((protection.x + Math.cos(angle) * startRadius) / step),
      y: Math.round((protection.y + Math.sin(angle) * startRadius) / step) };
    const key = `${p.x}:${p.y}`;
    if (!visited.has(key) && clear({ x: p.x * step, y: p.y * step })) {
      visited.add(key); queue.push(p);
    }
  }
  for (let head = 0; head < queue.length && head < maximumPositions; head += 1) {
    const current = queue[head];
    const from = { x: current.x * step, y: current.y * step };
    if (Math.hypot(from.x - end.x, from.y - end.y) <= 12) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = `${next.x}:${next.y}`;
      if (next.x < minX || next.x > maxX || next.y < minY || next.y > maxY || visited.has(key)) continue;
      visited.add(key);
      const to = { x: next.x * step, y: next.y * step };
      if (clear(to) && trees.every(tree => terrainPointSegmentDistance(tree, from, to)
        >= tree.solidRadius + 11) && terrainProofMovementAllowed(scene, from, to, 11)) queue.push(next);
    }
  }
  return false;
}

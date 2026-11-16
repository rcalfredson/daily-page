// Non-publishing, bounded spatial investigation. Reads only supplied fixture geometry.
import { queryOwnerTerrain, sampleOwnerTerrain } from '../../public/js/owner-forest-terrain-authority.js';

export { HOME_STUDY_LIMITS, planHomeCartSite } from '../../server/services/forestHomeSitePlanner.js';
export const STUDY_SEEDS = ['abcdefghijklmnopqrstuvwxyzABCDEF', 'homeCartSecondLandscapeSeed123456',
  'homeCartThirdLandscapeSeed1234567'];

function random(seed) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; };
}

export function createHomeStudyFixture({ generation = 4, seed = STUDY_SEEDS[0], occupancy = 'mixed' } = {}) {
  if (![0, 3, 4].includes(generation) || !['empty', 'mixed', 'dense', 'blocked'].includes(occupancy)) {
    throw new Error('Unsupported home study fixture.');
  }
  const rng = random(seed), obstacles = [];
  if (occupancy !== 'empty') {
    for (let i = 0; i < (occupancy === 'dense' ? 240 : 70); i++) {
      const x = Math.round((rng() - 0.5) * 6400), y = Math.round((rng() - 0.5) * 6400);
      if (Math.hypot(x, y) < 160) continue;
      const kind = i % 11 === 0 ? 'plant' : i % 13 === 0 ? 'marker' : 'tree';
      obstacles.push({ id: `study-${kind}-${i}`, kind, x, y,
        radius: kind === 'tree' ? 35 : 17, collisionRadius: kind === 'tree' ? 20 : 9 });
    }
  }
  // Explicit representative possessions near the original entrance, not removed for a home.
  obstacles.push({ id: 'study-plant-fixed', kind: 'plant', x: 40, y: 20, radius: 26, collisionRadius: 9 },
    { id: 'study-marker-fixed', kind: 'marker', x: -90, y: 65, radius: 26, collisionRadius: 9 });
  const protections = [{ id: 'entrance', x: 0, y: 0, radius: 80 },
    ...obstacles.map(o => ({ id: o.id, x: o.x, y: o.y, radius: Math.max(24, o.radius) }))];
  const scenes = new Map();
  function terrainAt(p) {
    if (!generation) return { walkable: true, placeable: true, surface: 'land' };
    const x = Math.floor(p.worldX / 1920), y = Math.floor(p.worldY / 1920), key = `${x}:${y}`;
    if (!scenes.has(key)) scenes.set(key, queryOwnerTerrain({ seed, generationVersion: generation,
      records: protections, bounds: { minX: x * 1920, maxX: x * 1920, minY: y * 1920, maxY: y * 1920 } }));
    return sampleOwnerTerrain(scenes.get(key), { x: p.worldX, y: p.worldY }, p.radius);
  }
  return { generation, seed, occupancy, obstacles, protections, terrainAt,
    blocked: occupancy === 'blocked' };
}

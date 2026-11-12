// Non-publishing, bounded spatial investigation. Reads only supplied fixture geometry.
import { performance } from 'node:perf_hooks';
import { queryOwnerTerrain, sampleOwnerTerrain } from '../../public/js/owner-forest-terrain-authority.js';
import { terrainPointSegmentDistance } from '../../public/js/owner-forest-terrain.js';

export const HOME_STUDY_LIMITS = Object.freeze({
  extent: 3600, homeCandidates: 32, terrainSamples: 100000,
  corridorHalfWidth: 84, routeStep: 24, tileStep: 24, tileRadius: 18
});
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

export function planHomeCartSite(fixture, overrides = {}) {
  const limits = { ...HOME_STUDY_LIMITS, ...overrides };
  const metrics = { homeAttempts: 0, routeAttempts: 0, terrainSamples: 0, obstacleRejects: 0,
    groundRejects: 0, elapsedMs: 0 };
  const started = performance.now(), cache = new Map();
  const finish = result => ({ ...result, metrics: { ...metrics, elapsedMs: Math.round(performance.now() - started) } });
  const extent = limits.extent;
  function disc(p, placeable) {
    if (Math.abs(p.worldX) + p.radius > extent || Math.abs(p.worldY) + p.radius > extent) return false;
    if (fixture.blocked) return false;
    const key = `${p.worldX}:${p.worldY}:${p.radius}`;
    if (!cache.has(key)) {
      if (metrics.terrainSamples >= limits.terrainSamples) throw new Error('study-budget');
      metrics.terrainSamples++;
      cache.set(key, fixture.terrainAt(p));
    }
    return Boolean(cache.get(key)[placeable ? 'placeable' : 'walkable']);
  }
  function rectangle(rect, placeable = true) {
    if (fixture.obstacles.some(o => Math.hypot(Math.max(rect.minX - o.x, 0, o.x - rect.maxX),
      Math.max(rect.minY - o.y, 0, o.y - rect.maxY)) <= o.radius)) {
      metrics.obstacleRejects++; return false;
    }
    const nx = Math.ceil((rect.maxX - rect.minX) / limits.tileStep);
    const ny = Math.ceil((rect.maxY - rect.minY) / limits.tileStep);
    for (let x = 0; x <= nx; x++) for (let y = 0; y <= ny; y++) {
      if (!disc({ worldX: Math.round(rect.minX + x * (rect.maxX - rect.minX) / nx),
        worldY: Math.round(rect.minY + y * (rect.maxY - rect.minY) / ny), radius: limits.tileRadius }, placeable)) {
        metrics.groundRejects++; return false;
      }
    }
    return true;
  }
  function corridor(a, b, radius) {
    if (fixture.obstacles.some(o => terrainPointSegmentDistance(o, a, b) <= o.radius + radius)) return false;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = length ? -(b.y - a.y) / length : 0, ny = length ? (b.x - a.x) / length : 1;
    const steps = Math.max(1, Math.ceil(length / limits.routeStep));
    const across = Math.max(1, Math.ceil(2 * radius / limits.tileStep));
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= across; j++) {
      const offset = -radius + 2 * radius * j / across;
      if (!disc({ worldX: Math.round(a.x + (b.x - a.x) * i / steps + nx * offset),
        worldY: Math.round(a.y + (b.y - a.y) * i / steps + ny * offset),
        radius: limits.tileRadius }, false)) return false;
    }
    return true;
  }
  const crossesHouse = (path, house, radius) => path.slice(1).some((p, i) =>
    Math.min(p.x, path[i].x) - radius < house.maxX && Math.max(p.x, path[i].x) + radius > house.minX
    && Math.min(p.y, path[i].y) - radius < house.maxY && Math.max(p.y, path[i].y) + radius > house.minY);
  const candidates = [];
  for (const r of [400, 800, 1200, 1800]) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1],
    [1, 1], [-1, 1], [-1, -1], [1, -1]]) candidates.push({ x: dx * r, y: dy * r });
  try {
    for (const home of candidates.slice(0, limits.homeCandidates)) {
      metrics.homeAttempts++;
      const envelope = { minX: home.x - 160, maxX: home.x + 160, minY: home.y - 180, maxY: home.y + 180 };
      if (!rectangle(envelope)) continue;
      const parking = { x: home.x, y: home.y + 90 };
      const house = { minX: home.x - 90, maxX: home.x + 90, minY: home.y - 135, maxY: home.y - 35 };
      // Walking access starts beyond the fixed entrance garden; preserve its occupied ground.
      const entrance = { x: 0, y: -70 };
      const approaches = [[entrance, { x: entrance.x, y: parking.y }, parking],
        ...[-200, 200].map(offset => [entrance, { x: home.x + offset, y: entrance.y },
          { x: home.x + offset, y: parking.y }, parking])];
      const approach = approaches.find(path => !crossesHouse(path, house, 12)
        && corridor({ x: 0, y: 0 }, entrance, 12)
        && path.slice(1).every((p, i) => corridor(path[i], p, 12)));
      if (!approach) continue;
      for (const [dx, dy] of [[1200, 900], [-1200, 900], [1200, -900], [-1200, -900],
        [1500, 0], [0, 1500], [-1500, 0], [0, -1500]]) {
        const destination = { x: parking.x + dx, y: parking.y + dy };
        if (!rectangle({ minX: destination.x - 105, maxX: destination.x + 105,
          minY: destination.y - 105, maxY: destination.y + 105 })) continue;
        for (const bend of [{ x: destination.x, y: parking.y }, { x: parking.x, y: destination.y }]) {
          metrics.routeAttempts++;
          const route = [parking, bend, destination].filter((p, i, a) => !i || p.x !== a[i - 1].x || p.y !== a[i - 1].y);
          // Keep the travel corridor out of the house itself, including the northern exit.
          if (crossesHouse(route, house, limits.corridorHalfWidth)) continue;
          const turnClear = route.slice(1, -1).every(p => rectangle({ minX: p.x - 90, maxX: p.x + 90,
            minY: p.y - 90, maxY: p.y + 90 }, false));
          if (turnClear && route.slice(1).every((p, i) => corridor(route[i], p, limits.corridorHalfWidth))) {
            const heading = Math.atan2(route[1].y - parking.y, route[1].x - parking.x);
            const spawn = { x: Math.round(parking.x - Math.cos(heading) * 70),
              y: Math.round(parking.y - Math.sin(heading) * 70) };
            return finish({ status: 'ready', home, envelope, house, parking, spawn, entrance, approach, route, destination });
          }
        }
      }
    }
    return finish({ status: 'unavailable', reason: 'no-connected-site-within-search' });
  } catch (error) {
    if (error.message !== 'study-budget') throw error;
    return finish({ status: 'unavailable', reason: 'sample-budget-exhausted' });
  }
}

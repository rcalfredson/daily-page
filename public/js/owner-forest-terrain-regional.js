import { buildRiverLakeLayout, riverLakeHash as hash } from './forest-river-lake.js';
import { buildTerrainProofProtections, terrainPointSegmentDistance, terrainProofWaterDistance }
  from './owner-forest-terrain.js';

export const REGIONAL_TERRAIN_CONFIG = Object.freeze({ districtSize: 1920, regionSize: 15360,
  halfRegion: 7680, maximumProtections: 512, maximumQueryDistricts: 25, attempts: 12 });
const C = REGIONAL_TERRAIN_CONFIG;
const numberPoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  && Math.abs(p.x) <= 999_990_000 && Math.abs(p.y) <= 999_990_000;
export const regionalAddress = n => Math.floor((n + C.halfRegion) / C.regionSize);
export const regionalId = (column, row) => `river-lake-4:${column}:${row}`;

export function buildRegionalProtections(records) {
  return buildTerrainProofProtections(records).map(p => {
    const cx = regionalAddress(p.x) * C.regionSize, cy = regionalAddress(p.y) * C.regionSize;
    const ends = [{ x: cx - C.halfRegion, y: p.y }, { x: cx + C.halfRegion, y: p.y },
      { x: p.x, y: cy - C.halfRegion }, { x: p.x, y: cy + C.halfRegion }];
    ends.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    return { ...p, accessEnd: ends[0] };
  });
}
export function regionalQueryPlan(bounds) {
  if (!numberPoint({ x: bounds?.minX, y: bounds?.minY })
    || !numberPoint({ x: bounds?.maxX, y: bounds?.maxY })
    || bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) throw new Error('Invalid regional bounds.');
  const minX = Math.floor(bounds.minX / 1920), maxX = Math.floor(bounds.maxX / 1920);
  const minY = Math.floor(bounds.minY / 1920), maxY = Math.floor(bounds.maxY / 1920);
  if ((maxX - minX + 1) * (maxY - minY + 1) > C.maximumQueryDistricts) throw new Error('Regional query bound exceeded.');
  const districts = [], regions = new Map();
  for (let row = minY; row <= maxY; row++) for (let column = minX; column <= maxX; column++) {
    const rx = Math.floor((column + 4) / 8), ry = Math.floor((row + 4) / 8);
    const id = regionalId(rx, ry);
    districts.push({ id: `terrain-4:${column}:${row}`, column, row, featureId: id, boulders: [] });
    regions.set(id, { column: rx, row: ry });
  }
  return { districts, regions: [...regions.values()] };
}
function segmentDistance(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const opposite = (x, y) => x <= 0 && y >= 0 || x >= 0 && y <= 0;
  if (Math.max(a.x, b.x) >= Math.min(c.x, d.x) && Math.max(c.x, d.x) >= Math.min(a.x, b.x)
    && Math.max(a.y, b.y) >= Math.min(c.y, d.y) && Math.max(c.y, d.y) >= Math.min(a.y, b.y)
    && opposite(cross(a, b, c), cross(a, b, d)) && opposite(cross(c, d, a), cross(c, d, b))) return 0;
  return Math.min(terrainPointSegmentDistance(a, c, d), terrainPointSegmentDistance(b, c, d),
    terrainPointSegmentDistance(c, a, b), terrainPointSegmentDistance(d, a, b));
}
function bridgeLocal(p, b) {
  const dx = p.x - b.x, dy = p.y - b.y;
  return { along: dx * b.ux + dy * b.uy, across: -dx * b.uy + dy * b.ux };
}
function bridgeNear(p, b, radius = 0) {
  const local = bridgeLocal(p, b);
  return Math.abs(local.along) <= b.approachHalfLength + radius && Math.abs(local.across) <= b.halfWidth + 20 + radius;
}
function obstructsProtection(stream, protections) {
  return protections.some(p => terrainProofWaterDistance(p, stream) <= p.radius + 40);
}
function escapeRoutes(stream, protections, cx, cy) {
  const access = [];
  for (const p of protections.filter(p => regionalAddress(p.x) * C.regionSize === cx
    && regionalAddress(p.y) * C.regionSize === cy)) {
    const ends = [{ x: cx - C.halfRegion, y: p.y }, { x: cx + C.halfRegion, y: p.y },
      { x: p.x, y: cy - C.halfRegion }, { x: p.x, y: cy + C.halfRegion }];
    ends.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const end = ends.find(end => Math.hypot(end.x - p.x, end.y - p.y) <= 9600
      && !stream.waterPolygons.some(poly => poly.some((a, i) =>
        segmentDistance(p, end, a, poly[(i + 1) % poly.length]) <= 64)));
    if (!end) return null;
    access.push({ id: p.id, end });
  }
  return access;
}
function feature(seed, column, row, protections) {
  const id = regionalId(column, row), random = key => hash(`${seed}:${id}:${key}`);
  const cx = column * C.regionSize, cy = row * C.regionSize;
  const families = ['sweeping-river', 'long-lake', 'broad-basin'];
  const family = families[Math.floor(random('family') * families.length)];
  const options = { id, riverSpan: 9600 + random('length') * 1400,
    width: 0.85 + random('width') * 0.35, bends: 0.7 + random('bends') * 0.7,
    joinIndex: 56 + Math.floor(random('junction') * 16), tributary: 0.8 + random('tributary') * 0.4,
    lakeX: (family === 'long-lake' ? 1200 : family === 'broad-basin' ? 1750 : 1500) * (0.92 + random('lake-x') * 0.16),
    lakeY: (family === 'long-lake' ? 1350 : family === 'broad-basin' ? 950 : 1100) * (0.92 + random('lake-y') * 0.16) };
  for (let attempt = 0; attempt < C.attempts; attempt++) {
    const layout = buildRiverLakeLayout(String(Math.floor(random('shape') * 4294967296)), options);
    const angle = Math.floor(random(`${attempt}:orientation`) * 16) * Math.PI / 8;
    const mirror = random(`${attempt}:mirror`) < 0.5 ? -1 : 1;
    const shiftX = (random(`${attempt}:x`) - 0.5) * 1600, shiftY = (random(`${attempt}:y`) - 0.5) * 700;
    const transform = p => ({ x: Math.round(cx + (p.x * mirror + shiftX) * Math.cos(angle)
      - (p.y + 3500 + shiftY) * Math.sin(angle)),
    y: Math.round(cy + (p.x * mirror + shiftX) * Math.sin(angle) + (p.y + 3500 + shiftY) * Math.cos(angle)) });
    const channels = layout.channels.map((channel, i) => ({ ...channel, id: `${id}:channel:${i}`,
      points: channel.points.map(transform), outline: channel.outline.map(transform) }));
    const source = { kind: 'spring', ...transform(layout.source), outline: layout.source.outline.map(transform) };
    const outlet = { kind: 'lake', ...transform({ x: 260, y: options.lakeY + 140 }),
      outline: layout.lake.map(transform) };
    const stream = { id: `${id}:water`, channels, points: channels[0].points, source, outlet,
      waterPolygons: [...channels.map(c => c.outline), outlet.outline, source.outline], bankMargin: 24 };
    const vertices = stream.waterPolygons.flat();
    if (vertices.some(p => Math.abs(p.x - cx) > C.halfRegion - 100 || Math.abs(p.y - cy) > C.halfRegion - 100)
      || obstructsProtection(stream, protections)) continue;
    // Choose clear approaches AFTER proposing the landscape. We reject a conflicting candidate;
    // we never carve preselected straight corridors through its shore or reserve an empty region.
    const access = escapeRoutes(stream, protections, cx, cy);
    if (!access) continue;
    const bridgeCandidates = [[0, [40, 32, 48]], [0, [100, 92, 108]], [1, [18, 14, 22, 26]]];
    const bridges = bridgeCandidates.map(([channelIndex, indices], ordinal) => indices.map(i => {
      const channel = channels[channelIndex], p = channel.points[i];
      const a = channel.points[i - 1], b = channel.points[i + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
      const halfLength = Math.ceil(channel.radii[i] + 42);
      return { id: `${id}:bridge:${ordinal}`, x: p.x, y: p.y, ux: (b.y - a.y) / length,
        uy: -(b.x - a.x) / length, halfLength, halfWidth: 24, approachHalfLength: halfLength + 30 };
    }).find(b => {
      const a = { x: b.x - b.ux * b.approachHalfLength, y: b.y - b.uy * b.approachHalfLength };
      const end = { x: b.x + b.ux * b.approachHalfLength, y: b.y + b.uy * b.approachHalfLength };
      if (protections.some(p => terrainPointSegmentDistance(p, a, end) <= p.radius + 44)) return false;
      for (let step = -b.approachHalfLength; step <= b.approachHalfLength; step += 2) {
        if (Math.abs(step) > b.halfLength && terrainProofWaterDistance({ x: b.x + b.ux * step,
          y: b.y + b.uy * step }, stream) <= 12) return false;
      }
      return true;
    }));
    if (bridges.some(b => !b)) continue;
    return { id, column, row, family, stream, bridges, access, bounds: {
      minX: Math.min(...vertices.map(p => p.x)) - 24, maxX: Math.max(...vertices.map(p => p.x)) + 24,
      minY: Math.min(...vertices.map(p => p.y)) - 24, maxY: Math.max(...vertices.map(p => p.y)) + 24 } };
  }
  return { id, column, row, family, stream: null, bridges: [], bounds: null, access: [] };
}
export function queryRegionalTerrain({ seed, bounds, records = [] }) {
  if (typeof seed !== 'string' || !seed.length || seed.length > 80) throw new Error('Invalid regional seed.');
  const { districts, regions } = regionalQueryPlan(bounds);
  let protections = buildRegionalProtections(records);
  const entries = regions.map(r => feature(seed, r.column, r.row, protections));
  const access = new Map(entries.flatMap(e => e.access).map(a => [a.id, a.end]));
  protections = protections.map(p => ({ ...p, accessEnd: access.get(p.id) || p.accessEnd }));
  const features = entries.map(entry => {
    const result = { ...entry }; delete result.access; return result;
  });
  for (const area of districts) {
    const f = features.find(f => f.id === area.featureId);
    const random = key => hash(`${seed}:${area.id}:${key}`);
    for (let i = 0; i < 16; i++) {
      if (random(`${i}:accept`) > 0.45) continue;
      const rock = { id: `${area.id}:rock:${i}`, x: Math.round(area.column * 1920 + 120 + random(`${i}:x`) * 1680),
        y: Math.round(area.row * 1920 + 120 + random(`${i}:y`) * 1680), radius: 18 + Math.floor(random(`${i}:r`) * 13) };
      if (Math.abs(rock.x - f.column * C.regionSize) > C.halfRegion - 90
        || Math.abs(rock.y - f.row * C.regionSize) > C.halfRegion - 90
        || protections.some(p => terrainPointSegmentDistance(rock, p, p.accessEnd) <= rock.radius + 40
          || Math.hypot(rock.x - p.x, rock.y - p.y) <= rock.radius + p.radius + 16)
        || f.stream && terrainProofWaterDistance(rock, f.stream) <= rock.radius + 48
        || f.bridges.some(b => bridgeNear(rock, b, rock.radius + 16))) continue;
      area.boulders.push(rock);
    }
  }
  return { generationVersion: 4, districts, features, protections };
}
export function sampleRegionalTerrain(scene, p, radius = 12) {
  if (!numberPoint(p) || !Number.isFinite(radius) || radius < 0 || radius > 24) throw new Error('Invalid regional sample.');
  const area = scene.districts.find(d => d.column === Math.floor(p.x / 1920) && d.row === Math.floor(p.y / 1920));
  const feature = area && scene.features.find(f => f.id === area.featureId);
  if (!feature) throw new Error('Regional terrain is not loaded.');
  // Rocks belong to small loading cells; body clearance also checks loaded immediate neighbors.
  const rock = scene.districts.some(d => Math.abs(d.column - area.column) <= 1 && Math.abs(d.row - area.row) <= 1
    && d.boulders.some(r => Math.hypot(r.x - p.x, r.y - p.y) <= r.radius + radius));
  const bridge = feature.bridges.find(b => {
    const local = bridgeLocal(p, b);
    return Math.abs(local.along) <= b.halfLength && Math.abs(local.across) <= b.halfWidth - radius;
  });
  const distance = feature.stream ? terrainProofWaterDistance(p, feature.stream) : Infinity;
  return { walkable: !rock && (Boolean(bridge) || distance > radius),
    placeable: !rock && distance > 24 + radius && !feature.bridges.some(b => bridgeNear(p, b, radius)),
    surface: rock ? 'boulder' : bridge ? 'bridge' : distance <= 0 ? 'water' : distance <= 24 ? 'bank' : 'land',
    ...(bridge ? { bridge } : {}) };
}
export function regionalMovementAllowed(scene, from, to, radius = 12) {
  if (!numberPoint(from) || !numberPoint(to) || Math.hypot(to.x - from.x, to.y - from.y) > 256) {
    throw new Error('Regional movement bound exceeded.');
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
  for (let i = 0; i <= steps; i++) if (!sampleRegionalTerrain(scene, {
    x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }, radius).walkable) return false;
  return true;
}

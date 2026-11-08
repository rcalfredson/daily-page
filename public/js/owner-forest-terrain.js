// Shared generation-3 geometry. It becomes authoritative only through explicit owner-world activation.
export const OWNER_TERRAIN_PROOF_CONFIG = Object.freeze({
  districtSize: 1920,
  dryBoundaryHalfWidth: 36,
  bankMargin: 24,
  accessRadius: 24,
  maximumProtections: 512,
  streamAttempts: 12,
  maximumQueryDistricts: 25,
  coordinateLimit: 999_990_000
});
const C = OWNER_TERRAIN_PROOF_CONFIG;

function unit(seed) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.codePointAt(0), 16777619);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function point(value) {
  if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)
    || Math.abs(value.x) > C.coordinateLimit || Math.abs(value.y) > C.coordinateLimit) {
    throw new Error('Invalid terrain proof point.');
  }
}

export function terrainPointSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1,
    ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function segmentDistance(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const opposite = (x, y) => (x <= 0 && y >= 0) || (x >= 0 && y <= 0);
  const boxesOverlap = Math.max(a.x, b.x) >= Math.min(c.x, d.x)
    && Math.max(c.x, d.x) >= Math.min(a.x, b.x)
    && Math.max(a.y, b.y) >= Math.min(c.y, d.y)
    && Math.max(c.y, d.y) >= Math.min(a.y, b.y);
  if (boxesOverlap && opposite(cross(a, b, c), cross(a, b, d))
    && opposite(cross(c, d, a), cross(c, d, b))) return 0;
  return Math.min(terrainPointSegmentDistance(a, c, d), terrainPointSegmentDistance(b, c, d),
    terrainPointSegmentDistance(c, a, b), terrainPointSegmentDistance(d, a, b));
}

export function buildTerrainProofProtections(records) {
  if (!Array.isArray(records) || records.length > C.maximumProtections) {
    throw new Error('Terrain proof protection bound exceeded.');
  }
  const ids = new Set();
  return records.map(record => {
    point(record);
    if (typeof record.id !== 'string' || !record.id.length || record.id.length > 80
      || ids.has(record.id) || !Number.isFinite(record.radius)
      || record.radius < C.accessRadius || record.radius > 120) {
      throw new Error('Invalid terrain proof protection.');
    }
    ids.add(record.id);
    const left = Math.floor(record.x / C.districtSize) * C.districtSize;
    const top = Math.floor(record.y / C.districtSize) * C.districtSize;
    const ends = [
      { x: left, y: record.y }, { x: left + C.districtSize, y: record.y },
      { x: record.x, y: top }, { x: record.x, y: top + C.districtSize }
    ];
    ends.sort((a, b) => Math.hypot(a.x - record.x, a.y - record.y)
      - Math.hypot(b.x - record.x, b.y - record.y));
    return { id: record.id, x: record.x, y: record.y, radius: record.radius,
      accessEnd: ends[0] };
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function protectionConflict(a, b, radius, protections) {
  return protections.some(p => terrainPointSegmentDistance(p, a, b) <= p.radius + radius
    || segmentDistance(a, b, p, p.accessEnd) <= C.accessRadius + radius);
}

function polygonContains(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y)
      && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function polygonDistance(p, polygon) {
  const distance = Math.min(...polygon.map((a, i) =>
    terrainPointSegmentDistance(p, a, polygon[(i + 1) % polygon.length])));
  return polygonContains(p, polygon) ? -distance : distance;
}

export function terrainProofWaterDistance(p, stream) {
  return Math.min(...stream.waterPolygons.map(polygon => polygonDistance(p, polygon)));
}

function ribbon(points, radii) {
  const sides = [-1, 1].map(side => points.map((p, i) => {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy);
    return { x: p.x + side * radii[i] * dy / length,
      y: p.y - side * radii[i] * dx / length };
  }));
  return [...sides[0], ...sides[1].reverse()];
}

function basin(center, radiusX, radiusY, phase, random, key) {
  const shorePhase = random(`${key}:shore`) * Math.PI * 2;
  return Array.from({ length: 24 }, (_, i) => {
    const angle = i * Math.PI / 12;
    const variation = 1 + Math.sin(angle * 3 + shorePhase) * 0.08
      + Math.sin(angle * 5 - shorePhase) * 0.04;
    const x = Math.cos(angle) * radiusX * variation;
    const y = Math.sin(angle) * radiusY * variation;
    return { x: center.x + x * Math.cos(phase) - y * Math.sin(phase),
      y: center.y + x * Math.sin(phase) + y * Math.cos(phase) };
  });
}

function waterConflict(stream, protections, left, top) {
  const margin = C.bankMargin + 16;
  return stream.waterPolygons.some(polygon => {
    // Keep every bank and body inside its home district's connected dry boundary.
    if (polygon.some(p => p.x <= left + C.dryBoundaryHalfWidth + margin
      || p.x >= left + C.districtSize - C.dryBoundaryHalfWidth - margin
      || p.y <= top + C.dryBoundaryHalfWidth + margin
      || p.y >= top + C.districtSize - C.dryBoundaryHalfWidth - margin)) return true;
    return protections.some(p => polygonDistance(p, polygon) <= p.radius + margin
      || polygonContains(p.accessEnd, polygon)
      || polygon.some((a, i) => segmentDistance(p, p.accessEnd,
        a, polygon[(i + 1) % polygon.length]) <= C.accessRadius + margin));
  });
}

function waterSystem(id, points, random, attempt) {
  const radii = points.map((_, i) => 3 + 21 * Math.min(1, i / 9));
  const main = { id: `${id}:main`, role: 'spring-fed-stream', points, radii,
    outline: ribbon(points, radii) };
  const longitudinal = { x: points[16].x - points[0].x, y: points[16].y - points[0].y };
  const length = Math.hypot(longitudinal.x, longitudinal.y);
  const direction = { x: longitudinal.x / length, y: longitudinal.y / length };
  const normal = { x: -direction.y, y: direction.x };
  const feeders = [-1, 1].map((side, i) => {
    const junction = points[4 + i * 2];
    const feederPoints = [
      { x: junction.x - direction.x * 130 + normal.x * side * 110,
        y: junction.y - direction.y * 130 + normal.y * side * 110 },
      { x: junction.x - direction.x * 65 + normal.x * side * 65,
        y: junction.y - direction.y * 65 + normal.y * side * 65 }, junction
    ];
    const feederRadii = [1.5, 4, 9];
    return { id: `${id}:feeder:${i}`, role: 'headwater-creek', points: feederPoints,
      radii: feederRadii, outline: ribbon(feederPoints, feederRadii), junctionIndex: 4 + i * 2 };
  });
  const source = { kind: 'spring', ...points[0] };
  source.outline = basin(source, 13, 10, 0, random, `${attempt}:spring`);
  // Size is independent of channel length and stays fixed across placement attempts.
  const pondScale = 0.35 + random('pond-size') * 1.6;
  const radiusX = (90 + random('pond-aspect-x') * 75) * pondScale;
  const radiusY = (65 + random('pond-aspect-y') * 45) * pondScale;
  const inletOffset = radiusX * 0.42;
  const outlet = { kind: 'pond', x: points[16].x + direction.x * inletOffset,
    y: points[16].y + direction.y * inletOffset, radiusX, radiusY };
  outlet.outline = basin(outlet, radiusX, radiusY, Math.atan2(direction.y, direction.x),
    random, `${attempt}:pond`);
  return { id: `${id}:stream`, points, channels: [main, ...feeders], source, outlet,
    waterPolygons: [main.outline, ...feeders.map(f => f.outline), source.outline, outlet.outline],
    bankMargin: C.bankMargin };
}

function fitWaterSystem(stream, random, attempt, left, top) {
  const vertices = stream.waterPolygons.flat();
  const minX = Math.min(...vertices.map(p => p.x));
  const maxX = Math.max(...vertices.map(p => p.x));
  const minY = Math.min(...vertices.map(p => p.y));
  const maxY = Math.max(...vertices.map(p => p.y));
  const margin = C.dryBoundaryHalfWidth + C.bankMargin + 17;
  const availableX = C.districtSize - margin * 2 - (maxX - minX);
  const availableY = C.districtSize - margin * 2 - (maxY - minY);
  if (availableX < 0 || availableY < 0) return false;
  const dx = left + margin + random(`${attempt}:fit-x`) * availableX - minX;
  const dy = top + margin + random(`${attempt}:fit-y`) * availableY - minY;
  // Junction and channel points share references. Translate each point exactly once.
  const points = new Set([...vertices, ...stream.channels.flatMap(channel => channel.points),
    stream.source, stream.outlet]);
  for (const p of points) {
    p.x += dx;
    p.y += dy;
  }
  return true;
}

function bridgeLocal(p, bridge) {
  const dx = p.x - bridge.x;
  const dy = p.y - bridge.y;
  return { along: dx * bridge.ux + dy * bridge.uy,
    across: -dx * bridge.uy + dy * bridge.ux };
}

function nearBridge(p, bridge, radius = 0) {
  const local = bridgeLocal(p, bridge);
  return Math.abs(local.along) <= bridge.approachHalfLength + radius
    && Math.abs(local.across) <= bridge.halfWidth + 20 + radius;
}

function district(seed, column, row, protections) {
  const id = `terrain-proof-3:${column}:${row}`;
  const left = column * C.districtSize;
  const top = row * C.districtSize;
  const random = key => unit(`${seed}:${id}:${key}`);
  let stream = null;
  let bridge = null;
  for (let attempt = 0; attempt < (random('water-present') < 0.85 ? C.streamAttempts : 0); attempt += 1) {
    const centerX = left + 380 + random(`${attempt}:x`) * 1160;
    const centerY = top + 720 + random(`${attempt}:y`) * 480;
    const phase = random(`${attempt}:phase`) * Math.PI * 2;
    const halfLength = 220 + random('channel-length') * 470;
    const downstreamSign = random(`${attempt}:direction`) < 0.5 ? -1 : 1;
    const horizontal = random(`${attempt}:orientation`) < 0.5;
    // Swap local axes, not absolute coordinates, to retain the home district.
    const points = Array.from({ length: 17 }, (_, i) => {
      const winding = Math.sin(i * Math.PI / 8 + phase) * 90;
      const longitudinal = downstreamSign * (-halfLength + i * halfLength / 8);
      return { x: Math.round((horizontal ? left + (centerY - top) : centerX)
          + (horizontal ? longitudinal : winding)),
        y: Math.round((horizontal ? top + (centerX - left) : centerY)
          + (horizontal ? winding : longitudinal)) };
    });
    const system = waterSystem(id, points, random, attempt);
    if (!fitWaterSystem(system, random, attempt, left, top)
      || waterConflict(system, protections, left, top)) continue;
    const middle = points[8];
    const tangent = { x: points[9].x - points[7].x, y: points[9].y - points[7].y };
    const length = Math.hypot(tangent.x, tangent.y);
    const candidate = { id: `${id}:bridge`, x: middle.x, y: middle.y,
      ux: tangent.y / length, uy: -tangent.x / length,
      halfLength: 90, halfWidth: 24, approachHalfLength: 120 };
    const start = { x: middle.x - candidate.ux * 120, y: middle.y - candidate.uy * 120 };
    const end = { x: middle.x + candidate.ux * 120, y: middle.y + candidate.uy * 120 };
    if (protectionConflict(start, end, 44, protections)) continue;
    // A large pond or sharply curved short reach must not flood either approach.
    let clearApproaches = true;
    for (let step = -120; step <= 120; step += 2) {
      if (Math.abs(step) <= candidate.halfLength) continue;
      const p = { x: middle.x + candidate.ux * step, y: middle.y + candidate.uy * step };
      if (terrainProofWaterDistance(p, system) <= 12) {
        clearApproaches = false;
        break;
      }
    }
    if (!clearApproaches) continue;
    stream = system;
    bridge = candidate;
    break;
  }
  const boulders = [];
  for (let i = 0; i < 25; i += 1) {
    const rock = { id: `${id}:boulder:${i}`,
      x: Math.round(left + 220 + (i % 5) * 320 + random(`${i}:rock-x`) * 160),
      y: Math.round(top + 220 + Math.floor(i / 5) * 320 + random(`${i}:rock-y`) * 160),
      radius: 18 + Math.floor(random(`${i}:radius`) * 13) };
    if (random(`${i}:accept`) > 0.55 || protectionConflict(rock, rock, rock.radius + 16, protections)
      || (stream && terrainProofWaterDistance(rock, stream) <= stream.bankMargin + rock.radius + 24)
      || (bridge && nearBridge(rock, bridge, rock.radius + 16))) continue;
    boulders.push(rock);
  }
  return { id, column, row, stream, bridge, boulders };
}

// `records` must be the COMPLETE frozen proof fixture, never a page of currently loaded objects.
// Production regional protection delivery is deliberately not implemented here.
export function queryTerrainProof({ seed, bounds, records = [] }) {
  if (typeof seed !== 'string' || !seed.length || seed.length > 80) throw new Error('Invalid seed.');
  point({ x: bounds?.minX, y: bounds?.minY });
  point({ x: bounds?.maxX, y: bounds?.maxY });
  if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) throw new Error('Invalid bounds.');
  const minColumn = Math.floor(bounds.minX / C.districtSize);
  const maxColumn = Math.floor(bounds.maxX / C.districtSize);
  const minRow = Math.floor(bounds.minY / C.districtSize);
  const maxRow = Math.floor(bounds.maxY / C.districtSize);
  if ((maxColumn - minColumn + 1) * (maxRow - minRow + 1) > C.maximumQueryDistricts) {
    throw new Error('Terrain proof district bound exceeded.');
  }
  const protections = buildTerrainProofProtections(records);
  const districts = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      districts.push(district(seed, column, row, protections));
    }
  }
  return { seed, bounds: { ...bounds }, protections, districts };
}

export function sampleTerrainProof(scene, p, bodyRadius = 12) {
  point(p);
  if (!Number.isFinite(bodyRadius) || bodyRadius < 0 || bodyRadius > 24) {
    throw new Error('Invalid terrain proof body radius.');
  }
  const column = Math.floor(p.x / C.districtSize);
  const row = Math.floor(p.y / C.districtSize);
  const area = scene.districts.find(d => d.column === column && d.row === row);
  if (!area) throw new Error('Terrain proof district is not loaded.');
  const rock = area.boulders.some(b => Math.hypot(p.x - b.x, p.y - b.y) <= b.radius + bodyRadius);
  const local = area.bridge && bridgeLocal(p, area.bridge);
  const onBridge = Boolean(local && Math.abs(local.along) <= area.bridge.halfLength
    && Math.abs(local.across) <= area.bridge.halfWidth - bodyRadius);
  const distance = area.stream ? terrainProofWaterDistance(p, area.stream) : Infinity;
  const water = distance <= bodyRadius;
  return { walkable: !rock && (!water || onBridge),
    placeable: !rock && distance > C.bankMargin + bodyRadius
      && !(area.bridge && nearBridge(p, area.bridge, bodyRadius)),
    surface: rock ? 'boulder' : onBridge ? 'bridge'
      : distance <= 0 ? 'water' : distance <= C.bankMargin ? 'bank' : 'land' };
}

// Bounded small-step collision proof; live input integration will clamp its movement delta.
export function terrainProofMovementAllowed(scene, start, end, bodyRadius = 12) {
  point(start);
  point(end);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  if (distance > 256) throw new Error('Terrain proof movement bound exceeded.');
  const steps = Math.max(1, Math.ceil(distance / 4));
  for (let i = 0; i <= steps; i += 1) {
    if (!sampleTerrainProof(scene, { x: start.x + (end.x - start.x) * i / steps,
      y: start.y + (end.y - start.y) * i / steps }, bodyRadius).walkable) return false;
  }
  return true;
}

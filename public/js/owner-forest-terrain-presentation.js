import { buildForestStreamBankModel3d, forestStreamBankProfileAt } from './forest-stream-banks.js';
import { FOREST_ROCK_PALETTES } from './forest-environment.js';
import { paintForestTerrainPolygon, paintForestStreamBankDetail, paintForestStreamBankMark,
  forestStreamFlowVariation, paintForestStreamFlowMark } from './forest-terrain-paint.js';

export const OWNER_FOREST_TERRAIN_PRESENTATION_VERSION = 3;
const V = forestStreamFlowVariation;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
function identity(value) {
  let hash = 2166136261;
  for (const c of value) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0;
}
function mix(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
function pathSampler(points, closed = false) {
  const vertices = closed ? [...points, points[0]] : points;
  const cumulative = [0];
  vertices.slice(1).forEach((p, i) => cumulative.push(cumulative[i]
    + Math.hypot(p.x - vertices[i].x, p.y - vertices[i].y)));
  const length = cumulative.at(-1);
  return { length, at(distance) {
    const d = clamp(distance, 0, length);
    let i = 0;
    while (i < vertices.length - 2 && cumulative[i + 1] < d) i += 1;
    const t = (d - cumulative[i]) / (cumulative[i + 1] - cumulative[i]);
    const tangent = { x: vertices[i + 1].x - vertices[i].x, y: vertices[i + 1].y - vertices[i].y };
    const norm = Math.hypot(tangent.x, tangent.y);
    return { ...mix(vertices[i], vertices[i + 1], t), i, t,
      tangent: { x: tangent.x / norm, y: tangent.y / norm } };
  } };
}

function channelSampler(channel) {
  const path = pathSampler(channel.points);
  return { length: path.length, at(distance, side = 1) {
    const p = path.at(distance);
    const n = channel.points.length;
    const a = side < 0 ? channel.outline[p.i] : channel.outline[n * 2 - 1 - p.i];
    const b = side < 0 ? channel.outline[p.i + 1] : channel.outline[n * 2 - 2 - p.i];
    const edge = mix(a, b, p.t);
    const radius = Math.hypot(edge.x - p.x, edge.y - p.y);
    return { ...p, edge, radius, normal: { x: (edge.x - p.x) / radius, y: (edge.y - p.y) / radius } };
  } };
}

function transformBankModel(manifest, sample, sides) {
  const bank = buildForestStreamBankModel3d(manifest, { firstX: 0, lastX: manifest.world.width }, () => 0);
  const samples = new Map();
  const map = (p, side) => {
    const key = `${side}:${p.x}`;
    if (!samples.has(key)) samples.set(key, {
      profile: forestStreamBankProfileAt(manifest, p.x, side), local: sample(p.x, side)
    });
    const { profile, local } = samples.get(key);
    const inner = side * (manifest.stream.halfWidth + profile.innerOffset);
    const outer = side * (manifest.stream.halfWidth + profile.slopeRun + profile.outerOffset);
    const progress = clamp((p.y - inner) / (outer - inner), 0, 1);
    const width = clamp(local.radius * 0.55 + (profile.slopeRun - 20) * 0.25, 6, 22);
    // Keep the projected waterline at its authoritative location. The original height/stratum
    // model supplies shading and raised grass/log detail within the reserved dry-bank margin.
    const baseZ = -profile.waterDepth * (1 - progress);
    return { x: local.edge.x + local.normal.x * width * progress,
      y: local.edge.y + local.normal.y * width * progress + baseZ, z: p.z };
  };
  const allowed = record => sides.includes(record.side);
  return {
    surfaces: bank.surfaces.filter(allowed).map(s => ({ ...s, points: s.points.map(p => map(p, s.side)) })),
    details: bank.details.filter(allowed).map(d => ({ ...d, from: map(d.from, d.side), to: map(d.to, d.side) })),
    marks: bank.marks.filter(allowed).map(m => ({ ...m, point: map(m.point, m.side) }))
  };
}

function signedArea(points) {
  const origin = points[0];
  return points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + (p.x - origin.x) * (next.y - origin.y)
      - (next.x - origin.x) * (p.y - origin.y);
  }, 0);
}

function contains(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]; const b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y)
      && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function exposedShore(outlines) {
  return outlines.flatMap((polygon, polygonIndex) => polygon.flatMap((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(length / 14));
    const pieces = [];
    for (let part = 0; part < steps; part += 1) {
      const middle = mix(a, b, (part + 0.5) / steps);
      const probe = { x: middle.x + (b.y - a.y) / length * 2,
        y: middle.y - (b.x - a.x) / length * 2 };
      if (outlines.some((other, index) => index !== polygonIndex && contains(probe, other))) continue;
      pieces.push({ from: mix(a, b, part / steps), to: mix(a, b, (part + 1) / steps),
        middle, far: b.x - a.x > 0 });
    }
    return pieces;
  }));
}

export function ownerForestBoulderPresentation(rock) {
  const roll = V(identity(rock.id), 5, 9) * 100;
  let remaining = roll;
  const palette = FOREST_ROCK_PALETTES.find(p => { remaining -= p.weight; return remaining < 0; });
  const variantId = rock.radius < 22 ? 'low' : rock.radius < 27 ? 'shouldered' : 'mossy-outcrop';
  return { worldX: rock.x, worldY: rock.y, width: Math.round(rock.radius * 2.2),
    height: Math.round(rock.radius * (variantId === 'low' ? 1.1 : variantId === 'shouldered' ? 1.43 : 1.5)),
    variantId, rockPaletteId: palette.id, terrainRole: 'land-boulder' };
}

export function buildOwnerTerrainWaterPresentation(stream) {
  const lake = stream.outlet.kind === 'lake' ? stream.outlet.outline : null;
  const banks = [];
  const channels = [];
  const marks = [];
  const bands = [];
  const seed = `${stream.id}:${stream.points[0].x}:${stream.points[0].y}`;
  for (const channel of stream.channels) {
    const path = channelSampler(channel);
    const direction = channel.points.at(-1).x - channel.points[0].x >= 0 ? -1 : 1;
    const manifest = { seed: `${seed}:${channel.id}`, world: { width: path.length }, stream: { halfWidth: 24 } };
    banks.push(transformBankModel(manifest, (d, side) => path.at(d, side * direction), [-1, 1]));
    let flowEnd = path.length;
    if (lake) for (let d = 0; d < path.length; d += 36) {
      if (contains(path.at(d), lake)) { flowEnd = d; break; }
    }
    channels.push({ path, seed: identity(channel.id), length: path.length, flowEnd });
    for (const [lane, halfWidth, color, phase] of lake ? [] : [[0.15, 0.42, '#2f8190', 0.4],
      [-0.65, 0.13, '#4b9b9b', 2.1], [0.7, 0.1, '#1d687d', 4.6]]) {
      const edge = (d, side) => {
        const p = path.at(d);
        const outletFade = clamp((path.length - d) / 100, 0, 1);
        const offset = (lane + Math.sin(d / 176 + phase) * 0.08 + side * halfWidth)
          * p.radius * outletFade;
        return { x: p.x + p.normal.x * offset, y: p.y + p.normal.y * offset };
      };
      const distances = Array.from({ length: Math.ceil(path.length / 16) + 1 }, (_, i) => Math.min(i * 16, path.length));
      bands.push({ points: [...distances.map(d => edge(d, -1)), ...distances.reverse().map(d => edge(d, 1))], color });
    }
    for (let d = 0; d < path.length; d += lake ? 36 : 18) {
      const p = path.at(d);
      for (let lane = -p.radius + 5, i = 0; lane <= p.radius - 4; lane += lake ? 22 : 11, i += 1) {
        const key = Math.floor(d / 18) + i * 1009 + identity(channel.id);
        if (V(key, i, 11) < 0.34) continue;
        marks.push({ x: p.x + p.normal.x * lane, y: p.y + p.normal.y * lane,
          width: 2 + Math.floor(V(key, i, 14) * 7),
          color: ['#216b7b', '#2c7d88', '#3b8c91', '#267687', '#459594'][Math.floor(V(key, i, 15) * 5)] });
      }
    }
  }
  for (const [name, shape] of [['source', stream.source], ['pond', stream.outlet]]) {
    const outline = shape.outline;
    const path = pathSampler(outline, true);
    const orientation = signedArea(outline) >= 0 ? 1 : -1;
    const manifest = { seed: `${seed}:${name}`, world: { width: path.length }, stream: { halfWidth: 0 } };
    banks.push(transformBankModel(manifest, d => {
      const p = path.at(d);
      return { edge: p, radius: name === 'source' ? 5 : 24,
        normal: { x: p.tangent.y * orientation, y: -p.tangent.x * orientation } };
    }, [1]));
    const minX = Math.min(...outline.map(p => p.x)); const maxX = Math.max(...outline.map(p => p.x));
    const minY = Math.min(...outline.map(p => p.y)); const maxY = Math.max(...outline.map(p => p.y));
    for (let x = minX; x < maxX; x += lake ? 54 : 18) {
      for (let y = minY; y < maxY; y += lake ? 54 : 18) {
        const key = Math.floor(x / 18) + Math.floor(y / 18) * 1009;
        if (V(key, 0, 11) < 0.34) continue;
        marks.push({ x, y, width: 2 + Math.floor(V(key, 0, 14) * 7),
          color: ['#216b7b', '#2c7d88', '#3b8c91', '#267687', '#459594'][Math.floor(V(key, 0, 15) * 5)] });
      }
    }
  }
  // Consistent winding makes Canvas nonzero clipping a union even at tributary/pond overlaps.
  const outlines = stream.waterPolygons.map(p => signedArea(p) >= 0 ? p : [...p].reverse());
  return { banks, bands, channels, marks, outlines, shore: exposedShore(outlines), lake, seed: identity(seed) };
}

function inView(p, camera, padding = 30) {
  return p.x >= camera.x - padding && p.x <= camera.x + camera.width + padding
    && p.y >= camera.y - padding && p.y <= camera.y + camera.height + padding;
}
function screen(p, camera) { return { x: Math.round(p.x - camera.x), y: Math.round(p.y - camera.y - (p.z || 0)) }; }
function path(context, points, camera) {
  points.forEach((p, i) => {
    const value = screen(p, camera);
    if (i) context.lineTo(value.x, value.y); else context.moveTo(value.x, value.y);
  });
  context.closePath();
}

// World-anchored ripple groups gently expand/contract and brighten in place. They have no
// downstream translation, and generating only visible grid cells preserves camera continuity.
export function paintOwnerLakeSurface(context, model, camera, time, reducedMotion) {
  if (!model.lake) return;
  const frame = reducedMotion ? 0 : Math.floor(time / 300);
  context.save(); context.beginPath(); path(context, model.lake, camera); context.clip();
  context.globalAlpha *= 0.45;
  for (let gx = Math.floor((camera.x - 40) / 112); gx <= Math.ceil((camera.x + camera.width + 40) / 112); gx++) {
    for (let gy = Math.floor((camera.y - 20) / 80); gy <= Math.ceil((camera.y + camera.height + 20) / 80); gy++) {
      const key = gx + gy * 1009 + model.seed;
      if (V(key, 0, 40) < 0.38) continue;
      const phase = (frame + Math.floor(V(key, 0, 41) * 24)) % 24;
      const strength = Math.round((1 - Math.abs(phase - 12) / 12) * 3);
      const p = screen({ x: gx * 112 + V(key, 0, 42) * 64,
        y: gy * 80 + V(key, 0, 43) * 48 }, camera);
      const width = 7 + Math.floor(V(key, 0, 44) * 9) + strength * 2;
      context.fillStyle = ['#337e8b', '#3d8992', '#49949a', '#579ea1'][strength];
      context.fillRect(p.x - Math.floor(width / 2), p.y, width, 2);
      context.fillRect(p.x + 3, p.y + 5, Math.max(4, width - 6), 2);
    }
  }
  context.restore();
}

export function paintOwnerTerrainWater(context, model, camera, time, reducedMotion) {
  context.save();
  for (const bank of model.banks) {
    for (const surface of bank.surfaces) {
      if (!surface.points.some(p => inView({ x: p.x, y: p.y - p.z }, camera))) continue;
      paintForestTerrainPolygon(context, surface.points.map(p => screen(p, camera)), surface.fill);
    }
    for (const detail of bank.details) {
      if (inView({ x: detail.from.x, y: detail.from.y - detail.from.z }, camera)
        || inView({ x: detail.to.x, y: detail.to.y - detail.to.z }, camera)) {
        paintForestStreamBankDetail(context, detail, camera);
      }
    }
    for (const mark of bank.marks) {
      if (inView({ x: mark.point.x, y: mark.point.y - mark.point.z }, camera)) {
        paintForestStreamBankMark(context, mark, camera);
      }
    }
  }
  context.beginPath();
  model.outlines.forEach(points => path(context, points, camera));
  context.fillStyle = '#247486'; context.fill(); context.clip();
  for (const band of model.bands) paintForestTerrainPolygon(context, band.points.map(p => screen(p, camera)), band.color);
  // Shallow edges retain the test adapter's mineral tones, clipped inside the actual water.
  context.strokeStyle = 'rgba(151, 145, 91, 0.25)'; context.lineWidth = 12;
  context.beginPath();
  for (const edge of model.shore) {
    const from = screen(edge.from, camera); const to = screen(edge.to, camera);
    context.moveTo(from.x, from.y); context.lineTo(to.x, to.y);
  }
  context.stroke();
  for (const edge of model.shore) {
    if (!inView(edge.middle, camera)) continue;
    const p = screen(edge.middle, camera);
    context.fillStyle = edge.far ? '#58a09a' : '#1d6577';
    context.fillRect(p.x, p.y, 4 + Math.floor(V(edge.middle.x, edge.middle.y, 22) * 8), 2);
  }
  for (const mark of model.marks) {
    if (!inView(mark, camera)) continue;
    const p = screen(mark, camera); context.fillStyle = mark.color;
    context.fillRect(p.x, p.y, mark.width, 2);
  }
  paintOwnerLakeSurface(context, model, camera, time, reducedMotion);
  const flowFrame = reducedMotion ? 0 : Math.floor(time / 1000 * 6);
  const distance = flowFrame * 5;
  const phase = distance % 76; const cycle = Math.floor(distance / 76);
  for (const channel of model.channels) {
    const spacing = model.lake ? 220 : 76;
    const lakeDistance = flowFrame * 2;
    const localPhase = model.lake ? lakeDistance % spacing : phase;
    const localCycle = model.lake ? Math.floor(lakeDistance / spacing) : cycle;
    for (const lane of model.lake ? [-0.25, 0.35] : [-0.7, -0.25, 0.25, 0.7]) {
      for (let index = -1; index <= Math.ceil(channel.flowEnd / spacing); index += 1) {
        const key = index - localCycle;
        if (V(key + channel.seed, lane, 0) < 0.28) continue;
        const d = index * spacing + localPhase + (V(key + channel.seed, lane, 1) - 0.5) * 34;
        if (d < 0 || d >= channel.flowEnd) continue;
        const start = channel.path.at(d);
        if (start.radius < 7) continue;
        const p = { x: start.x + start.normal.x * lane * start.radius,
          y: start.y + start.normal.y * lane * start.radius };
        if (!inView(p, camera, 60)) continue;
        const length = model.lake ? 12 + Math.floor(V(key + channel.seed, lane, 2) * 8)
          : 18 + Math.floor(V(key + channel.seed, lane, 2) * 25);
        const stepDirection = V(key + channel.seed, lane, 3) < 0.5 ? -1 : 1;
        const count = length > 32 ? 3 : 2;
        const pos = screen(p, camera);
        context.save();
        context.globalAlpha *= clamp((channel.flowEnd - d) / (model.lake ? 250 : 45), 0, 1) * (model.lake ? 0.65 : 1);
        context.translate(pos.x, pos.y);
        context.rotate(Math.atan2(start.tangent.y, start.tangent.x));
        for (let segment = 0; segment < count; segment += 1) {
          paintForestStreamFlowMark(context, { x: segment * Math.floor(length / count),
            y: segment === 1 ? stepDirection * 2 : 0,
            width: Math.max(5, Math.ceil(length / count) + (segment === 1 ? 2 : 0)),
            pale: lane === -0.25 || lane === 0.7, stepDirection,
            leading: segment === 0, trailing: segment === count - 1,
            highlight: V(key + channel.seed, lane, 4) > 0.66 });
        }
        context.restore();
      }
    }
  }
  context.restore();
}

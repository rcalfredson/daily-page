import { regionalId, sampleRegionalTerrain, regionalMovementAllowed } from './owner-forest-terrain-regional.js';
import { buildOwnerTerrainWaterPresentation, paintOwnerTerrainWater, ownerForestBoulderPresentation }
  from './owner-forest-terrain-presentation.js';
import { paintForestBoulder } from './forest-terrain-paint.js';
import { buildForestBridgeModel3d, forestBridgeProfileHeight, FOREST_BRIDGE_DEFINITION_ID } from './forest-bridges.js';
import { projectForestPoint3d } from './forest-projection.js';

const around = p => Array.from({ length: 9 }, (_, i) => ({ column: Math.floor(p.worldX / 1920) + i % 3 - 1,
  row: Math.floor(p.worldY / 1920) + Math.floor(i / 3) - 1 }));
const key = area => `${area.column}:${area.row}`;
const macroId = area => regionalId(Math.floor((area.column + 4) / 8), Math.floor((area.row + 4) / 8));
const intersects = (b, c) => b && b.minX <= c.x + c.width && b.maxX >= c.x
  && b.minY <= c.y + c.height + 80 && b.maxY >= c.y - 80;
const bridgeActor = b => ({ id: b.id, worldX: b.x, worldY: b.y, halfLength: b.halfLength,
  halfWidth: b.halfWidth, maximumElevationPixels: 16, angleMilliradians: Math.atan2(b.uy, b.ux) * 1000,
  definitionId: FOREST_BRIDGE_DEFINITION_ID });
const bridgeVisible = (b, camera) => intersects({ minX: b.x - b.halfLength - 80,
  maxX: b.x + b.halfLength + 80, minY: b.y - b.halfLength - 80, maxY: b.y + b.halfLength + 80 }, camera);
function invalid() { throw new Error('Invalid regional terrain geometry.'); }
export function validateRegionalFeature(f) {
  if (!Number.isSafeInteger(f?.column) || !Number.isSafeInteger(f?.row) || f.id !== regionalId(f.column, f.row)
    || !['sweeping-river', 'long-lake', 'broad-basin'].includes(f.family)
    || !Array.isArray(f.bridges) || f.bridges.length > 3) invalid();
  const point = p => Number.isFinite(p?.x) && Number.isFinite(p?.y)
    && Math.abs(p.x) <= 999_990_000 && Math.abs(p.y) <= 999_990_000
    && Math.abs(p.x - f.column * 15360) < 7581 && Math.abs(p.y - f.row * 15360) < 7581;
  const poly = (p, maximum = 322) => Array.isArray(p) && p.length >= 3 && p.length <= maximum && p.every(point);
  if (!f.stream) { if (f.stream !== null || f.bridges.length || f.bounds !== null) invalid(); return; }
  const s = f.stream;
  if (s.id !== `${f.id}:water` || s.bankMargin !== 24 || !Array.isArray(s.channels)
    || s.channels.length !== 2 || !poly(s.points, 200) || !point(s.source) || !point(s.outlet)
    || s.outlet.kind !== 'lake' || !poly(s.source.outline, 200) || !poly(s.outlet.outline, 200)
    || !Array.isArray(s.waterPolygons) || s.waterPolygons.length !== 4 || s.waterPolygons.some(p => !poly(p))) invalid();
  for (const [i, c] of s.channels.entries()) {
    if (c.id !== `${f.id}:channel:${i}` || !poly(c.points, 200) || !poly(c.outline)
      || c.outline.length !== c.points.length * 2 || !Array.isArray(c.radii) || c.radii.length !== c.points.length
      || c.radii.some(r => !Number.isFinite(r) || r < 0.5 || r > 260)) invalid();
  }
  if (JSON.stringify(s.points) !== JSON.stringify(s.channels[0].points)
    || JSON.stringify(s.waterPolygons) !== JSON.stringify([...s.channels.map(c => c.outline), s.outlet.outline, s.source.outline])) invalid();
  const vertices = s.waterPolygons.flat();
  const expected = { minX: Math.min(...vertices.map(p => p.x)) - 24, maxX: Math.max(...vertices.map(p => p.x)) + 24,
    minY: Math.min(...vertices.map(p => p.y)) - 24, maxY: Math.max(...vertices.map(p => p.y)) + 24 };
  if (!f.bounds || Object.keys(expected).some(k => f.bounds[k] !== expected[k]) || f.bridges.length !== 3) invalid();
  for (const [i, b] of f.bridges.entries()) {
    if (b.id !== `${f.id}:bridge:${i}` || !point(b) || !Number.isFinite(b.ux) || !Number.isFinite(b.uy)
      || Math.abs(Math.hypot(b.ux, b.uy) - 1) > 0.00001 || !Number.isInteger(b.halfLength)
      || b.halfLength < 24 || b.halfLength > 180 || b.halfWidth !== 24 || b.approachHalfLength !== b.halfLength + 30) invalid();
  }
}
export function createRegionalTerrainScene({ descriptor, fetchRegion }) {
  const cells = new Map(), features = new Map();
  let pending;
  const scene = () => ({ generationVersion: 4, districts: [...cells.values()], features: [...features.values()].map(e => e.feature) });
  const ready = p => around(p).every(d => cells.has(key(d)));
  const sample = p => {
    try { return sampleRegionalTerrain(scene(), { x: p.worldX, y: p.worldY }, p.radius ?? 11); }
    catch { return { walkable: false, placeable: false, surface: 'unloaded' }; }
  };
  async function ensure(p) {
    if (ready(p)) return;
    if (pending) { await pending; return ensure(p); }
    const requested = around(p);
    pending = (async () => {
      const query = new URLSearchParams({ districts: requested.map(key).join(','), token: descriptor.token });
      const response = await fetchRegion(`${descriptor.regionPath}?${query}`);
      if (response.schemaVersion !== 1 || response.generationVersion !== 4 || response.token !== descriptor.token
        || !Array.isArray(response.districts) || response.districts.length !== requested.length
        || !Array.isArray(response.features) || response.features.length < 1 || response.features.length > 9
        || new Set(response.districts.map(key)).size !== requested.length
        || new Set(response.features.map(f => f.id)).size !== response.features.length) invalid();
      for (const f of response.features) {
        validateRegionalFeature(f);
        if (!response.districts.some(d => d.featureId === f.id)) invalid();
        if (features.has(f.id) && JSON.stringify(features.get(f.id).feature) !== JSON.stringify(f)) {
          throw new Error('Regional terrain changed. Reload the forest.');
        }
      }
      for (const area of response.districts) {
        if (!requested.some(d => key(d) === key(area)) || area.id !== `terrain-4:${area.column}:${area.row}`
          || area.featureId !== macroId(area) || !response.features.some(f => f.id === area.featureId)
          || !Array.isArray(area.boulders) || area.boulders.length > 16
          || area.boulders.some(b => typeof b.id !== 'string' || !Number.isFinite(b.x) || !Number.isFinite(b.y)
            || !Number.isInteger(b.radius) || b.radius < 18 || b.radius > 30
            || b.x < area.column * 1920 + 100 || b.x > (area.column + 1) * 1920 - 100
            || b.y < area.row * 1920 + 100 || b.y > (area.row + 1) * 1920 - 100)) invalid();
      }
      // Apply only after the complete response passes. Keep models for unchanged shared features.
      for (const f of response.features) if (!features.has(f.id)) features.set(f.id, { feature: f,
        bridges: f.bridges.map(b => {
          const actor = bridgeActor(b); return { geometry: b, actor, model: buildForestBridgeModel3d(actor) };
        }) });
      for (const area of response.districts) { cells.delete(key(area)); cells.set(key(area), area); }
      while (cells.size > 25) cells.delete(cells.keys().next().value);
      for (const id of features.keys()) if (![...cells.values()].some(d => d.featureId === id)) features.delete(id);
    })();
    try { await pending; } finally { pending = null; }
  }
  const visible = camera => [...features.values()].filter(e => intersects(e.feature.bounds, camera));
  function line(ctx, from, to, color, width) {
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function paintGround(ctx, camera, time, reducedMotion) {
    for (const entry of visible(camera)) {
      entry.water ||= buildOwnerTerrainWaterPresentation(entry.feature.stream);
      paintOwnerTerrainWater(ctx, entry.water, camera, time, reducedMotion);
      const order = { shadow: 0, abutment: 1, fascia: 2, 'plank-end': 3, plank: 4 };
      for (const { model, geometry } of entry.bridges) {
        if (!bridgeVisible(geometry, camera)) continue;
        for (const s of [...model.surfaces].sort((a, b) => order[a.role] - order[b.role] || a.ordinal - b.ordinal)) {
          ctx.beginPath(); s.points.forEach((p, i) => {
            const v = projectForestPoint3d(p, camera); if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y);
          }); ctx.closePath(); ctx.fillStyle = s.fill; ctx.fill();
        }
        for (const d of model.details) line(ctx, projectForestPoint3d(d.from, camera), projectForestPoint3d(d.to, camera), d.color, d.width);
      }
    }
  }
  function depthItems(camera) {
    return [...[...cells.values()].filter(area => intersects({ minX: area.column * 1920, maxX: (area.column + 1) * 1920,
      minY: area.row * 1920, maxY: (area.row + 1) * 1920 }, camera)).flatMap(area => area.boulders.map(rock => ({
      kind: 'terrain-rock', id: rock.id, rock, worldY: rock.y }))),
    ...visible(camera).flatMap(e => e.bridges.filter(b => bridgeVisible(b.geometry, camera)).flatMap(({ actor, model }) => model.members.map(member => ({
      kind: 'terrain-rail', id: `${actor.id}:${member.id}`, member,
      worldY: (member.from.y + member.to.y + member.from.z + member.to.z) / 2 }))))];
  }
  function paintDepth(ctx, item, camera) {
    ctx.save();
    if (item.member) {
      const m = item.member; ctx.lineCap = 'round';
      line(ctx, projectForestPoint3d(m.from, camera), projectForestPoint3d(m.to, camera), m.colors[0], m.width);
      line(ctx, projectForestPoint3d(m.from, camera), projectForestPoint3d(m.to, camera), m.colors[1], Math.max(1, m.width / 3));
    } else paintForestBoulder(ctx, ownerForestBoulderPresentation(item.rock), camera);
    ctx.restore();
  }
  return { ensure, ready, sample, paintGround, depthItems, paintDepth,
    elevation: p => {
      const b = sample(p).bridge;
      return b ? forestBridgeProfileHeight(bridgeActor(b), (p.worldX - b.x) * b.ux + (p.worldY - b.y) * b.uy) : 0;
    },
    canMove: (from, to) => {
      try { return regionalMovementAllowed(scene(), { x: from.worldX, y: from.worldY },
        { x: to.worldX, y: to.worldY }, from.radius); } catch { return false; }
    }
  };
}

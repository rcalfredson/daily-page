import { buildOwnerTerrainWaterPresentation, paintOwnerTerrainWater, ownerForestBoulderPresentation } from './owner-forest-terrain-presentation.js';
import { paintForestBoulder } from './forest-terrain-paint.js';
import { sampleTerrainProof, terrainProofMovementAllowed } from './owner-forest-terrain.js';
import { buildForestBridgeModel3d, forestBridgeProfileHeight, FOREST_BRIDGE_DEFINITION_ID }
  from './forest-bridges.js';
import { projectForestPoint3d } from './forest-projection.js';
import { createRegionalTerrainScene } from './owner-forest-terrain-regional-scene.js';

export function ownerTerrainDistrictsAround(position) {
  const x = Math.floor(position.worldX / 1920);
  const y = Math.floor(position.worldY / 1920);
  return Array.from({ length: 9 }, (_, i) => ({ cellX: x + i % 3 - 1,
    cellY: y + Math.floor(i / 3) - 1 }));
}

function validateDistrict(area) {
  if (!Number.isSafeInteger(area?.column) || !Number.isSafeInteger(area?.row)
    || area.id !== `terrain-proof-3:${area.column}:${area.row}`
    || !Array.isArray(area.boulders) || area.boulders.length > 25
    || Boolean(area.stream) !== Boolean(area.bridge)) throw new Error('Invalid terrain district.');
  const point = p => Number.isFinite(p?.x) && Number.isFinite(p?.y)
    && p.x >= area.column * 1920 && p.x <= (area.column + 1) * 1920
    && p.y >= area.row * 1920 && p.y <= (area.row + 1) * 1920;
  if (area.boulders.some(p => !point(p) || !Number.isFinite(p.radius)
    || p.radius < 18 || p.radius > 30)) throw new Error('Invalid terrain boulder.');
  if (area.stream) {
    const s = area.stream;
    const b = area.bridge;
    if (!Array.isArray(s.waterPolygons) || s.waterPolygons.length !== 5
      || s.waterPolygons.some(p => !Array.isArray(p) || p.length < 3 || p.length > 34
        || p.some(v => !point(v))) || s.bankMargin !== 24
      || !Array.isArray(s.points) || s.points.length !== 17 || s.points.some(p => !point(p))
      || !point(b) || !Number.isFinite(b.ux) || !Number.isFinite(b.uy)
      || Math.abs(Math.hypot(b.ux, b.uy) - 1) > 0.00001
      || b.halfLength !== 90 || b.halfWidth !== 24 || b.approachHalfLength !== 120) {
      throw new Error('Invalid terrain water geometry.');
    }
  }
}

export function createOwnerForestTerrainScene({ descriptor = null,
  fetchRegion = async url => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Terrain could not be loaded.');
    return response.json();
  } } = {}) {
  if (descriptor && (descriptor.schemaVersion !== 1 || ![3, 4].includes(descriptor.generationVersion)
    || descriptor.districtSize !== 1920 || typeof descriptor.token !== 'string'
    || !/^[a-f0-9-]{36}:1$/.test(descriptor.token)
    || descriptor.regionPath !== '/api/v1/forest/terrain-regions')) {
    throw new Error('Unsupported terrain descriptor.');
  }
  if (descriptor?.generationVersion === 4) return createRegionalTerrainScene({ descriptor, fetchRegion });
  const cache = new Map();
  let pending = null;
  const key = d => `${d.column}:${d.row}`;
  const scene = () => ({ districts: [...cache.values()].map(d => d.area) });
  const sample = p => {
    if (!descriptor) return { walkable: true, placeable: true, surface: 'land' };
    try { return sampleTerrainProof(scene(), { x: p.worldX, y: p.worldY }, p.radius ?? 11); }
    catch { return { walkable: false, placeable: false, surface: 'unloaded' }; }
  };
  function ready(position) {
    return !descriptor || ownerTerrainDistrictsAround(position)
      .every(d => cache.has(`${d.cellX}:${d.cellY}`));
  }
  async function ensure(position) {
    if (!descriptor || ready(position)) return;
    if (pending) { await pending; return ensure(position); }
    const requested = ownerTerrainDistrictsAround(position);
    pending = (async () => {
      const query = new URLSearchParams({ districts: requested.map(d => `${d.cellX}:${d.cellY}`).join(','),
        token: descriptor.token });
      const result = await fetchRegion(`${descriptor.regionPath}?${query}`);
      if (result.schemaVersion !== 1 || result.generationVersion !== 3 || result.token !== descriptor.token
        || !Array.isArray(result.districts) || result.districts.length !== requested.length
        || new Set(result.districts.map(key)).size !== requested.length) {
        throw new Error('Terrain version changed. Reload the forest.');
      }
      for (const area of result.districts) {
        if (!requested.some(d => d.cellX === area.column && d.cellY === area.row)) {
          throw new Error('Unexpected terrain district.');
        }
        validateDistrict(area);
      }
      for (const area of result.districts) {
        const id = key(area);
        cache.delete(id);
        const b = area.bridge;
        const bridge = b ? { id: b.id, worldX: b.x, worldY: b.y,
          halfLength: b.halfLength, halfWidth: b.halfWidth, maximumElevationPixels: 16,
          angleMilliradians: Math.atan2(b.uy, b.ux) * 1000,
          definitionId: FOREST_BRIDGE_DEFINITION_ID } : null;
        cache.set(id, { area, bridge, model: bridge ? buildForestBridgeModel3d(bridge) : null });
      }
      while (cache.size > 25) cache.delete(cache.keys().next().value);
    })();
    try { await pending; } finally { pending = null; }
  }
  function visible(camera) {
    return [...cache.values()].filter(({ area }) => (area.column + 1) * 1920 >= camera.x
      && area.column * 1920 <= camera.x + camera.width
      && (area.row + 1) * 1920 >= camera.y - 80 && area.row * 1920 <= camera.y + camera.height + 80);
  }
  function polygon(ctx, points, fill) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function line(ctx, from, to, color, width) {
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function paintGround(ctx, camera, time, reducedMotion) {
    if (!descriptor) return;
    for (const entry of visible(camera)) {
      const { area, model } = entry;
      const s = area.stream;
      if (!s) continue;
      ctx.save(); ctx.lineJoin = 'round';
      entry.waterPresentation ||= buildOwnerTerrainWaterPresentation(s);
      paintOwnerTerrainWater(ctx, entry.waterPresentation, camera, time, reducedMotion);
      const order = { shadow: 0, abutment: 1, fascia: 2, 'plank-end': 3, plank: 4 };
      for (const surface of [...model.surfaces].sort((a, b) => order[a.role] - order[b.role]
        || a.ordinal - b.ordinal)) {
        polygon(ctx, surface.points.map(p => projectForestPoint3d(p, camera)), surface.fill);
      }
      for (const detail of model.details) line(ctx, projectForestPoint3d(detail.from, camera),
        projectForestPoint3d(detail.to, camera), detail.color, detail.width);
      ctx.restore();
    }
  }
  function depthItems(camera) {
    return visible(camera).flatMap(({ area, model }) => [
      ...area.boulders.map(rock => ({ kind: 'terrain-rock', id: rock.id, rock, worldY: rock.y })),
      ...(model?.members || []).map(member => ({ kind: 'terrain-rail',
        id: `${area.id}:${member.id}`, member,
        worldY: (member.from.y + member.to.y + member.from.z + member.to.z) / 2 }))
    ]);
  }
  function paintDepth(ctx, item, camera) {
    ctx.save();
    if (item.member) {
      const m = item.member;
      ctx.lineCap = 'round';
      const from = projectForestPoint3d(m.from, camera); const to = projectForestPoint3d(m.to, camera);
      line(ctx, from, to, m.colors[0], m.width);
      line(ctx, from, to, m.colors[1], Math.max(1, m.width / 3));
    } else {
      paintForestBoulder(ctx, ownerForestBoulderPresentation(item.rock), camera);
    }
    ctx.restore();
  }
  function elevation(p) {
    if (sample(p).surface !== 'bridge') return 0;
    const entry = cache.get(`${Math.floor(p.worldX / 1920)}:${Math.floor(p.worldY / 1920)}`);
    const b = entry.area.bridge;
    return forestBridgeProfileHeight(entry.bridge, (p.worldX - b.x) * b.ux + (p.worldY - b.y) * b.uy);
  }
  return { ensure, ready, sample, paintGround, depthItems, paintDepth, elevation,
    canMove: (from, to) => {
      if (!descriptor) return true;
      try { return terrainProofMovementAllowed(scene(), { x: from.worldX, y: from.worldY },
        { x: to.worldX, y: to.worldY }, from.radius); } catch { return false; }
    } };
}

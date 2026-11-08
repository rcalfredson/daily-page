/* global document, matchMedia, devicePixelRatio, requestAnimationFrame, addEventListener */
import { buildWaterStudy, studySample, studyCanMove, studyWaterDistance, queryWaterStudy,
  studyHash, WATER_STUDY_SPEED } from './forestWaterStudyGeometry.js';
import { paintForestHumanoid, createForestHumanoidMotion, advanceForestHumanoidMotion }
  from '/js/forest-humanoid.js';
import { buildForestBridgeModel3d, forestBridgeProfileHeight } from '/js/forest-bridges.js';
import { paintForestBoulder } from '/js/forest-terrain-paint.js';
import { ownerForestBoulderPresentation, buildOwnerTerrainWaterPresentation, paintOwnerTerrainWater }
  from '/js/owner-forest-terrain-presentation.js';
import { sampleOwnerForestGroundPresentation } from '/js/owner-forest-environment.js';

const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
const status = document.querySelector('#status'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
let scene, bridgeModel, waterModel, player, motion, shore, overview = false, tour = false, routeIndex = 0;
let elapsed = 0, travelled = 0, last = 0, pointer = null, stopName = 'Upstream';
const keys = new Set();
const camera = { x: 0, y: 0, width: 0, height: 0 };
function reset() {
  scene = buildWaterStudy(document.querySelector('#seed').value);
  bridgeModel = buildForestBridgeModel3d(scene.bridge);
  waterModel = buildOwnerTerrainWaterPresentation({ id: `${scene.id}:${scene.seed}`, points: scene.points,
    channels: scene.channels, source: scene.source, outlet: { kind: 'lake', outline: scene.lake }, waterPolygons: scene.polygons });
  // Let the large silhouettes carry the composition. Keep established bank materials while
  // reducing water contrast/density; no collision footprint comes from this presentation model.
  waterModel.bands = [];
  waterModel.marks = waterModel.marks.filter((_, i) => i % 4 === 0);
  waterModel.channels = [];
  // Subdivide only for shore paint; neither collision nor geometry depends on this sampling.
  shore = scene.polygons.flatMap(poly => poly.flatMap((a, i) => {
    const b = poly[(i + 1) % poly.length], length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(length / 12), edges = [];
    for (let j = 0; j < steps; j++) {
      const p = { x: a.x + (b.x - a.x) * (j + 0.5) / steps,
        y: a.y + (b.y - a.y) * (j + 0.5) / steps };
      const n = { x: (b.y - a.y) / length, y: -(b.x - a.x) / length };
      // Only exterior union edges get banks: no inlet/confluence seam.
      if (studyWaterDistance(scene, { x: p.x + n.x * 3, y: p.y + n.y * 3 }) > 1
        || studyWaterDistance(scene, { x: p.x - n.x * 3, y: p.y - n.y * 3 }) > 1) {
        edges.push({ a: { x: a.x + (b.x - a.x) * j / steps, y: a.y + (b.y - a.y) * j / steps },
          b: { x: a.x + (b.x - a.x) * (j + 1) / steps, y: a.y + (b.y - a.y) * (j + 1) / steps }, p });
      }
    }
    return edges;
  }));
  jump('upstream');
}
function jump(name) {
  tour = false; overview = false; elapsed = 0; travelled = 0; stopName = name;
  const index = name === 'confluence' ? 58 : name === 'bridge' ? 100 : name === 'inlet' ? 152 : 50;
  const p = name === 'lake' ? { x: -1370, y: 1250 }
    : scene.route[Math.max(0, Math.min(scene.route.length - 1, index - 50))];
  player = { ...p };
  // Shore stop is outside the largest seed's lake, with water filling the right of the camera.
  if (name === 'lake') while (!studySample(scene, player).walkable) player.x -= 20;
  motion = createForestHumanoidMotion();
}
function polygon(poly, fill, stroke = null, width = 1) {
  ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(a, b, color, width) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
const view = p => ({ x: Math.round(p.x - camera.x), y: Math.round(p.y - camera.y - (p.z || 0)) });
const visible = (p, margin = 70) => p.x > camera.x - margin && p.x < camera.x + camera.width + margin
  && p.y > camera.y - margin && p.y < camera.y + camera.height + margin;
function paint(time) {
  const ratio = devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false;
  camera.width = rect.width; camera.height = rect.height;
  camera.x = Math.round(player.x - rect.width / 2); camera.y = Math.round(player.y - rect.height / 2);
  if (overview) {
    ctx.fillStyle = '#5e7951'; ctx.fillRect(0, 0, rect.width, rect.height);
    const scale = Math.min(rect.width / 5000, rect.height / 12800);
    ctx.save(); ctx.translate(rect.width / 2, 20); ctx.scale(scale, scale); ctx.translate(0, 9800);
    for (const poly of scene.polygons) polygon(poly, '#397d87');
    for (let y = -9600; y < 3800; y += 1920) line({ x: -2200, y }, { x: 2200, y }, '#a4ae77', 8);
    ctx.beginPath(); scene.route.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = '#f5d28b'; ctx.lineWidth = 18; ctx.stroke();
    ctx.fillStyle = '#fff3d1'; ctx.fillRect(player.x - 60, player.y - 60, 120, 120); ctx.restore();
    return;
  }
  for (let y = Math.floor(camera.y / 48) * 48; y < camera.y + rect.height; y += 48) {
    for (let x = Math.floor(camera.x / 48) * 48; x < camera.x + rect.width; x += 48) {
      const { color: c } = sampleOwnerForestGroundPresentation({ worldSeed: scene.seed, worldX: x, worldY: y });
      ctx.fillStyle = `rgb(${c.red},${c.green},${c.blue})`; ctx.fillRect(x - camera.x, y - camera.y, 48, 48);
    }
  }
  const polygons = queryWaterStudy(scene, { minX: camera.x, minY: camera.y,
    maxX: camera.x + rect.width, maxY: camera.y + rect.height });
  // Lay all dry bank margins first, then the union of all water. Intersections stay submerged.
  for (const poly of polygons) polygon(poly.map(view), '#858768', '#858768', 30);
  for (const poly of polygons) polygon(poly.map(view), '#377e89');
  for (const edge of shore) {
    if (!visible(edge.p, 20)) continue;
    line(view(edge.a), view(edge.b), edge.b.x > edge.a.x ? '#a4a37a' : '#566f61', 4);
  }
  // Sparse, world-anchored marks, clipped separately to each shape; no animated particle spray.
  const frozen = reduced.matches || document.querySelector('#motion').checked;
  for (let i = 0; i < polygons.length; i++) {
    ctx.save(); polygon(polygons[i].map(view), null); ctx.clip();
    for (let y = Math.floor(camera.y / 72) * 72; y < camera.y + rect.height; y += 72) {
      for (let x = Math.floor(camera.x / 92) * 92; x < camera.x + rect.width; x += 92) {
        const h = studyHash(`${scene.seed}:${x}:${y}`);
        if (h < 0.66) continue;
        const drift = frozen ? 0 : Math.floor(time / 220) % 4 * 2;
        ctx.fillStyle = '#53939a'; ctx.fillRect(x - camera.x + h * 42, y - camera.y + drift, 7 + h * 10, 2);
      }
    }
    ctx.restore();
  }
  if (document.querySelector('#materials').checked) paintOwnerTerrainWater(ctx, waterModel, camera, time, frozen);
  const drift = frozen ? 0 : Math.floor(time / 240) % 32 / 32;
  for (let i = 1; i < 148; i += 4) {
    const a = scene.points[i], b = scene.points[i + 1];
    const p = { x: a.x + (b.x - a.x) * drift, y: a.y + (b.y - a.y) * drift };
    if (!visible(p, 10)) continue;
    const s = view(p); ctx.fillStyle = '#579b9c'; ctx.fillRect(s.x - 8, s.y, 16, 2);
    ctx.fillRect(s.x + 4, s.y + 2, 6, 2);
  }
  const order = { shadow: 0, abutment: 1, fascia: 2, 'plank-end': 3, plank: 4 };
  for (const surface of [...bridgeModel.surfaces].sort((a, b) => order[a.role] - order[b.role] || a.ordinal - b.ordinal)) {
    if (surface.points.some(p => visible(p))) polygon(surface.points.map(view), surface.fill);
  }
  for (const d of bridgeModel.details) if (visible(d.from)) line(view(d.from), view(d.to), d.color, d.width);
  const sample = studySample(scene, player);
  const elevation = sample.surface === 'bridge' ? forestBridgeProfileHeight(scene.bridge, sample.along) : 0;
  const actors = [
    ...scene.rocks.filter(r => visible(r)).map(rock => ({ y: rock.y, rock })),
    ...bridgeModel.members.filter(m => visible(m.from)).map(member => ({ y: (member.from.y + member.to.y
      + member.from.z + member.to.z) / 2, member })), { y: player.y + elevation, player: true }
  ].sort((a, b) => a.y - b.y);
  for (const actor of actors) {
    if (actor.rock) paintForestBoulder(ctx, ownerForestBoulderPresentation(actor.rock), camera);
    else if (actor.member) {
      const m = actor.member;
      line(view(m.from), view(m.to), m.colors[0], m.width);
      line(view(m.from), view(m.to), m.colors[1], Math.max(1, m.width / 3));
    } else {
      const p = view({ ...player, z: elevation });
      paintForestHumanoid(ctx, p.x, p.y, { motion, reducedMotion: reduced.matches });
    }
  }
}
function frame(time) {
  const dt = Math.min(0.04, (time - last) / 1000 || 0); last = time;
  let dx = Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a'));
  let dy = Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'));
  if (pointer && !overview) {
    dx = pointer.x - canvas.clientWidth / 2; dy = pointer.y - canvas.clientHeight / 2;
    if (Math.hypot(dx, dy) < 12) { dx = 0; dy = 0; }
  }
  if (tour) {
    let target = scene.route[routeIndex];
    if (Math.hypot(target.x - player.x, target.y - player.y) < 5 && routeIndex < scene.route.length - 1) target = scene.route[++routeIndex];
    dx = target.x - player.x; dy = target.y - player.y;
    elapsed += dt;
    if (routeIndex === scene.route.length - 1 && Math.hypot(dx, dy) < 3) { tour = false; stopName = 'Bank walk complete'; }
  }
  const from = { ...player }, length = Math.hypot(dx, dy);
  if (length > 0 && !overview) {
    const distance = Math.min(WATER_STUDY_SPEED * dt, tour ? length : Infinity);
    const to = { x: player.x + dx / length * distance, y: player.y + dy / length * distance };
    if (studyCanMove(scene, player, to)) player = to;
    else if (tour) { tour = false; stopName = 'Walk blocked (study defect)'; }
  }
  const distance = Math.hypot(player.x - from.x, player.y - from.y); travelled += distance;
  motion = advanceForestHumanoidMotion(motion, { from: { worldX: from.x, worldY: from.y },
    to: { worldX: player.x, worldY: player.y }, elapsedSeconds: dt, reducedMotion: reduced.matches });
  paint(time);
  status.textContent = `${overview ? 'Overview · horizontal lines are old 1,920-unit boundaries' : stopName}
    · ${Math.round(player.x)}, ${Math.round(player.y)} · walked ${Math.round(travelled)} units
    · ${elapsed.toFixed(1)}s · bank route ${Math.round(scene.routeLength)} units / ${(scene.routeLength / 108).toFixed(1)}s`;
  requestAnimationFrame(frame);
}
canvas.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) {
    e.preventDefault(); keys.add(e.key); tour = false; overview = false;
  }
});
addEventListener('keyup', e => keys.delete(e.key));
addEventListener('blur', () => { keys.clear(); pointer = null; });
canvas.addEventListener('pointerdown', e => {
  canvas.focus({ preventScroll: true }); tour = false; canvas.setPointerCapture(e.pointerId);
  const rect = canvas.getBoundingClientRect(); pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
});
canvas.addEventListener('pointermove', e => {
  if (pointer) { const rect = canvas.getBoundingClientRect(); pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event, () => { pointer = null; });
canvas.addEventListener('blur', () => { keys.clear(); pointer = null; });
document.querySelector('#seed').onchange = reset;
document.querySelectorAll('[data-stop]').forEach(button => button.onclick = () => { jump(button.dataset.stop); canvas.focus(); });
document.querySelector('#walk').onclick = () => { jump('upstream'); tour = true; routeIndex = 0; canvas.focus(); };
document.querySelector('#map').onclick = () => { overview = !overview; tour = false; };
reset(); requestAnimationFrame(frame);

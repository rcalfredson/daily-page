import { cartDefinition } from '/js/forest-cart-motion.js';
import { constructionHomeFootprint } from '/js/forest-construction-design.js';
import { paintForestHumanoid } from '/js/forest-humanoid.js';

const WOOD = {
  honey: ['#c6a16b', '#a57a4c', '#795b3c', '#e1be85'],
  walnut: ['#9b7855', '#77553d', '#503e30', '#bd9265'],
  sage: ['#a7ae88', '#7c8e6b', '#55694f', '#c3c8a0'],
  clay: ['#ca987b', '#ae735b', '#7c5141', '#e0b594'],
  cream: ['#e3d2a9', '#c9b788', '#9d8c65', '#f2e2bc']
};
const ROOF = { moss: ['#667451', '#506348', '#8c9870'], rust: ['#ac7552', '#86553f', '#c39465'],
  slate: ['#6e8790', '#4f6975', '#97a8a6'] };
const CLOTH = { ochre: ['#d3ae61', '#b88a43', '#ecd393'], moss: ['#8fa17a', '#637e5e', '#b7c19a'],
  indigo: ['#879da9', '#587786', '#b1c2c2'] };
function polygon(ctx, points, color, stroke = '#4d4b37') {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function line(ctx, a, b, color, width = 2) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = color;
  ctx.lineWidth = width; ctx.stroke();
}
function box(ctx, project, x, y, w, d, height, colors, base = 0) {
  const p = (a, b, z) => project(x + a, y + b, z + base);
  const corners = [[-w, -d], [w, -d], [w, d], [-w, d]];
  const faces = corners.map(([a, b], i) => {
    const [c, e] = corners[(i + 1) % 4];
    return { depth: (p(a, b, 0).y + p(c, e, 0).y) / 2,
      points: [p(a, b, 0), p(c, e, 0), p(c, e, height), p(a, b, height)], color: colors[i % 2 + 1] };
  });
  faces.sort((a, b) => a.depth - b.depth).forEach(f => polygon(ctx, f.points, f.color));
  polygon(ctx, corners.map(([a, b]) => p(a, b, height)), colors[0]);
}

export function paintStudyHome(ctx, home, design, camera) {
  const rect = constructionHomeFootprint(home, design), w = design.width / 2, d = design.depth / 2;
  const center = { x: home.x, y: (rect.minY + rect.maxY) / 2 };
  const p = (x, y, z = 0) => ({ x: Math.round(center.x + x - camera.x), y: Math.round(center.y + y - z - camera.y) });
  const wood = WOOD[design.color], roof = ROOF[design.roofColor];
  ctx.save(); ctx.lineJoin = 'round';
  polygon(ctx, [p(-w - 8, -d), p(w + 22, -d + 12), p(w + 22, d + 16), p(-w, d + 16)], 'rgba(20,30,22,.2)', null);
  box(ctx, p, 0, 0, w + 2, d + 1, 7, ['#b1ab8e', '#948e76', '#716f59']);
  box(ctx, p, 0, 0, w, d, 64, wood, 5);
  for (let row = 0; row < 7; row++) {
    const z = 7 + row * 9;
    line(ctx, p(-w, d + 1, z), p(w, d + 1, z + (row % 2)), wood[2], 1);
    const step = design.walls === 'shingles' ? 16 : 40;
    for (let x = -w; x < w; x += step) {
      const seam = Math.min(w, x + step / 2 + (row % 2) * 5);
      line(ctx, p(seam, d + 1, z), p(seam, d + 1, z + 8), wood[2], 1);
      line(ctx, p(x + 3, d + 2, z + 3), p(Math.min(w - 2, x + step - 5), d + 2, z + 4), wood[3], 1);
    }
  }
  for (const x of [-w + 3, w - 3]) line(ctx, p(x, d + 2, 6), p(x, d + 2, 68), '#69583e', 5);
  // Individual staggered roof pieces keep the silhouette handmade at actual scene scale.
  const ridge = 103, roofWidth = w + 9, roofDepth = d + 9;
  polygon(ctx, [p(-w, -d, 69), p(-w, 0, ridge), p(-w, d, 69)], wood[1]);
  for (const sign of [-1, 1]) {
    polygon(ctx, [p(-roofWidth, 0, ridge), p(roofWidth, 0, ridge), p(roofWidth, sign * roofDepth, 68),
      p(-roofWidth, sign * roofDepth, 68)], roof[1]);
    for (let row = 0; row < 5; row++) {
      const t0 = row / 5, t1 = (row + 1) / 5;
      for (let col = -roofWidth - 9; col < roofWidth; col += 18) {
        const x0 = Math.max(-roofWidth, col + (row % 2) * 9), x1 = Math.min(roofWidth, col + 18 + (row % 2) * 9);
        if (x1 <= x0) continue;
        const nick = design.roof === 'shakes' ? (Math.abs(col + row) % 3) : 0;
        polygon(ctx, [p(x0, sign * roofDepth * t0, ridge - 35 * t0), p(x1, sign * roofDepth * t0, ridge - 35 * t0),
          p(x1 - nick, sign * roofDepth * t1, ridge - 35 * t1), p(x0, sign * roofDepth * t1, ridge - 35 * t1)],
        roof[(Math.abs(col + row * 7) % 5 === 0) ? 2 : 0], roof[1]);
        if (design.roof === 'tiles') line(ctx, p(x0 + 3, sign * roofDepth * t0, ridge - 35 * t0),
          p(x0 + 3, sign * roofDepth * t1, ridge - 35 * t1), roof[2], 2);
      }
    }
  }
  line(ctx, p(-roofWidth - 2, 0, ridge + 1), p(roofWidth + 2, 0, ridge + 1), '#b7a17a', 4);
  line(ctx, p(-roofWidth, roofDepth, 68), p(roofWidth, roofDepth, 68), '#69553b', 4);
  polygon(ctx, [p(-15, d + 2, 6), p(15, d + 2, 6), p(15, d + 2, 49), p(-15, d + 2, 49)], '#5d4732');
  polygon(ctx, [p(-12, d + 3, 6), p(12, d + 3, 6), p(12, d + 3, 46), p(-12, d + 3, 46)], '#956a44');
  for (const x of [-6, 0, 6]) line(ctx, p(x, d + 4, 7), p(x, d + 4, 44), '#765235', 1);
  for (const z of [15, 38]) line(ctx, p(-12, d + 4, z), p(-5, d + 4, z), '#403d30', 2);
  const knob = p(8, d + 5, 25); ctx.fillStyle = '#e2bd66'; ctx.fillRect(knob.x, knob.y, 3, 3);
  for (const x of [-w + 27, w - 27]) {
    polygon(ctx, [p(x - 12, d + 2, 28), p(x + 12, d + 2, 28), p(x + 12, d + 2, 52), p(x - 12, d + 2, 52)], '#69553c');
    polygon(ctx, [p(x - 9, d + 3, 31), p(x + 9, d + 3, 31), p(x + 9, d + 3, 49), p(x - 9, d + 3, 49)], '#efcf86');
    line(ctx, p(x, d + 4, 31), p(x, d + 4, 49), '#a48451', 2);
    line(ctx, p(x - 9, d + 4, 40), p(x + 9, d + 4, 40), '#a48451', 2);
    line(ctx, p(x - 15, d + 3, 27), p(x + 15, d + 3, 27), wood[3], 4);
    for (const side of [-1, 1]) {
      line(ctx, p(x + side * 17, d + 2, 30), p(x + side * 17, d + 2, 51), roof[1], 6);
      line(ctx, p(x + side * 17, d + 3, 36), p(x + side * 17, d + 3, 46), roof[2], 2);
    }
  }
  box(ctx, p, w - 29, -10, 10, 9, 34, ['#b89d7e', '#a2876d', '#796e59'], 82);
  for (let z = 87; z < 114; z += 7) {
    line(ctx, p(w - 39, -1, z), p(w - 19, -1, z), '#d0bda0', 1);
    line(ctx, p(w - 33 + (z % 2) * 6, -1, z), p(w - 33 + (z % 2) * 6, -1, z + 6), '#d0bda0', 1);
  }
  box(ctx, p, w - 29, -10, 12, 11, 4, ['#5b5545', '#86795e', '#695e49'], 116);
  polygon(ctx, [p(-21, d + 2, 5), p(21, d + 2, 5), p(24, d + 15), p(-24, d + 15)], '#b9ad8d');
  line(ctx, p(-19, d + 9, 2), p(21, d + 9, 2), '#8c846a', 1);
  ctx.restore();
}

export function paintStudyCart(ctx, cart, camera, mounted, elevation = 0, motion = { wheel: 0, gait: 0 }) {
  const d = cartDefinition(cart), design = cart.design;
  const c = Math.cos(cart.heading), s = Math.sin(cart.heading), wood = WOOD[design.wood], cloth = CLOTH[design.cloth];
  const p = (x, y, z = 0) => ({ x: Math.round(cart.worldX + c * x - s * y - camera.x),
    y: Math.round(cart.worldY + s * x + c * y - camera.y - z - elevation) });
  const hasCanopy = design.canopy !== 'none';
  ctx.save(); ctx.lineJoin = 'round';
  polygon(ctx, [p(-d.halfLength - 8, -d.halfWidth - 7), p(d.animalOffset + 19, -13),
    p(d.animalOffset + 19, 15), p(-d.halfLength - 8, d.halfWidth + 9)], 'rgba(18,30,22,.2)', null);
  const parts = [];
  // The bed/seat supports its occupants at every heading. Ground depth alone can put
  // that floor over the rider or canopy when the front of the cart points away.
  // Sort the undercarriage first, then the above-bed parts relative to one another.
  const add = (x, y, draw, aboveBed = false) => parts.push({ depth: s * x + c * y, aboveBed, draw });
  for (const y of [-8, 8]) add((d.halfLength + d.animalOffset) / 2, y, () => {
    line(ctx, p(d.halfLength - 4, y, 11), p(d.animalOffset, y, 15), wood[2], 4);
    line(ctx, p(d.halfLength - 4, y, 12), p(d.animalOffset, y, 16), wood[3], 1);
  });
  for (const x of [-d.halfLength + 8, d.halfLength - 8]) for (const y of [-d.halfWidth - 1, d.halfWidth + 1]) add(x, y, () => {
    const wheelP = (angle, r = 9) => p(x + Math.cos(angle) * r, y, 10 + Math.sin(angle) * r);
    polygon(ctx, Array.from({ length: 16 }, (_, i) => wheelP(i * Math.PI / 8)), design.wheels === 'solid' ? wood[1] : '#514738', '#383a30');
    for (let spoke = 0; spoke < 6; spoke++) line(ctx, p(x, y, 10), wheelP(motion.wheel + spoke * Math.PI / 3, 8), wood[3], design.wheels === 'solid' ? 1 : 2);
    polygon(ctx, Array.from({ length: 16 }, (_, i) => wheelP(i * Math.PI / 8)), 'transparent', design.wheels === 'solid' ? '#9a9c8c' : wood[2]);
    const hub = p(x, y, 10); ctx.fillStyle = '#d7ba78'; ctx.fillRect(hub.x - 2, hub.y - 2, 4, 4);
  });
  add(0, 0, () => {
    box(ctx, p, 0, 0, d.halfLength, d.halfWidth, 5, wood, 10);
    for (let x = -d.halfLength + 5; x < d.halfLength; x += 7) line(ctx, p(x, -d.halfWidth, 16), p(x, d.halfWidth, 16), wood[2], 1);
    box(ctx, p, d.halfLength - 7, 0, 5, d.halfWidth - 2, 4, wood, 22);
  });
  for (const y of [-d.halfWidth, d.halfWidth]) add(0, y, () => {
    const height = design.body === 'boards' ? 15 : 6;
    if (design.body === 'boards') {
      polygon(ctx, [p(-d.halfLength, y, 14), p(d.halfLength, y, 14), p(d.halfLength, y, 14 + height), p(-d.halfLength, y, 14 + height)], wood[1]);
      for (const z of [19, 24]) line(ctx, p(-d.halfLength, y, z), p(d.halfLength, y, z + 1), wood[2], 1);
    }
    for (const x of [-d.halfLength + 2, d.halfLength - 2]) line(ctx, p(x, y, 12), p(x, y, 30), wood[2], 3);
    line(ctx, p(-d.halfLength, y, 29), p(d.halfLength, y, 29), wood[3], 3);
    if (!hasCanopy) {
      if (design.supports === 'bows') {
        line(ctx, p(-d.halfLength + 3, y, 16), p(0, y, 24), wood[2], 2);
        line(ctx, p(0, y, 24), p(d.halfLength - 3, y, 16), wood[2], 2);
      } else line(ctx, p(0, y, 14), p(0, y, 29), wood[2], 3);
    }
  }, true);
  if (mounted) add(d.halfLength - 4, 0, () => {
    const seat = p(d.halfLength - 4, 0, 27);
    // Use the ordinary avatar at 1:1 scale. Clip its standing legs below the seat and add bent legs.
    for (const side of [-4, 4]) {
      line(ctx, p(d.halfLength - 4, side, 26), p(d.halfLength + 4, side, 22), '#303139', 4);
      line(ctx, p(d.halfLength + 4, side, 22), p(d.halfLength + 5, side, 15), '#303139', 4);
      line(ctx, p(d.halfLength + 4, side, 15), p(d.halfLength + 8, side, 15), '#a63f38', 3);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(seat.x - 25, seat.y - 45, 50, 46); ctx.clip();
    paintForestHumanoid(ctx, seat.x, seat.y + 10, { resting: true,
      motion: { facingRadians: cart.heading, speed: 0, stepPhase: 0 } }); ctx.restore();
    for (const side of [-6, 6]) line(ctx, p(d.halfLength, side, 28), p(d.animalOffset + 8, side, 26), '#695b3f', 1);
  }, true);
  if (hasCanopy) add(-8, 0, () => {
    const front = d.halfLength - 13, rear = -d.halfLength + 1;
    for (const x of [rear, front]) {
      for (const y of [-d.halfWidth, d.halfWidth]) line(ctx, p(x, y, 26), p(x, y, 50), wood[2], 3);
      if (design.supports === 'bows') {
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 8, b = a + Math.PI / 8;
          line(ctx, p(x, Math.sin(a) * d.halfWidth, 50 + Math.cos(a) * 13),
            p(x, Math.sin(b) * d.halfWidth, 50 + Math.cos(b) * 13), wood[3], 2);
        }
      } else line(ctx, p(x, -d.halfWidth, 51), p(x, d.halfWidth, 51), wood[3], 3);
    }
    const lift = t => design.supports === 'bows' ? Math.sin(t * Math.PI) * 13 : (1 - Math.abs(t * 2 - 1)) * 4;
    for (let i = 0; i < 6; i++) {
      const a = i / 6, b = (i + 1) / 6;
      const ya = -d.halfWidth - 3 + (2 * d.halfWidth + 6) * a, yb = -d.halfWidth - 3 + (2 * d.halfWidth + 6) * b;
      polygon(ctx, [p(rear - 3, ya, 50 + lift(a)), p(front + 2, ya, 50 + lift(a)),
        p(front + 2, yb, 50 + lift(b)), p(rear - 3, yb, 50 + lift(b))], cloth[i < 3 ? 0 : 1], cloth[1]);
      if (design.canopy === 'patched' && i % 2 === 0) {
        polygon(ctx, [p(rear + 2, ya + 1, 51 + lift(a)), p(rear + 10, ya + 1, 51 + lift(a)),
          p(rear + 10, yb - 1, 51 + lift(b)), p(rear + 2, yb - 1, 51 + lift(b))], cloth[2], '#bda87e');
      }
    }
  }, true);
  // A jointed, distance-driven diagonal gait keeps the mule's feet tied to travel.
  add(d.animalOffset, 0, () => {
    const legs = [];
    for (const x of [-9, 8]) for (const y of [-5, 5]) legs.push({ x, y });
    legs.sort((a, b) => s * (a.x - b.x) + c * (a.y - b.y));
    for (const { x, y } of legs) {
      const phase = motion.gait + (x * y < 0 ? Math.PI : 0);
      const stride = motion.walking ? Math.sin(phase) * 6 : 0;
      const lift = motion.walking ? Math.max(0, Math.cos(phase)) * 4 : 0;
      const hip = p(d.animalOffset + x, y, 18), knee = p(d.animalOffset + x - stride * .3, y, 9);
      const foot = p(d.animalOffset + x + stride, y, 2 + lift);
      line(ctx, hip, knee, '#686756', 4); line(ctx, knee, foot, '#8d8871', 3);
      ctx.fillStyle = '#494b40'; ctx.fillRect(foot.x - 2, foot.y - 1, 5, 3);
    }
    box(ctx, p, d.animalOffset - 1, 0, 13, 7, 12, ['#afa58a', '#938e76', '#716f5d'], 16);
    for (let x = -9; x < 9; x += 5) line(ctx, p(d.animalOffset + x, -2, 29), p(d.animalOffset + x + 3, -2, 28), '#c6ba9a', 2);
    box(ctx, p, d.animalOffset + 11, 0, 5, 5, 14, ['#bcb095', '#9d957d', '#787c68'], 23);
    box(ctx, p, d.animalOffset + 16, 0, 5, 4, 6, ['#d6c5a5', '#b6a78d', '#948a72'], 24);
    for (const y of [-3, 3]) {
      line(ctx, p(d.animalOffset + 10, y, 36), p(d.animalOffset + 6, y, 48), '#615f4e', 4);
      line(ctx, p(d.animalOffset + 10, y, 37), p(d.animalOffset + 7, y, 46), '#c3a88b', 1);
      const eye = p(d.animalOffset + 13, y * 1.8, 34); ctx.fillStyle = '#343d33'; ctx.fillRect(eye.x, eye.y, 2, 2);
    }
    line(ctx, p(d.animalOffset - 13, 0, 26), p(d.animalOffset - 20, 0, 10), '#514f40', 3);
    line(ctx, p(d.animalOffset - 4, -8, 28), p(d.animalOffset - 4, 8, 28), '#765235', 3);
    line(ctx, p(d.animalOffset + 15, -5, 29), p(d.animalOffset + 15, 5, 29), '#765235', 2);
  }, true);
  parts.sort((a, b) => Number(a.aboveBed) - Number(b.aboveBed) || a.depth - b.depth)
    .forEach(part => part.draw());
  ctx.restore();
}

export function paintStudyDestination(ctx, destination, camera) {
  const p = (x, y, z = 0) => ({ x: destination.x + x - camera.x, y: destination.y + y - z - camera.y });
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const x = -60 + i * 14, y = -50 - (i % 3) * 9;
    line(ctx, p(x, y), p(x + 3, y, 22 + i % 4 * 3), '#c8aa61', 3);
    line(ctx, p(x + 3, y, 22), p(x + 10, y, 27), '#dfc881', 4);
  }
  box(ctx, p, -63, -35, 20, 15, 27, ['#a5ac9a', '#858c7d', '#656e64']);
  box(ctx, p, 63, -35, 18, 16, 32, ['#b7baa2', '#909883', '#6b7666']);
  box(ctx, p, 0, -45, 36, 10, 9, ['#ba9668', '#8c704c', '#70573c'], 13);
  ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2edce';
  ctx.fillText('Amber clearing', p(0, -65).x, p(0, -65).y);
  ctx.restore();
}

export function paintStudyPaths(ctx, plan, camera) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [path, width, color] of [[plan.approach, 10, 'rgba(191,180,134,.25)'],
    [plan.route, 28, 'rgba(191,180,134,.28)']]) {
    ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(p.x - camera.x, p.y - camera.y)
      : ctx.moveTo(p.x - camera.x, p.y - camera.y));
    ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
    ctx.setLineDash([2, 20]); ctx.lineWidth = 3; ctx.strokeStyle = '#b1ad87'; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

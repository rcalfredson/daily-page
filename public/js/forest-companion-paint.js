// Shared mule presentation; caller supplies the projection at the animal's center.
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

// The eyes belong to the two beveled front cheeks. Paint only camera-facing cheeks,
// so a far eye cannot show through the head or float outside its silhouette.
function paintHead(ctx, project, heading) {
  const corners = [[6, -5], [12, -5], [16, -1], [16, 1], [12, 5], [6, 5]];
  const faces = corners.map(([x, y], i) => {
    const [nextX, nextY] = corners[(i + 1) % corners.length];
    return { x, y, nextX, nextY, eye: i === 1 || i === 3,
      visible: Math.sin(heading) * (nextY - y) - Math.cos(heading) * (nextX - x) > .001,
      depth: (project(x, y, 23).y + project(nextX, nextY, 23).y) / 2 };
  });
  for (const face of faces.filter(f => f.visible).sort((a, b) => a.depth - b.depth)) {
    const { x, y, nextX, nextY } = face;
    polygon(ctx, [project(x, y, 23), project(nextX, nextY, 23), project(nextX, nextY, 37), project(x, y, 37)],
      face.eye ? '#9d957d' : '#787c68');
    if (face.eye) {
      const eye = (t, z) => project(x + (nextX - x) * t, y + (nextY - y) * t, z);
      const center = eye(.5, 34.5), a = eye(0, 34.5), b = eye(1, 34.5);
      // A small upright oval reads as an animal eye rather than a wide cheek stripe.
      // Keep a little width at oblique angles so the near eye remains readable.
      const radius = Math.max(.9, Math.min(1.05, Math.abs(b.x - a.x) * .2));
      ctx.beginPath(); ctx.ellipse(center.x + .5, center.y + .5, radius, 1.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#343d33'; ctx.fill();
    }
  }
  polygon(ctx, corners.map(([x, y]) => project(x, y, 37)), '#bcb095');
}

export function paintForestCompanion(ctx, p, heading, motion = {}) {
  const c = Math.cos(heading), s = Math.sin(heading);
  const look = motion.look || 0, turn = Math.cos(look), side = Math.sin(look);
  const lower = motion.resting ? -5 : 0;
  const nuzzle = motion.greeting || 0;
  const head = (x, y, z) => p(8 + (x - 8) * turn - y * side + nuzzle * 2,
    (x - 8) * side + y * turn, z + lower - nuzzle * 2);
  ctx.save(); ctx.lineJoin = 'round';
  const legs = [];
  for (const x of [-9, 8]) for (const y of [-5, 5]) legs.push({ x, y });
  legs.sort((a, b) => s * (a.x - b.x) + c * (a.y - b.y));
  for (const { x, y } of legs) {
    const phase = motion.gait + (x * y < 0 ? Math.PI : 0);
    const stride = motion.walking ? Math.sin(phase) * 6 : 0;
    const lift = motion.walking ? Math.max(0, Math.cos(phase)) * 4 : 0;
    const hip = p(x, y, 18), knee = p(x - stride * .3, y, 9);
    const foot = p(x + stride, y, 2 + lift);
    line(ctx, hip, knee, '#686756', 4); line(ctx, knee, foot, '#8d8871', 3);
    ctx.fillStyle = '#494b40'; ctx.fillRect(foot.x - 2, foot.y - 1, 5, 3);
  }
  box(ctx, p, -1, 0, 13, 7, 12, ['#afa58a', '#938e76', '#716f5d'], 16);
  for (let x = -9; x < 9; x += 5) line(ctx, p(x, -2, 29), p(x + 3, -2, 28), '#c6ba9a', 2);
  const headHeading = heading + look;
  const muzzle = () => {
    box(ctx, head, 19, 0, 3, 4, 6, ['#d6c5a5', '#b6a78d', '#948a72'], 24);
    if (Math.sin(headHeading) > 0) line(ctx, head(22, -4, 27), head(22, 4, 27), '#765235', 2);
  };
  if (Math.sin(headHeading) < 0) muzzle();
  paintHead(ctx, head, headHeading);
  if (Math.sin(headHeading) >= 0) muzzle();
  for (const y of [-3, 3]) {
    const ear = motion.attentive ? 11 : 6;
    line(ctx, head(10, y, 36), head(ear, y, 48), '#615f4e', 4);
    line(ctx, head(10, y, 37), head(ear + 1, y, 46), '#c3a88b', 1);
  }
  line(ctx, p(-13, 0, 26), p(-20, 0, 10), '#514f40', 3);
  line(ctx, p(-4, -8, 28), p(-4, 8, 28), '#765235', 3);
  ctx.restore();
}

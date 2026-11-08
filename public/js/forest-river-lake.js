// Pure river/lake construction shared by the accepted study and generation 4.
export function riverLakeHash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
const snap = n => Math.round(n / 2) * 2 || 0;
function ribbon(points, widths) {
  const sides = [-1, 1].map(side => points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: snap(p.x + side * widths[i] * (b.y - a.y) / length),
      y: snap(p.y - side * widths[i] * (b.x - a.x) / length) };
  }));
  return [...sides[0], ...sides[1].reverse()];
}
function curve(a, b, c, d) {
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, u = 1 - t;
    return { x: snap(a.x * u ** 3 + 3 * b.x * u ** 2 * t + 3 * c.x * u * t ** 2 + d.x * t ** 3),
      y: snap(a.y * u ** 3 + 3 * b.y * u ** 2 * t + 3 * c.y * u * t ** 2 + d.y * t ** 3) };
  });
}
export function buildRiverLakeLayout(seed, options = {}) {
  if (typeof seed !== 'string' || !seed.length || seed.length > 80) throw new Error('Invalid study seed.');
  const phase = riverLakeHash(seed) * Math.PI * 2;
  const center = y => (230 * (options.bends || 1)) * Math.sin(y / 940 + phase) + (105 * (options.bends || 1)) * Math.sin(y / 460 + phase * 0.7);
  const mouthX = center(0);
  const points = Array.from({ length: 161 }, (_, i) => {
    const y = 640 - (options.riverSpan || 10240) + i * (options.riverSpan || 10240) / 160;
    return { x: snap(center(y) - mouthX), y };
  });
  const widths = points.map(p => (49 + 17 * (1 + Math.sin(p.y / 1600 + phase))
    + Math.max(0, (p.y + 650) / 1290) ** 2 * 125)
    * (options.width || 1) * Math.min(1, 0.1 + (p.y - points[0].y) / 500));
  const main = ribbon(points, widths);
  // A single tributary joins at an acute downstream angle; its source is far from the junction.
  const joinIndex = options.joinIndex || 58, join = points[joinIndex];
  const feederPoints = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    const u = 1 - t;
    return { x: snap(join.x + (1800 * u ** 3 + 3 * 1000 * u ** 2 * t + 3 * 100 * u * t ** 2) * (options.tributary || 1)),
      y: snap(join.y - (1250 * u ** 3 + 3 * 850 * u ** 2 * t + 3 * 400 * u * t ** 2) * (options.tributary || 1)) };
  });
  const feeder = ribbon(feederPoints, feederPoints.map((_, i) => 7 + i * 0.7));
  const basin = Array.from({ length: 160 }, (_, i) => {
    const angle = i * Math.PI * 2 / 160;
    const r = 1 + Math.sin(angle * 3 + phase) * 0.065 + Math.sin(angle * 5 - phase) * 0.025;
    return { x: snap(260 + Math.cos(angle) * (options.lakeX || 1500) * r),
      y: snap((options.lakeY || 1100) + 140 + Math.sin(angle) * (options.lakeY || 1100) * r) };
  });
  // A long bay replaces the basin's northern arc. Shore tangents turn gradually from river
  // banks into the lake shoulders, instead of joining a narrow ribbon to an ellipse at a T.
  const neckIndex = 142;
  const westNeck = main[neckIndex], eastNeck = main[main.length - 1 - neckIndex];
  const downControl = (p, next) => {
    const length = Math.hypot(next.x - p.x, next.y - p.y);
    return { x: p.x + (next.x - p.x) / length * 280, y: p.y + (next.y - p.y) / length * 280 };
  };
  const westBay = curve(basin[104], { x: basin[104].x + 390, y: basin[104].y - 290 },
    downControl(westNeck, main[neckIndex + 1]), westNeck);
  const eastBay = curve(eastNeck, downControl(eastNeck, main[main.length - 2 - neckIndex]),
    { x: basin[136].x - 390, y: basin[136].y - 290 }, basin[136]);
  const lake = [...basin.slice(0, 105), ...westBay.slice(1), eastNeck, ...eastBay.slice(1), ...basin.slice(137)];
  const bridgeIndex = 100, crossing = points[bridgeIndex];
  const before = points[bridgeIndex - 1], after = points[bridgeIndex + 1];
  const bridge = { id: `${(options.id || 'river-lake-study-1')}:${seed}:bridge`, worldX: crossing.x, worldY: crossing.y,
    angleMilliradians: Math.atan2(-(after.x - before.x), after.y - before.y) * 1000,
    halfLength: widths[bridgeIndex] + 42, halfWidth: 24, maximumElevationPixels: 16,
    definitionId: 'rustic-timber-arch' };
  const source = { ...points[0], outline: Array.from({ length: 16 }, (_, i) => ({
    x: snap(points[0].x + Math.cos(i * Math.PI / 8) * 18),
    y: snap(points[0].y + Math.sin(i * Math.PI / 8) * 12)
  })) };
  const scene = { id: (options.id || 'river-lake-study-1'), seed, points, widths, feederPoints, bridge, source,
    channels: [{ id: `${options.id || seed}:main`, points, radii: widths, outline: main },
      { id: `${options.id || seed}:tributary`, points: feederPoints, radii: feederPoints.map((_, i) => 7 + i * 0.7), outline: feeder }],
    polygons: [main, feeder, lake, source.outline], rocks: [], lake };
  return { ...scene, westBay, neckIndex, main };
}

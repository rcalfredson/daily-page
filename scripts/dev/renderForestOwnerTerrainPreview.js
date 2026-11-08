import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { queryTerrainProof, sampleTerrainProof } from '../../public/js/owner-forest-terrain.js';
import { sampleOwnerForestGroundPresentation } from '../../public/js/owner-forest-environment.js';

export function terrainProofRecords(kind) {
  const entrance = { id: 'entrance', x: 0, y: 0, radius: 80 };
  const count = kind === 'dense' ? 81 : 12;
  return [entrance, ...Array.from({ length: count }, (_, i) => {
    const x = kind === 'dense' ? ((i % 9) - 4) * 180
      : kind === 'spread' ? ((i % 4) - 1.5) * 1500 : ((i % 4) - 1.5) * 150;
    const y = kind === 'dense' ? (Math.floor(i / 9) - 4) * 180
      : kind === 'spread' ? (Math.floor(i / 4) - 1) * 1900 : (Math.floor(i / 4) - 1) * 180;
    return { id: `place-${i}`, x, y, radius: 55 };
  })];
}

function waterSvg(stream, bridge, x, y, scale, labels = false) {
  const outline = polygon => polygon.map(p => `${x(p.x)},${y(p.y)}`).join(' ');
  const banks = stream.waterPolygons.map(polygon => `<polygon points="${outline(polygon)}" fill="#8d9470" stroke="#8d9470" stroke-width="${stream.bankMargin * 2 * scale}" stroke-linejoin="round"/>`).join('');
  const water = stream.waterPolygons.map(polygon => `<polygon points="${outline(polygon)}" fill="#498d9c"/>`).join('');
  const b = bridge;
  const deck = `<line x1="${x(b.x - b.ux * b.halfLength)}" y1="${y(b.y - b.uy * b.halfLength)}" x2="${x(b.x + b.ux * b.halfLength)}" y2="${y(b.y + b.uy * b.halfLength)}" stroke="#d5ad71" stroke-width="${b.halfWidth * 2 * scale}"/>`;
  let annotations = '';
  if (labels) {
    const label = (p, text, dx, dy) => `<path d="M ${x(p.x)} ${y(p.y)} l ${dx} ${dy}" stroke="#f3eedb" fill="none"/><text x="${x(p.x) + dx + 5}" y="${y(p.y) + dy}" font-size="15" fill="#fff8dc">${text}</text>`;
    annotations += label(stream.source, 'Spring / seep', -145, -40);
    annotations += label(stream.channels[1].points[0], 'Small headwater creeks', 35, -10);
    annotations += label(stream.outlet, 'Receiving pond', 45, 55);
    annotations += label(b, 'Generated crossing', 45, -25);
    for (const i of [9, 12]) {
      const p = stream.points[i];
      const next = stream.points[i + 1];
      const angle = Math.atan2(next.y - p.y, next.x - p.x) * 180 / Math.PI;
      annotations += `<path d="M -12 -4 L 0 0 L -12 4" transform="translate(${x(p.x)},${y(p.y)}) rotate(${angle})" stroke="#c0e4df" stroke-width="2" fill="none"/>`;
    }
  }
  return banks + water + deck + annotations;
}

export function buildForestOwnerTerrainPreviewSvg() {
  const panels = [];
  for (const [seedIndex, seed] of ['terrain-proof-a', 'terrain-proof-b'].entries()) {
    for (const [kindIndex, kind] of ['compact', 'dense', 'spread'].entries()) {
      const bounds = { minX: -2880, minY: -2880, maxX: 2880, maxY: 2880 };
      const scene = queryTerrainProof({ seed, bounds, records: terrainProofRecords(kind) });
      const scale = 0.1;
      const x = n => 20 + (n + 2880) * scale;
      const y = n => 65 + (n + 2880) * scale;
      const shapes = [];
      for (let py = -2880; py < 2880; py += 96) {
        for (let px = -2880; px < 2880; px += 96) {
          const { color } = sampleOwnerForestGroundPresentation({ worldSeed: seed, worldX: px, worldY: py });
          shapes.push(`<rect x="${x(px)}" y="${y(py)}" width="9.7" height="9.7" fill="rgb(${color.red},${color.green},${color.blue})"/>`);
        }
      }
      let streams = 0;
      let rocks = 0;
      for (const area of scene.districts) {
        if (area.stream) {
          streams += 1;
          shapes.push(waterSvg(area.stream, area.bridge, x, y, scale));
        }
        for (const rock of area.boulders) {
          rocks += 1;
          shapes.push(`<circle cx="${x(rock.x)}" cy="${y(rock.y)}" r="${rock.radius * scale}" fill="#999782" stroke="#545c50"/>`);
        }
      }
      // Dashed access reservations are diagnostics, not rendered roads.
      for (const p of scene.protections) {
        shapes.push(`<line x1="${x(p.x)}" y1="${y(p.y)}" x2="${x(p.accessEnd.x)}" y2="${y(p.accessEnd.y)}" stroke="#f4dc99" stroke-width="1" stroke-dasharray="3 3" opacity=".65"/>`);
        shapes.push(`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${p.radius * scale}" fill="none" stroke="#f4dc99" stroke-width="1"/>`);
        shapes.push(`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="2" fill="#173a29"/>`);
      }
      const safe = scene.protections.every(p => {
        const steps = Math.ceil(Math.hypot(p.x - p.accessEnd.x, p.y - p.accessEnd.y) / 8);
        return Array.from({ length: steps + 1 }, (_, i) => sampleTerrainProof(scene, {
          x: p.x + (p.accessEnd.x - p.x) * i / Math.max(1, steps),
          y: p.y + (p.accessEnd.y - p.y) * i / Math.max(1, steps)
        }).walkable).every(Boolean);
      });
      panels.push(`<g transform="translate(${kindIndex * 620},${seedIndex * 680 + 95})"><text x="20" y="23" font-size="20">${kind} · ${seed}</text><text x="20" y="45" font-size="13">${scene.protections.length} places · ${streams} crossings · ${rocks} rocks · terrain clearance ${safe ? 'PASS' : 'FAIL'}</text><svg x="20" y="65" width="576" height="576" viewBox="20 65 576 576">${shapes.join('')}</svg></g>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1860" height="1460" viewBox="0 0 1860 1460"><rect width="100%" height="100%" fill="#efe9d9"/><g font-family="sans-serif" fill="#293c33"><text x="20" y="34" font-size="25">Live terrain geometry proof · development only</text><text x="20" y="60" font-size="16">Blue: spring-fed creeks and receiving ponds · tan bars: bridges · gray dots: boulders · gold rings: protected places.</text><text x="20" y="82" font-size="14">Gold dashed lines: reserved access, not roads. Each panel spans −2880 to +2880. Schematic geometry, not final rendering.</text>${panels.join('')}</g></svg>`;
}

export function buildForestOwnerTerrainWaterDetailSvg() {
  const seed = 'terrain-proof-a';
  const scene = queryTerrainProof({ seed, bounds: { minX: -1920, minY: -1920, maxX: 1919, maxY: 1919 },
    records: terrainProofRecords('spread') });
  const area = scene.districts.filter(d => d.stream).sort((a, b) =>
    Math.hypot(a.bridge.x, a.bridge.y) - Math.hypot(b.bridge.x, b.bridge.y))[0];
  const scale = 820 / 1920;
  const x = n => 40 + (n - area.column * 1920) * scale;
  const y = n => 85 + (n - area.row * 1920) * scale;
  const shapes = [];
  for (let py = area.row * 1920; py < (area.row + 1) * 1920; py += 48) {
    for (let px = area.column * 1920; px < (area.column + 1) * 1920; px += 48) {
      const { color } = sampleOwnerForestGroundPresentation({ worldSeed: seed, worldX: px, worldY: py });
      shapes.push(`<rect x="${x(px)}" y="${y(py)}" width="${48 * scale + 0.2}" height="${48 * scale + 0.2}" fill="rgb(${color.red},${color.green},${color.blue})"/>`);
    }
  }
  for (const rock of area.boulders) {
    shapes.push(`<circle cx="${x(rock.x)}" cy="${y(rock.y)}" r="${rock.radius * scale}" fill="#999782" stroke="#545c50"/>`);
  }
  shapes.push(waterSvg(area.stream, area.bridge, x, y, scale, true));
  for (const p of scene.protections.filter(p => Math.floor(p.x / 1920) === area.column
    && Math.floor(p.y / 1920) === area.row)) {
    shapes.push(`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${p.radius * scale}" fill="none" stroke="#f4dc99" stroke-dasharray="4 3"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="965"><rect width="100%" height="100%" fill="#efe9d9"/><g font-family="sans-serif"><text x="40" y="32" font-size="23" fill="#293c33">Headwaters → stream → receiving pond</text><text x="40" y="58" font-size="15">${seed} · signed district (${area.column}, ${area.row}) · schematic geometry</text>${shapes.join('')}<text x="40" y="937" font-size="14">Flow arrows show intended channel direction; this proof does not simulate elevation or drainage.</text></g></svg>`;
}

export function buildForestOwnerTerrainWaterVariationSvg() {
  const systems = ['terrain-proof-a', 'terrain-proof-b'].flatMap(seed => {
    const scene = queryTerrainProof({ seed,
      bounds: { minX: -2880, minY: -2880, maxX: 2880, maxY: 2880 },
      records: terrainProofRecords('spread') });
    return scene.districts.filter(area => area.stream).map(area => {
      const points = area.stream.points;
      const length = points.slice(1).reduce((total, p, i) =>
        total + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
      const pondArea = area.stream.outlet.radiusX * area.stream.outlet.radiusY;
      return { seed, area, length, pondArea };
    });
  });
  const byLength = [...systems].sort((a, b) => a.length - b.length);
  const byPond = [...systems].sort((a, b) => a.pondArea - b.pondArea);
  const examples = [
    ['Shorter stream', byLength[0]], ['Longer stream', byLength.at(-1)],
    ['Smaller receiving pond', byPond[0]], ['Larger receiving pond', byPond.at(-1)]
  ];
  const panels = examples.map(([label, { seed, area, length }], i) => {
    const scale = 560 / 1920;
    const x = n => 20 + (n - area.column * 1920) * scale;
    const y = n => 75 + (n - area.row * 1920) * scale;
    const ground = [];
    for (let py = area.row * 1920; py < (area.row + 1) * 1920; py += 96) {
      for (let px = area.column * 1920; px < (area.column + 1) * 1920; px += 96) {
        const { color } = sampleOwnerForestGroundPresentation({ worldSeed: seed, worldX: px, worldY: py });
        ground.push(`<rect x="${x(px)}" y="${y(py)}" width="28.2" height="28.2" fill="rgb(${color.red},${color.green},${color.blue})"/>`);
      }
    }
    const pond = area.stream.outlet;
    return `<g transform="translate(${(i % 2) * 600},${Math.floor(i / 2) * 660 + 75})"><text x="20" y="25" font-size="21">${label}</text><text x="20" y="49" font-size="14">Channel ${Math.round(length)} units · pond axes ${Math.round(pond.radiusX * 2)} × ${Math.round(pond.radiusY * 2)}</text>${ground.join('')}${waterSvg(area.stream, area.bridge, x, y, scale)}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1400"><rect width="100%" height="100%" fill="#efe9d9"/><g font-family="sans-serif" fill="#293c33"><text x="20" y="32" font-size="26">Water variation · all four panels at the same scale</text><text x="20" y="58" font-size="15">Examples selected from the two overview seeds, with established-place protections applied.</text>${panels.join('')}</g></svg>`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2] || 'tmp/forest-owner-terrain-preview.svg');
  await fs.mkdir(path.dirname(output), { recursive: true });
  const parsed = path.parse(output);
  for (const [target, svg] of [[output, buildForestOwnerTerrainPreviewSvg()],
    [path.join(parsed.dir, `${parsed.name}-water-detail.svg`), buildForestOwnerTerrainWaterDetailSvg()],
    [path.join(parsed.dir, `${parsed.name}-water-variation.svg`), buildForestOwnerTerrainWaterVariationSvg()]]) {
    await fs.writeFile(target, svg);
    await sharp(Buffer.from(svg)).png().toFile(target.replace(/\.svg$/u, '') + '.png');
    console.log(`Wrote ${target} and PNG preview.`);
  }
}

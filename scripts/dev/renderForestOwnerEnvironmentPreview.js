import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import sharp from 'sharp';

import {
  buildForestOwnerEnvironmentPlacementExclusion,
  resolveForestOwnerEnvironment,
} from '../../server/services/forestOwnerEnvironmentResolver.js';
import {
  allocateForestOwnerGrovePlacements,
} from '../../server/services/forestOwnerGrovePlacement.js';

const PREVIEW_SEEDS = Object.freeze([
  'owner-environment-visual-a',
  'owner-environment-visual-b',
]);
const TREE_COUNT = 600;
const GRID_SIZE = 40;
const PANEL_SIZE = 620;
const PLOT_SIZE = 520;
const PAGE_PADDING = 34;
const PANEL_GAP = 24;

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function mix(left, right, amount) {
  return Math.round(left + ((right - left) * amount));
}

function environmentColor(rockinessPermille) {
  const amount = rockinessPermille / 1_000;
  const grove = [170, 188, 126];
  const rocky = [137, 132, 106];
  return `rgb(${grove.map((value, index) => (
    mix(value, rocky[index], amount)
  )).join(',')})`;
}

function previewFixture(worldSeed) {
  const isExcluded = buildForestOwnerEnvironmentPlacementExclusion({
    worldSeed,
  });
  const allocation = allocateForestOwnerGrovePlacements({
    worldSeed,
    count: TREE_COUNT,
    isExcluded,
  });
  const maximumRadius = Math.max(...allocation.placements.map(placement => (
    Math.hypot(placement.worldX, placement.worldY)
  )));
  const extent = Math.ceil((maximumRadius + 240) / 200) * 200;
  const placements = allocation.placements.map((placement) => {
    const environment = resolveForestOwnerEnvironment({
      worldSeed,
      worldX: placement.worldX,
      worldY: placement.worldY,
    });
    return {
      ...placement,
      regionId: environment.originatingEnvironment.regionId,
    };
  });

  return {
    worldSeed,
    extent,
    placements,
    exclusionRejectionCount: allocation.diagnostics.exclusionRejectionCount,
    inspectedCandidateCount: allocation.diagnostics.inspectedCandidateCount,
  };
}

function panelSvg(fixture, panelX, panelY) {
  const plotX = panelX + ((PANEL_SIZE - PLOT_SIZE) / 2);
  const plotY = panelY + 82;
  const cellPixels = PLOT_SIZE / GRID_SIZE;
  const worldCell = (fixture.extent * 2) / GRID_SIZE;
  const cells = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const worldX = Math.round(-fixture.extent + ((column + 0.5) * worldCell));
      const worldY = Math.round(-fixture.extent + ((row + 0.5) * worldCell));
      const environment = resolveForestOwnerEnvironment({
        worldSeed: fixture.worldSeed,
        worldX,
        worldY,
      });
      cells.push(
        `<rect x="${(plotX + (column * cellPixels)).toFixed(2)}"`
        + ` y="${(plotY + (row * cellPixels)).toFixed(2)}"`
        + ` width="${(cellPixels + 0.2).toFixed(2)}"`
        + ` height="${(cellPixels + 0.2).toFixed(2)}"`
        + ` fill="${environmentColor(environment.ecology.rockinessPermille)}" />`,
      );
    }
  }
  const scale = PLOT_SIZE / (fixture.extent * 2);
  const trees = fixture.placements.map((placement) => {
    const x = plotX + ((placement.worldX + fixture.extent) * scale);
    const y = plotY + ((placement.worldY + fixture.extent) * scale);
    const fill = placement.regionId === 'rocky-rise' ? '#374239' : '#1d5135';
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.4"`
      + ` fill="${fill}" stroke="#f4f0dc" stroke-width="0.55" />`;
  }).join('\n');
  const rockyTrees = fixture.placements.filter(
    placement => placement.regionId === 'rocky-rise',
  ).length;

  return `
    <g aria-label="${xml(`${fixture.worldSeed} owner environment preview`)}">
      <rect x="${panelX}" y="${panelY}" width="${PANEL_SIZE}" height="${PANEL_SIZE}"
        rx="18" fill="#fbfaf4" stroke="#d4cfbd" stroke-width="2" />
      <text x="${panelX + 30}" y="${panelY + 34}" class="panel-title">
        ${xml(fixture.worldSeed)}
      </text>
      <text x="${panelX + 30}" y="${panelY + 60}" class="panel-stat">
        ${TREE_COUNT} trees · calm ${TREE_COUNT - rockyTrees} · rocky ${rockyTrees}
        · habitat exclusions ${fixture.exclusionRejectionCount}
      </text>
      ${cells.join('\n')}
      <rect x="${plotX}" y="${plotY}" width="${PLOT_SIZE}" height="${PLOT_SIZE}"
        fill="none" stroke="#777365" stroke-width="1" />
      <line x1="${plotX}" y1="${plotY + (PLOT_SIZE / 2)}"
        x2="${plotX + PLOT_SIZE}" y2="${plotY + (PLOT_SIZE / 2)}" class="axis" />
      <line x1="${plotX + (PLOT_SIZE / 2)}" y1="${plotY}"
        x2="${plotX + (PLOT_SIZE / 2)}" y2="${plotY + PLOT_SIZE}" class="axis" />
      ${trees}
    </g>`;
}

export function buildForestOwnerEnvironmentPreviewSvg({
  seeds = PREVIEW_SEEDS,
} = {}) {
  const fixtures = seeds.map(previewFixture);
  const width = (PAGE_PADDING * 2)
    + (PANEL_SIZE * fixtures.length)
    + (PANEL_GAP * (fixtures.length - 1));
  const contentTop = 132;
  const height = contentTop + PANEL_SIZE + 76;
  const panels = fixtures.map((fixture, index) => panelSvg(
    fixture,
    PAGE_PADDING + (index * (PANEL_SIZE + PANEL_GAP)),
    contentTop,
  )).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
  viewBox="0 0 ${width} ${height}" role="img"
  aria-labelledby="preview-title preview-description">
  <title id="preview-title">Activity Forest owner environment version 1</title>
  <desc id="preview-description">
    Signed-coordinate habitat patches and 600 environment-filtered trees for two owner-world seeds.
  </desc>
  <style>
    text { font-family: "Be Vietnam Pro", Inter, system-ui, sans-serif; fill: #24372d; }
    .page-title { font-size: 30px; font-weight: 700; }
    .page-subtitle { font-size: 16px; fill: #607066; }
    .panel-title { font-size: 19px; font-weight: 700; }
    .panel-stat { font-size: 12px; fill: #485a50; }
    .legend { font-size: 13px; fill: #485a50; }
    .axis { stroke: #625f54; stroke-width: 0.7; stroke-dasharray: 3 6; opacity: 0.55; }
  </style>
  <rect width="100%" height="100%" fill="#f1eee2" />
  <text x="${PAGE_PADDING}" y="48" class="page-title">
    Owner environment v1 · signed-coordinate validation
  </text>
  <text x="${PAGE_PADDING}" y="77" class="page-subtitle">
    Smooth seeded habitat patches; tree points include deterministic suitability filtering
  </text>
  <g transform="translate(${PAGE_PADDING}, 105)">
    <rect x="0" y="-12" width="22" height="14" fill="rgb(170,188,126)" />
    <text x="31" y="0" class="legend">calmer grove</text>
    <rect x="151" y="-12" width="22" height="14" fill="rgb(137,132,106)" />
    <text x="182" y="0" class="legend">rockier rise</text>
    <circle cx="318" cy="-5" r="3" fill="#1d5135" stroke="#f4f0dc" />
    <text x="330" y="0" class="legend">accepted writing tree</text>
  </g>
  ${panels}
</svg>`;
}

async function renderPreview(outputPath) {
  const svg = buildForestOwnerEnvironmentPreviewSvg();
  const resolvedSvgPath = path.resolve(outputPath);
  const parsed = path.parse(resolvedSvgPath);
  const pngPath = path.join(parsed.dir, `${parsed.name}.png`);

  await fs.mkdir(parsed.dir, { recursive: true });
  await fs.writeFile(resolvedSvgPath, svg, 'utf8');
  await sharp(Buffer.from(svg)).png().toFile(pngPath);

  console.log(`Wrote ${resolvedSvgPath}`);
  console.log(`Wrote ${pngPath}`);
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const outputPath = process.argv[2]
    || 'tmp/forest-owner-environment-preview.svg';
  await renderPreview(outputPath);
}

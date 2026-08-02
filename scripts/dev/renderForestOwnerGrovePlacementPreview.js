import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import sharp from 'sharp';

import {
  allocateForestOwnerGrovePlacements,
  FOREST_OWNER_GROVE_PLACEMENT_CONFIG,
  inspectForestOwnerGrovePlacementCandidate,
} from '../../server/services/forestOwnerGrovePlacement.js';

const PREVIEW_COUNTS = Object.freeze([25, 100, 600]);
const PREVIEW_SEEDS = Object.freeze([
  'owner-grove-visual-a',
  'owner-grove-visual-b',
]);
const PANEL_WIDTH = 580;
const PANEL_HEIGHT = 590;
const HEADER_HEIGHT = 130;
const FOOTER_HEIGHT = 58;
const PAGE_PADDING = 34;
const PANEL_GAP = 18;
const ROW_GAP = 28;

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function localNeighborCounts(placements) {
  const groupingRadius = FOREST_OWNER_GROVE_PLACEMENT_CONFIG
    .microGroveGroupingRadius;

  return placements.map((placement, index) => placements.reduce(
    (count, candidate, candidateIndex) => (
      index !== candidateIndex && Math.hypot(
        placement.worldX - candidate.worldX,
        placement.worldY - candidate.worldY,
      ) < groupingRadius
        ? count + 1
        : count
    ),
    0,
  ));
}

function describePlacement(worldSeed, placement) {
  const candidate = inspectForestOwnerGrovePlacementCandidate({
    worldSeed,
    placementSlot: placement.placementSlot,
  });

  return { ...placement, densityClass: candidate.candidateClass };
}

function previewFixture(worldSeed, count) {
  const allocation = allocateForestOwnerGrovePlacements({
    worldSeed,
    count,
  });
  const placements = allocation.placements.map(placement => (
    describePlacement(worldSeed, placement)
  ));
  const neighbors = localNeighborCounts(placements);
  const radii = placements.map(({ worldX, worldY }) => (
    Math.hypot(worldX, worldY)
  ));

  return {
    worldSeed,
    count,
    placements,
    nextCandidateSlot: allocation.nextCandidateSlot,
    inspectedCandidateCount: allocation.diagnostics.inspectedCandidateCount,
    maximumRadius: Math.max(...radii),
    groupedTreeCount: neighbors.filter(value => value >= 3).length,
    openTreeCount: placements.filter(({ densityClass }) => densityClass === 'open').length,
    solitaryTreeCount: neighbors.filter(value => value <= 1).length,
    coreTreeCount: placements.filter(({ densityClass }) => densityClass === 'core').length,
    haloTreeCount: placements.filter(({ densityClass }) => densityClass === 'halo').length,
  };
}

function panelSvg(fixture, panelX, panelY) {
  const plotTop = panelY + HEADER_HEIGHT;
  const plotHeight = PANEL_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;
  const centerX = panelX + (PANEL_WIDTH / 2);
  const centerY = plotTop + (plotHeight / 2);
  const extent = fixture.maximumRadius + 220;
  const scale = Math.min(
    (PANEL_WIDTH - 62) / (extent * 2),
    (plotHeight - 34) / (extent * 2),
  );
  const clearingRadius = FOREST_OWNER_GROVE_PLACEMENT_CONFIG
    .centralClearingRadius * scale;
  const treeRadius = Math.max(2.5, Math.min(6.2, 30 * scale));
  const colors = {
    open: '#9cab70',
    halo: '#5f9364',
    core: '#245c3c',
  };
  const trees = fixture.placements.map((placement) => {
    const x = centerX + (placement.worldX * scale);
    const y = centerY + (placement.worldY * scale);

    return [
      `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}"`,
      ` r="${treeRadius.toFixed(2)}" fill="${colors[placement.densityClass]}"`,
      ' stroke="#183d2d" stroke-width="0.65" />',
    ].join('');
  }).join('\n');

  return `
    <g aria-label="${xml(`${fixture.count} tree ${fixture.worldSeed} preview`)}">
      <rect x="${panelX}" y="${panelY}" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}"
        rx="18" fill="#fbfaf4" stroke="#d4cfbd" stroke-width="2" />
      <text x="${panelX + 24}" y="${panelY + 34}" class="panel-title">
        ${fixture.count} writing trees
      </text>
      <text x="${panelX + 24}" y="${panelY + 61}" class="panel-subtitle">
        ${xml(fixture.worldSeed)}
      </text>
      <text x="${panelX + 24}" y="${panelY + 90}" class="panel-stat">
        core ${fixture.coreTreeCount} · halo ${fixture.haloTreeCount} · open ${fixture.openTreeCount}
      </text>
      <text x="${panelX + 24}" y="${panelY + 113}" class="panel-stat">
        locally grouped ${fixture.groupedTreeCount} · solitary ${fixture.solitaryTreeCount}
        · radius ${Math.round(fixture.maximumRadius)}
      </text>
      <line x1="${panelX + 24}" y1="${centerY}" x2="${panelX + PANEL_WIDTH - 24}"
        y2="${centerY}" class="axis" />
      <line x1="${centerX}" y1="${plotTop + 12}" x2="${centerX}"
        y2="${plotTop + plotHeight - 12}" class="axis" />
      <circle cx="${centerX}" cy="${centerY}" r="${clearingRadius.toFixed(2)}"
        fill="#e8d9b5" stroke="#b89c68" stroke-width="1.5" stroke-dasharray="5 5" />
      <circle cx="${centerX}" cy="${centerY}" r="3.2" fill="#8d6b3e" />
      ${trees}
      <text x="${panelX + 24}" y="${panelY + PANEL_HEIGHT - 22}" class="panel-foot">
        accepted through slot ${fixture.nextCandidateSlot - 1};
        checked ${fixture.inspectedCandidateCount} candidates
      </text>
    </g>`;
}

export function buildForestOwnerGrovePlacementPreviewSvg({
  seeds = PREVIEW_SEEDS,
  counts = PREVIEW_COUNTS,
} = {}) {
  const fixtures = seeds.flatMap(worldSeed => counts.map(count => (
    previewFixture(worldSeed, count)
  )));
  const width = (PAGE_PADDING * 2)
    + (PANEL_WIDTH * counts.length)
    + (PANEL_GAP * (counts.length - 1));
  const contentTop = 142;
  const height = contentTop
    + (PANEL_HEIGHT * seeds.length)
    + (ROW_GAP * (seeds.length - 1))
    + 96;
  const panels = fixtures.map((fixture, index) => {
    const column = index % counts.length;
    const row = Math.floor(index / counts.length);

    return panelSvg(
      fixture,
      PAGE_PADDING + (column * (PANEL_WIDTH + PANEL_GAP)),
      contentTop + (row * (PANEL_HEIGHT + ROW_GAP)),
    );
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
  viewBox="0 0 ${width} ${height}" role="img"
  aria-labelledby="preview-title preview-description">
  <title id="preview-title">Activity Forest owner-grove placement version 1</title>
  <desc id="preview-description">
    Deterministic placement previews for 25, 100, and 600 writing trees across two owner-world seeds.
  </desc>
  <style>
    text { font-family: "Be Vietnam Pro", Inter, system-ui, sans-serif; fill: #24372d; }
    .page-title { font-size: 30px; font-weight: 700; }
    .page-subtitle { font-size: 16px; fill: #607066; }
    .panel-title { font-size: 22px; font-weight: 700; }
    .panel-subtitle { font-size: 14px; fill: #69766f; }
    .panel-stat { font-size: 13px; fill: #485a50; }
    .panel-foot { font-size: 12px; fill: #718078; }
    .axis { stroke: #d9d5c7; stroke-width: 1; stroke-dasharray: 3 7; }
    .legend { font-size: 13px; fill: #485a50; }
  </style>
  <rect width="100%" height="100%" fill="#f1eee2" />
  <text id="preview-title-text" x="${PAGE_PADDING}" y="52" class="page-title">
    Owner-grove placement v1 · lightweight visual validation
  </text>
  <text x="${PAGE_PADDING}" y="82" class="page-subtitle">
    Fixed origin, overlapping annular shells, continuous nodes, and blue-noise spacing
  </text>
  <g transform="translate(${PAGE_PADDING}, 108)">
    <circle cx="7" cy="-4" r="6" fill="#245c3c" stroke="#183d2d" />
    <text x="20" y="1" class="legend">micro-grove core</text>
    <circle cx="176" cy="-4" r="6" fill="#5f9364" stroke="#183d2d" />
    <text x="189" y="1" class="legend">halo</text>
    <circle cx="247" cy="-4" r="6" fill="#9cab70" stroke="#183d2d" />
    <text x="260" y="1" class="legend">open-field placement</text>
    <circle cx="435" cy="-4" r="9" fill="#e8d9b5" stroke="#b89c68"
      stroke-dasharray="3 3" />
    <text x="452" y="1" class="legend">reserved central clearing</text>
  </g>
  ${panels}
</svg>`;
}

async function renderPreview(outputPath) {
  const svg = buildForestOwnerGrovePlacementPreviewSvg();
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
    || 'tmp/forest-owner-grove-placement-preview.svg';
  await renderPreview(outputPath);
}

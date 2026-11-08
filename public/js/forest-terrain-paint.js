// Shared pixel treatments used by both the experimental map and the owner forest.
import { projectForestPoint3d } from './forest-projection.js';
import { resolveForestRockPalette } from './forest-environment.js';

export function paintForestTerrainPolygon(context, points, fill) {
  context.beginPath();
  points.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
  context.closePath(); context.fillStyle = fill; context.fill();
}

export function forestStreamFlowVariation(markIndex, lane, salt) {
  const value = Math.sin((markIndex * 91.73) + (lane * 17.19) + (salt * 43.11)) * 43758.5453;
  return value - Math.floor(value);
}

export function paintForestStreamFlowMark(context, { x, y, width, stepDirection,
  pale, leading, trailing, highlight }) {
  context.fillStyle = pale ? '#a1d0bd' : '#79c3bb';
  context.fillRect(x - 2, y + 2, width - 1, 1);
  context.fillRect(x, y, width, 2);
  if (leading && highlight) {
    context.fillStyle = '#c5dfc5';
    context.fillRect(x + 3, y, Math.max(3, width - 5), 1);
  }
  if (trailing) {
    context.fillStyle = '#4ca3a5';
    context.fillRect(x + width, y + stepDirection, 3, 1);
  }
}

export function paintForestStreamBankDetail(context, detail, camera) {
  const from = projectForestPoint3d(detail.from, camera);
  const to = projectForestPoint3d(detail.to, camera);
  const stroke = (color, width, offsetX = 0, offsetY = 0) => {
    context.beginPath();
    context.moveTo(Math.round(from.x + offsetX), Math.round(from.y + offsetY));
    context.lineTo(Math.round(to.x + offsetX), Math.round(to.y + offsetY));
    context.strokeStyle = color;
    context.lineWidth = width;
    context.stroke();
  };
  context.lineCap = detail.role.startsWith('log') || detail.role === 'grass'
    ? 'round' : 'butt';
  if (detail.role === 'lip') {
    stroke(detail.colors[0], detail.width + 2, 0, 1);
    stroke(detail.colors[1], detail.width, 0, -1);
  } else if (detail.role === 'grass') {
    stroke(detail.colors[0], detail.width, 0, 1);
    stroke(detail.colors[1], 1);
    const direction = to.x >= from.x ? 1 : -1;
    stroke(detail.colors[1], 1, -direction * 3, 1);
    stroke(detail.colors[1], 1, direction * 3, 2);
  } else {
    stroke(detail.colors[0], detail.width);
    stroke(detail.colors[1], Math.max(1, Math.floor(detail.width / 3)), 0,
      detail.role === 'undercut' ? -1 : 0);
  }
  context.lineCap = 'butt';
}

export function paintForestStreamBankMark(context, mark, camera) {
  const point = projectForestPoint3d(mark.point, camera);
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  const size = mark.size;
  if (mark.role === 'rock') {
    const half = Math.floor(size / 2);
    const crown = 2 + (mark.variant % 2);
    paintForestTerrainPolygon(context, [
      { x: x - half - 1, y: y + 1 },
      { x: x - half + crown, y: y - Math.floor(size * 0.35) },
      { x: x + half - 1, y: y - Math.floor(size * 0.25) },
      { x: x + half + 1, y: y + 1 },
      { x: x + half - 2, y: y + 3 },
      { x: x - half + 1, y: y + 3 }
    ], mark.colors[0]);
    context.fillStyle = mark.colors[1];
    context.fillRect(x - half + crown - 1, y - Math.floor(size * 0.35),
      Math.max(3, size - crown - 1), Math.max(2, Math.floor(size * 0.35)));
    context.fillStyle = '#bcc3a4';
    context.fillRect(x - half + crown, y - Math.floor(size * 0.35),
      Math.max(2, Math.floor(size * 0.35)), 1);
    if (size > 8) {
      context.fillStyle = '#515b50';
      context.fillRect(x + half - 2, y - 1, 2, 2);
    }
    return;
  }
  context.fillStyle = mark.colors[0];
  context.fillRect(x - Math.floor(size / 2), y, size, 2);
  context.fillStyle = mark.colors[1];
  context.fillRect(x - Math.floor(size / 3), y - 1,
    Math.max(2, Math.floor(size * 0.66)), 1 + (mark.variant % 2));
}

export function paintForestBoulder(context, boulder, camera, waterDepth = 0) {
  const x = Math.round(boulder.worldX - camera.x);
  const y = Math.round(boulder.worldY - camera.y + waterDepth);
  const width = boulder.width;
  const height = boulder.height;
  const left = x - Math.floor(width / 2);
  const palette = resolveForestRockPalette(boulder.rockPaletteId)
    || resolveForestRockPalette('mossed-green');
  context.fillStyle = 'rgba(34, 44, 38, 0.28)';
  context.beginPath();
  context.ellipse(x, y + 1, Math.floor(width * 0.55), Math.max(5, Math.floor(height * 0.2)),
    0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palette.colors.dark;
  context.fillRect(left + 2, y - height + 10, width - 4, height - 10);
  context.fillRect(left + 7, y - height + 5, width - 15, 7);
  context.fillStyle = palette.colors.mid;
  context.fillRect(left + 4, y - height + 8, width - 10, height - 13);
  context.fillRect(left + 10, y - height + 3, width - 21, 8);
  context.fillStyle = palette.colors.light;
  context.fillRect(left + 11, y - height + 4, Math.max(9, width - 25), 5);
  context.fillRect(left + 6, y - height + 10, Math.max(8, Math.floor(width * 0.38)), 4);
  context.fillStyle = palette.colors.dark;
  context.fillRect(left + Math.floor(width * 0.58), y - height + 12, 3, height - 16);
  if (boulder.variantId !== 'low') {
    context.fillRect(left + Math.floor(width * 0.3), y - 8, Math.floor(width * 0.42), 3);
  }
  context.fillStyle = palette.colors.highlight;
  context.fillRect(left + 12, y - height + 4, Math.max(5, Math.floor(width * 0.2)), 2);
  if (boulder.variantId === 'mossy-outcrop') {
    context.fillStyle = palette.colors.accent;
    context.fillRect(left + 5, y - height + 8, 14, 4);
    context.fillRect(left + 9, y - height + 5, 11, 3);
    context.fillStyle = palette.colors.accentLight;
    context.fillRect(left + 11, y - height + 5, 7, 2);
  }
  if (boulder.terrainRole === 'stream-boulder') {
    context.fillStyle = 'rgba(184, 215, 197, 0.56)';
    context.fillRect(left + 3, y - 2, width - 6, 2);
    context.fillStyle = 'rgba(48, 91, 91, 0.48)';
    context.fillRect(left - 3, y + 1, width + 6, 2);
  } else if (boulder.terrainRole === 'bank-boulder') {
    context.fillStyle = 'rgba(52, 82, 66, 0.48)';
    context.fillRect(left + 2, y - 2, width - 4, 2);
    context.fillStyle = 'rgba(113, 143, 112, 0.34)';
    context.fillRect(left + 6, y - 4, Math.max(6, Math.floor(width * 0.38)), 2);
  }
}

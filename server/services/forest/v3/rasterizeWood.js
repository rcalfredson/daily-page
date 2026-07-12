const EMPTY = null;

export const WOOD_PALETTE = Object.freeze({
  light: '#a8784f',
  mid: '#765039',
  dark: '#4a332b',
  deep: '#35251f'
});

function makeGrid(width, height, value = EMPTY) {
  return Array.from({ length: height }, () => Array(width).fill(value));
}

function coordinateNoise(seed, x, y) {
  let value = (seed ^ Math.imul(x + 1, 0x45D9F3B) ^ Math.imul(y + 1, 0x119DE1F3)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45D9F3B);
  value = Math.imul(value ^ (value >>> 16), 0x45D9F3B);
  return (value ^ (value >>> 16)) >>> 0;
}

function paintTaperedSegment(mask, owner, from, to, segment) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = (dx * dx) + (dy * dy) || 1;
  const maximumRadius = Math.max(segment.fromRadius, segment.toRadius) + 0.75;
  const minimumX = Math.max(0, Math.floor(Math.min(from.x, to.x) - maximumRadius));
  const maximumX = Math.min(mask[0].length - 1, Math.ceil(Math.max(from.x, to.x) + maximumRadius));
  const minimumY = Math.max(0, Math.floor(Math.min(from.y, to.y) - maximumRadius));
  const maximumY = Math.min(mask.length - 1, Math.ceil(Math.max(from.y, to.y) + maximumRadius));

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const projection = (((x + 0.5 - from.x) * dx) + ((y + 0.5 - from.y) * dy))
        / lengthSquared;
      const t = Math.max(0, Math.min(1, projection));
      const nearestX = from.x + (dx * t);
      const nearestY = from.y + (dy * t);
      const radius = segment.fromRadius
        + ((segment.toRadius - segment.fromRadius) * t);
      const distance = Math.hypot(x + 0.5 - nearestX, y + 0.5 - nearestY);
      if (distance <= radius + 0.35) {
        mask[y][x] = true;
        const lateral = ((x + 0.5 - nearestX) * -dy) + ((y + 0.5 - nearestY) * dx);
        owner[y][x] = { lateral, radius };
      }
    }
  }
}

function paintRootFlare(mask, owner, root, phenotype) {
  const top = Math.max(0, phenotype.groundY - phenotype.rootFlareHeight);
  for (let y = top; y <= phenotype.groundY && y < phenotype.height; y += 1) {
    const progress = (y - top) / phenotype.rootFlareHeight;
    const radius = root.radius + (phenotype.rootFlareStrength * progress * progress);
    const minimumX = Math.max(0, Math.floor(root.x - radius));
    const maximumX = Math.min(phenotype.width - 1, Math.ceil(root.x + radius));
    for (let x = minimumX; x <= maximumX; x += 1) {
      const lateral = x + 0.5 - root.x;
      if (Math.abs(lateral) <= radius) {
        mask[y][x] = true;
        owner[y][x] = { lateral, radius };
      }
    }
  }
}

function shadeWood(mask, owner, seed, palette) {
  const height = mask.length;
  const width = mask[0].length;
  const pixels = makeGrid(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y][x]) continue;
      const surface = owner[y][x] || { lateral: 0, radius: 1 };
      const side = surface.lateral / Math.max(0.5, surface.radius);
      const noise = coordinateNoise(seed, x, y);
      const verticalBarkMark = y > 18 && noise % 41 < 3 && mask[Math.max(0, y - 1)][x];
      if (side < -0.35 && noise % 5 !== 0) pixels[y][x] = palette.light;
      else if (side > 0.48) pixels[y][x] = palette.dark;
      else if (verticalBarkMark) pixels[y][x] = palette.deep;
      else pixels[y][x] = palette.mid;
    }
  }
  return pixels;
}

function compactRuns(pixels) {
  const runs = [];
  for (let y = 0; y < pixels.length; y += 1) {
    let x = 0;
    while (x < pixels[y].length) {
      const color = pixels[y][x];
      if (!color) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < pixels[y].length && pixels[y][x] === color) x += 1;
      runs.push({ x: start, y, width: x - start, color });
    }
  }
  return runs;
}

export function rasterizeWood(graph, phenotype, seed) {
  const palette = phenotype.woodPalette || WOOD_PALETTE;
  const mask = makeGrid(phenotype.width, phenotype.height, false);
  const owner = makeGrid(phenotype.width, phenotype.height);
  for (const segment of graph.segments) {
    paintTaperedSegment(
      mask,
      owner,
      graph.nodes[segment.fromId],
      graph.nodes[segment.toId],
      segment
    );
  }
  paintRootFlare(mask, owner, graph.nodes[0], phenotype);
  const pixels = shadeWood(mask, owner, seed ^ 0xB47C0DE, palette);
  return {
    width: phenotype.width,
    height: phenotype.height,
    groundY: phenotype.groundY,
    mask,
    pixels,
    runs: compactRuns(pixels),
    palette
  };
}

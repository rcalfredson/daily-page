export const FOREST_RENDERER_VERSION = 2;

const WIDTH = 40;
const HEIGHT = 48;
const GROUND_Y = 44;
const EMPTY = null;

const PALETTES = Object.freeze({
  spring: [
    { leaf: '#4f8f45', leafLight: '#78b85d', leafDark: '#32633a', accent: '#f4a6b8' },
    { leaf: '#3f8959', leafLight: '#75bd72', leafDark: '#286044', accent: '#f6d36b' }
  ],
  summer: [
    { leaf: '#347548', leafLight: '#5da653', leafDark: '#24533a', accent: '#e86f51' },
    { leaf: '#477b37', leafLight: '#7aa342', leafDark: '#2f552c', accent: '#f2c94c' }
  ],
  autumn: [
    { leaf: '#c46532', leafLight: '#e6a33d', leafDark: '#813f2d', accent: '#f2cf5b' },
    { leaf: '#a64b36', leafLight: '#d77a39', leafDark: '#6e3540', accent: '#efb34f' }
  ],
  winter: [
    { leaf: '#56786f', leafLight: '#89a89c', leafDark: '#365450', accent: '#d8edf0' },
    { leaf: '#486c75', leafLight: '#7f9da4', leafDark: '#304e5b', accent: '#e7f3f5' }
  ]
});

const BARK_PALETTES = Object.freeze([
  { bark: '#70462d', barkLight: '#9a6842', barkDark: '#4b3027' },
  { bark: '#66503b', barkLight: '#927557', barkDark: '#40342d' },
  { bark: '#795039', barkLight: '#ad7651', barkDark: '#503329' }
]);

const SPECIES = Object.freeze(['round', 'spreading', 'columnar', 'conifer']);

export function hashForestSeed(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function boundedCount(value, divisor, maximum) {
  return Math.max(0, Math.min(maximum, Math.floor(Number(value || 0) / divisor)));
}

function seasonFor(date) {
  const month = new Date(date).getUTCMonth();
  if ([11, 0, 1].includes(month)) return 'winter';
  if ([2, 3, 4].includes(month)) return 'spring';
  if ([5, 6, 7].includes(month)) return 'summer';
  return 'autumn';
}

export function deriveForestTreeTraits(post) {
  const seed = hashForestSeed(`${FOREST_RENDERER_VERSION}:${post.id}`);
  const random = seededRandom(seed);
  const season = seasonFor(post.createdAt);
  const species = SPECIES[hashForestSeed(post.roomId) % SPECIES.length];

  return Object.freeze({
    rendererVersion: FOREST_RENDERER_VERSION,
    seed,
    species,
    season,
    paletteVariant: Math.floor(random() * PALETTES[season].length),
    barkVariant: Math.floor(random() * BARK_PALETTES.length),
    lean: Math.floor(random() * 3) - 1,
    crownBias: Math.floor(random() * 3) - 1,
    heightBoost: Math.min(4, Math.floor(Number(post.wordCount || 0) / 700)),
    branchVariant: Math.floor(random() * 3),
    splitTrunk: Number(post.collaboratorCount || 0) > 0,
    blossomCount: Math.min(7, Number(post.translationCount || 0)),
    fruitCount: post.questApproved ? 4 + Math.floor(random() * 3) : 0,
    flowerCount: boundedCount(post.commentCount, 2, 6),
    fireflyCount: boundedCount(post.reactionCount, 3, 5)
  });
}

function makeCanvas() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(EMPTY));
}

function setPixel(canvas, x, y, color) {
  if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) canvas[y][x] = color;
}

function fillRect(canvas, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setPixel(canvas, column, row, color);
    }
  }
}

function fillEllipse(canvas, centerX, centerY, radiusX, radiusY, color) {
  for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
      const dx = (x - centerX) / Math.max(1, radiusX);
      const dy = (y - centerY) / Math.max(1, radiusY);
      if ((dx * dx) + (dy * dy) <= 1) setPixel(canvas, x, y, color);
    }
  }
}

function drawLine(canvas, fromX, fromY, toX, toY, color, thickness = 1) {
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  for (let step = 0; step <= steps; step += 1) {
    const ratio = steps ? step / steps : 0;
    const x = Math.round(fromX + ((toX - fromX) * ratio));
    const y = Math.round(fromY + ((toY - fromY) * ratio));
    fillRect(canvas, x, y, thickness, thickness, color);
  }
}

function createAnatomy(traits) {
  const random = seededRandom(traits.seed ^ 0x13579BDF);
  const baseX = 19 + traits.lean;
  const trunkTopY = 20 - traits.heightBoost;
  const trunkTopX = baseX + traits.lean + traits.crownBias;
  const branchSpreads = {
    spreading: 13,
    round: 9,
    columnar: 5,
    conifer: 5
  };
  const spread = branchSpreads[traits.species];
  const branchLift = 3 + traits.branchVariant;
  const leftTip = {
    x: trunkTopX - spread + Math.floor(random() * 3),
    y: trunkTopY + 4 - branchLift
  };
  const rightTip = {
    x: trunkTopX + spread - Math.floor(random() * 3),
    y: trunkTopY + 3 - branchLift
  };
  const crownCenter = {
    x: Math.round((trunkTopX * 2 + leftTip.x + rightTip.x) / 4),
    y: trunkTopY - 5
  };

  return Object.freeze({
    baseX,
    baseY: GROUND_Y,
    trunkTopX,
    trunkTopY,
    crownCenter,
    leftTip,
    rightTip,
    supportDelta: crownCenter.x - trunkTopX
  });
}

function drawGround(canvas) {
  fillEllipse(canvas, 20, GROUND_Y, 15, 2, '#355c36');
  fillRect(canvas, 9, GROUND_Y + 1, 22, 1, '#29492d');
}

function drawSkeleton(canvas, anatomy, traits, bark) {
  const trunkWidth = traits.splitTrunk ? 5 : 4;
  drawLine(
    canvas,
    anatomy.baseX,
    anatomy.baseY - 1,
    anatomy.trunkTopX,
    anatomy.trunkTopY,
    bark.bark,
    trunkWidth
  );
  drawLine(canvas, anatomy.baseX, anatomy.baseY - 3, anatomy.trunkTopX, anatomy.trunkTopY, bark.barkLight);
  drawLine(
    canvas,
    anatomy.baseX + trunkWidth - 1,
    anatomy.baseY - 2,
    anatomy.trunkTopX + trunkWidth - 1,
    anatomy.trunkTopY,
    bark.barkDark
  );
  drawLine(
    canvas,
    anatomy.trunkTopX + 1,
    anatomy.trunkTopY + 7,
    anatomy.leftTip.x,
    anatomy.leftTip.y,
    bark.bark,
    2
  );
  drawLine(
    canvas,
    anatomy.trunkTopX + 2,
    anatomy.trunkTopY + 6,
    anatomy.rightTip.x,
    anatomy.rightTip.y,
    bark.barkDark,
    2
  );
  if (traits.splitTrunk) {
    drawLine(
      canvas,
      anatomy.baseX + 2,
      anatomy.baseY - 10,
      anatomy.trunkTopX + 6,
      anatomy.trunkTopY - 2,
      bark.bark,
      3
    );
  }
  fillRect(canvas, anatomy.baseX - 3, GROUND_Y - 1, trunkWidth + 7, 2, bark.barkDark);
}

function drawCanopyCluster(canvas, x, y, radiusX, radiusY, colors, lightSide = false) {
  fillEllipse(canvas, x, y, radiusX, radiusY, colors.leaf);
  fillEllipse(canvas, x - Math.ceil(radiusX / 3), y + 1, Math.ceil(radiusX / 2), Math.ceil(radiusY / 2), colors.leafDark);
  fillEllipse(
    canvas,
    x + (lightSide ? 2 : Math.ceil(radiusX / 3)),
    y - Math.ceil(radiusY / 3),
    Math.max(2, Math.floor(radiusX / 2)),
    Math.max(2, Math.floor(radiusY / 2)),
    colors.leafLight
  );
}

function drawCanopy(canvas, anatomy, traits, colors) {
  const { crownCenter, leftTip, rightTip } = anatomy;
  if (traits.species === 'conifer') {
    const topY = crownCenter.y - 11;
    for (let layer = 0; layer < 5; layer += 1) {
      const layerY = topY + (layer * 5);
      const halfWidth = 4 + (layer * 2);
      for (let row = 0; row < 8; row += 1) {
        const rowWidth = Math.min(halfWidth, 1 + Math.floor(row * 1.45));
        fillRect(canvas, crownCenter.x - rowWidth, layerY + row, (rowWidth * 2) + 1, 1, colors.leaf);
      }
    }
    drawLine(canvas, crownCenter.x - 2, topY + 5, crownCenter.x - 5, crownCenter.y + 7, colors.leafDark, 2);
    drawLine(canvas, crownCenter.x + 2, topY + 5, crownCenter.x + 5, crownCenter.y + 7, colors.leafLight, 2);
    return;
  }

  if (traits.species === 'columnar') {
    drawCanopyCluster(canvas, crownCenter.x, crownCenter.y - 4, 7, 13 + traits.heightBoost, colors);
    drawCanopyCluster(canvas, crownCenter.x - 2, crownCenter.y + 5, 6, 8, colors, true);
    return;
  }

  if (traits.species === 'spreading') {
    drawCanopyCluster(canvas, leftTip.x + 4, leftTip.y - 2, 9, 7, colors);
    drawCanopyCluster(canvas, crownCenter.x, crownCenter.y - 2, 10, 8, colors, true);
    drawCanopyCluster(canvas, rightTip.x - 3, rightTip.y - 3, 9, 7, colors, true);
    return;
  }

  drawCanopyCluster(canvas, leftTip.x + 4, leftTip.y - 2, 8, 8, colors);
  drawCanopyCluster(canvas, crownCenter.x, crownCenter.y - 3, 10, 10, colors, true);
  drawCanopyCluster(canvas, rightTip.x - 4, rightTip.y - 2, 8, 8, colors, true);
}

function canopyPixels(canvas, colors) {
  const leafColors = new Set([colors.leaf, colors.leafLight, colors.leafDark]);
  const pixels = [];
  for (let y = 1; y < GROUND_Y - 5; y += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) {
      if (leafColors.has(canvas[y][x])) pixels.push({ x, y });
    }
  }
  return pixels;
}

function isCanopyEdge(canvas, pixel, colors) {
  const leafColors = new Set([colors.leaf, colors.leafLight, colors.leafDark]);
  return [
    [pixel.x - 1, pixel.y], [pixel.x + 1, pixel.y],
    [pixel.x, pixel.y - 1], [pixel.x, pixel.y + 1]
  ].some(([x, y]) => !leafColors.has(canvas[y]?.[x]));
}

function spacedSample(candidates, random, count, minimumDistance = 4) {
  const available = [...candidates];
  const selected = [];
  while (selected.length < count && available.length) {
    const index = Math.floor(random() * available.length);
    const candidate = available.splice(index, 1)[0];
    if (selected.every(point => Math.abs(point.x - candidate.x) + Math.abs(point.y - candidate.y) >= minimumDistance)) {
      selected.push(candidate);
    }
  }
  return selected;
}

function drawBlossom(canvas, x, y, color) {
  setPixel(canvas, x, y, '#f8df76');
  setPixel(canvas, x - 1, y, color);
  setPixel(canvas, x + 1, y, color);
  setPixel(canvas, x, y - 1, color);
  setPixel(canvas, x, y + 1, color);
}

function drawFruit(canvas, x, y) {
  fillRect(canvas, x, y, 2, 2, '#d85b3f');
  setPixel(canvas, x + 1, y - 1, '#4c6a34');
}

function drawFlowerCluster(canvas, x, color) {
  setPixel(canvas, x, GROUND_Y - 2, '#4d7a3a');
  setPixel(canvas, x, GROUND_Y - 3, '#4d7a3a');
  setPixel(canvas, x, GROUND_Y - 4, '#f8df76');
  setPixel(canvas, x - 1, GROUND_Y - 4, color);
  setPixel(canvas, x + 1, GROUND_Y - 4, color);
  setPixel(canvas, x, GROUND_Y - 5, color);
}

function drawFirefly(canvas, x, y) {
  setPixel(canvas, x, y, '#fff1a3');
  setPixel(canvas, x - 1, y, '#d9bd54');
  setPixel(canvas, x + 1, y, '#d9bd54');
}

function drawDetails(canvas, anatomy, traits, colors) {
  const random = seededRandom(traits.seed ^ 0xA5A5A5A5);
  const canopy = canopyPixels(canvas, colors);
  const edges = canopy.filter(pixel => isCanopyEdge(canvas, pixel, colors));
  const lowerCanopy = canopy.filter(pixel => pixel.y > anatomy.crownCenter.y && pixel.y < GROUND_Y - 8);
  const motifs = [];

  for (const point of spacedSample(edges, random, traits.blossomCount, 6)) {
    drawBlossom(canvas, point.x, point.y, colors.accent);
    motifs.push({ type: 'blossom', ...point });
  }
  for (const point of spacedSample(lowerCanopy, random, traits.fruitCount, 5)) {
    drawFruit(canvas, point.x, point.y);
    motifs.push({ type: 'fruit', ...point });
  }

  const flowerXs = spacedSample(
    Array.from({ length: 17 }, (_, index) => ({ x: 4 + (index * 2), y: GROUND_Y - 4 })),
    random,
    traits.flowerCount,
    4
  );
  for (const point of flowerXs) {
    drawFlowerCluster(canvas, point.x, colors.accent);
    motifs.push({ type: 'flower', ...point });
  }

  const air = [];
  for (let y = 7; y < GROUND_Y - 8; y += 2) {
    for (let x = 3; x < WIDTH - 3; x += 2) {
      if (!canvas[y][x] && !canvas[y][x - 1] && !canvas[y][x + 1]) air.push({ x, y });
    }
  }
  for (const point of spacedSample(air, random, traits.fireflyCount, 6)) {
    drawFirefly(canvas, point.x, point.y);
    motifs.push({ type: 'firefly', ...point });
  }

  return Object.freeze(motifs.map(motif => Object.freeze(motif)));
}

function canvasToRuns(canvas) {
  const runs = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    let x = 0;
    while (x < WIDTH) {
      const color = canvas[y][x];
      if (!color) {
        x += 1;
        continue;
      }
      let width = 1;
      while (x + width < WIDTH && canvas[y][x + width] === color) width += 1;
      runs.push({ x, y, width, color });
      x += width;
    }
  }
  return runs;
}

export function generateForestTree(post) {
  if (!post?.id || !post?.createdAt || !post?.roomId) {
    throw new Error('Forest trees require post id, roomId, and createdAt.');
  }
  const traits = deriveForestTreeTraits(post);
  const colors = PALETTES[traits.season][traits.paletteVariant];
  const bark = BARK_PALETTES[traits.barkVariant];
  const anatomy = createAnatomy(traits);
  const canvas = makeCanvas();

  drawGround(canvas);
  drawSkeleton(canvas, anatomy, traits, bark);
  drawCanopy(canvas, anatomy, traits, colors);
  const motifs = drawDetails(canvas, anatomy, traits, colors);

  return Object.freeze({
    width: WIDTH,
    height: HEIGHT,
    traits,
    anatomy,
    motifs,
    runs: canvasToRuns(canvas)
  });
}

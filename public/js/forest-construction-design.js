// Versioned design vocabulary for the temporary construction study. No inventory or save authority.
export const CONSTRUCTION_DESIGN_VERSION = 1;
export const HOME_DESIGN_OPTIONS = Object.freeze({
  width: [[120, 'Small · 120'], [150, 'Medium · 150'], [180, 'Wide · 180']],
  depth: [[72, 'Shallow · 72'], [86, 'Medium · 86'], [100, 'Deep · 100']],
  walls: [['planks', 'Weathered planks'], ['shingles', 'Cedar shingles']],
  color: [['honey', 'Honey wood'], ['sage', 'Sage green'], ['clay', 'Clay red'], ['cream', 'Buttermilk']],
  roof: [['shakes', 'Wood shakes'], ['tiles', 'Clay tiles']],
  roofColor: [['moss', 'Moss'], ['rust', 'Terracotta'], ['slate', 'Blue slate']]
});
export const CART_DESIGN_OPTIONS = Object.freeze({
  length: [[36, 'Short · 36'], [44, 'Medium · 44'], [52, 'Long · 52']],
  width: [[24, 'Narrow · 24'], [30, 'Medium · 30'], [36, 'Wide · 36']],
  body: [['rails', 'Open rails'], ['boards', 'Boarded bed']],
  wheels: [['spoked', 'Wooden spokes'], ['solid', 'Iron-bound discs']],
  supports: [['posts', 'Timber posts'], ['bows', 'Bentwood bows']],
  canopy: [['none', 'Open sky'], ['linen', 'Linen cover'], ['patched', 'Patchwork cover']],
  wood: [['honey', 'Honey wood'], ['walnut', 'Dark walnut'], ['sage', 'Painted sage']],
  cloth: [['ochre', 'Golden ochre'], ['moss', 'Moss green'], ['indigo', 'Faded indigo']]
});
export const DEFAULT_HOME_DESIGN = Object.freeze({ version: 1, width: 180, depth: 100,
  walls: 'planks', color: 'honey', roof: 'shakes', roofColor: 'moss' });
export const DEFAULT_CART_DESIGN = Object.freeze({ version: 1, length: 52, width: 36,
  body: 'boards', wheels: 'spoked', supports: 'bows', canopy: 'patched', wood: 'honey', cloth: 'indigo' });

export function validateConstructionDesign(kind, design) {
  const options = kind === 'home' ? HOME_DESIGN_OPTIONS : kind === 'cart' ? CART_DESIGN_OPTIONS : null;
  if (!options || !design || design.version !== CONSTRUCTION_DESIGN_VERSION) return false;
  return Object.keys(design).length === Object.keys(options).length + 1
    && Object.entries(options).every(([key, choices]) => choices.some(([value]) => design[key] === value));
}

export function requireConstructionDesign(kind, design) {
  if (!validateConstructionDesign(kind, design)) throw new Error(`Unsupported ${kind} design.`);
  return design;
}

export function constructionCartGeometry(design) {
  requireConstructionDesign('cart', design);
  return { halfLength: design.length / 2, halfWidth: design.width / 2,
    animalOffset: 48 + (design.length - 36) * 14 / 16, speed: 224 };
}

// The front door stays fixed while the house grows back into the already tested envelope.
export function constructionHomeFootprint(home, design) {
  requireConstructionDesign('home', design);
  return { minX: home.x - design.width / 2, maxX: home.x + design.width / 2,
    minY: home.y - 35 - design.depth, maxY: home.y - 35 };
}

export function studyCartDesign(variant) {
  if (variant === 'canopy') return { ...DEFAULT_CART_DESIGN };
  if (variant === 'compact') return { ...DEFAULT_CART_DESIGN, length: 36, width: 24, body: 'rails',
    supports: 'posts', canopy: 'none' };
  throw new Error('Unknown cart study variant.');
}

// Presentation-only motion advances from actual displacement, not held keys or wall-clock time.
export function advanceCartPresentation(state, from, to, reducedMotion = false) {
  const dx = to.worldX - from.worldX, dy = to.worldY - from.worldY;
  const distance = Math.hypot(dx, dy);
  const sign = dx * Math.cos(to.heading) + dy * Math.sin(to.heading) < 0 ? -1 : 1;
  return { wheel: reducedMotion ? 0 : state.wheel + sign * distance / 10,
    gait: reducedMotion ? 0 : state.gait + sign * distance * Math.PI * 2 / 76 };
}

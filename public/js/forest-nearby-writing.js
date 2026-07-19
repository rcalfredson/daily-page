export const FOREST_BENCH_NEARBY_WRITING_RADIUS = 360;
export const FOREST_BENCH_NEARBY_WRITING_MAXIMUM = 3;

function stableText(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function fixtureProjection(fixture) {
  if (!fixture || !stableText(fixture.id) || !stableText(fixture.title)
    || !stableText(fixture.roomName) || !stableText(fixture.createdAt)
    || !stableText(fixture.excerpt)) return null;
  return {
    id: fixture.id,
    title: fixture.title,
    roomName: fixture.roomName,
    createdAt: fixture.createdAt,
    excerpt: fixture.excerpt
  };
}

export function nearbyForestWritingForBench(bench, placements, fixtures) {
  const benchId = stableText(bench?.id);
  if (!benchId || !Number.isFinite(bench.worldX) || !Number.isFinite(bench.worldY)) {
    return {
      benchId,
      radius: FOREST_BENCH_NEARBY_WRITING_RADIUS,
      qualifyingPlacementCount: 0,
      candidates: []
    };
  }

  const fixturesById = new Map((Array.isArray(fixtures) ? fixtures : [])
    .map(fixtureProjection).filter(Boolean).map((fixture) => [fixture.id, fixture]));
  const qualifying = (Array.isArray(placements) ? placements : []).flatMap((placement) => {
    const fixture = fixturesById.get(placement?.fixtureId);
    if (!fixture || !stableText(placement?.id)
      || !Number.isFinite(placement.worldX) || !Number.isFinite(placement.worldY)) return [];
    const distance = Math.hypot(
      placement.worldX - bench.worldX, placement.worldY - bench.worldY
    );
    if (distance > FOREST_BENCH_NEARBY_WRITING_RADIUS) return [];
    return [{
      fixtureId: fixture.id,
      placementId: placement.id,
      distance,
      fixture: { ...fixture }
    }];
  }).sort((left, right) => left.distance - right.distance
    || left.placementId.localeCompare(right.placementId)
    || left.fixtureId.localeCompare(right.fixtureId));

  const seenFixtureIds = new Set();
  const candidates = [];
  for (const candidate of qualifying) {
    if (seenFixtureIds.has(candidate.fixtureId)) continue;
    seenFixtureIds.add(candidate.fixtureId);
    candidates.push(candidate);
    if (candidates.length === FOREST_BENCH_NEARBY_WRITING_MAXIMUM) break;
  }

  return {
    benchId,
    radius: FOREST_BENCH_NEARBY_WRITING_RADIUS,
    qualifyingPlacementCount: qualifying.length,
    candidates
  };
}

export function renderNearbyForestWritingCandidates(surface, selection, openCandidate) {
  const list = surface.querySelector('[data-forest-bench-writing-list]');
  const empty = surface.querySelector('[data-forest-bench-writing-empty]');
  const candidates = Array.isArray(selection?.candidates) ? selection.candidates : [];
  list.replaceChildren();
  empty.hidden = candidates.length > 0;
  candidates.forEach((candidate) => {
    const item = surface.ownerDocument.createElement('li');
    const button = surface.ownerDocument.createElement('button');
    const title = surface.ownerDocument.createElement('strong');
    const context = surface.ownerDocument.createElement('span');
    button.type = 'button';
    button.setAttribute('aria-label', `Open ${candidate.fixture.title}`);
    title.textContent = candidate.fixture.title;
    context.textContent = `${candidate.fixture.roomName} · ${candidate.fixture.createdAt}`;
    button.append(title, context);
    button.addEventListener('click', () => openCandidate(candidate));
    item.append(button);
    list.append(item);
  });
  surface.hidden = false;
  return list.querySelector('button');
}

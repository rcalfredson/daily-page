import {
  ACCOUNT_DELETION_FIXTURE_ROOM_ID,
  ACCOUNT_DELETION_FIXTURE_TAG,
  assertFixtureScenario,
  fixtureObjectId
} from './accountDeletionFixture.js';

export const FOREST_OWNER_PRESSURE_TREE_COUNT = 600;
export const FOREST_OWNER_PRESSURE_TAG = 'forest-owner-pressure';

function boundedCount(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > FOREST_OWNER_PRESSURE_TREE_COUNT) {
    throw new Error(
      `Pressure fixture count must be an integer from 1 through ${FOREST_OWNER_PRESSURE_TREE_COUNT}.`
    );
  }
  return value;
}

export function buildForestOwnerPressurePosts({
  scenario,
  owner,
  count = FOREST_OWNER_PRESSURE_TREE_COUNT
}) {
  assertFixtureScenario(scenario);
  boundedCount(count);
  if (!owner?._id || !owner?.username) {
    throw new Error('A fixture owner with stable id and username is required.');
  }

  const baseTime = Date.parse('2025-01-01T12:00:00.000Z');
  return Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    const createdAt = new Date(baseTime + (index * 60_000));
    const status = index % 2 === 0 ? 'locked' : 'in-progress';
    return {
      _id: fixtureObjectId(scenario, `forest-pressure:post:${ordinal}`),
      title: `[Forest pressure] Writing tree ${String(ordinal).padStart(3, '0')}`,
      description: 'Disposable post for Activity Forest pressure measurement.',
      tags: [
        ACCOUNT_DELETION_FIXTURE_TAG,
        `account-deletion-${scenario}`,
        FOREST_OWNER_PRESSURE_TAG
      ],
      content: `# Forest pressure tree ${ordinal}\n\nDisposable pressure-fixture writing.`,
      roomId: ACCOUNT_DELETION_FIXTURE_ROOM_ID,
      creator: owner.username,
      userId: owner._id,
      authorshipState: 'live',
      visibility: index % 3 === 0 ? 'unlisted' : 'public',
      status,
      groupId: fixtureObjectId(scenario, `forest-pressure:group:${ordinal}`),
      lang: index % 7 === 0 ? 'es' : 'en',
      ...(status === 'locked' ? { lockedAt: createdAt } : {}),
      createdAt,
      updatedAt: createdAt
    };
  });
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

export function summarizeForestPressureTimings(values) {
  if (!Array.isArray(values)
    || values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error('Pressure timings must be a list of finite nonnegative numbers.');
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const rounded = value => Math.round(value * 100) / 100;
  return {
    samples: sorted.length,
    totalMs: rounded(sorted.reduce((total, value) => total + value, 0)),
    minimumMs: rounded(sorted[0] || 0),
    medianMs: rounded(percentile(sorted, 0.5)),
    p95Ms: rounded(percentile(sorted, 0.95)),
    maximumMs: rounded(sorted.at(-1) || 0)
  };
}

export function summarizeForestPressureCells(trees) {
  if (!Array.isArray(trees) || trees.some(tree => (
    !Number.isSafeInteger(tree?.placementIndex?.cellX)
    || !Number.isSafeInteger(tree?.placementIndex?.cellY)
  ))) {
    throw new Error('Pressure trees require exact placement-index cells.');
  }
  const counts = new Map();
  for (const tree of trees) {
    const { cellX, cellY } = tree.placementIndex;
    const key = `${cellX}:${cellY}`;
    counts.set(key, { cellX, cellY, count: (counts.get(key)?.count || 0) + 1 });
  }
  const cells = [...counts.values()].sort((left, right) => (
    right.count - left.count
    || (Math.abs(left.cellX) + Math.abs(left.cellY))
      - (Math.abs(right.cellX) + Math.abs(right.cellY))
    || left.cellY - right.cellY
    || left.cellX - right.cellX
  ));
  const occupancies = cells.map(cell => cell.count).sort((left, right) => left - right);
  const cellXs = cells.map(cell => cell.cellX);
  const cellYs = cells.map(cell => cell.cellY);
  return {
    treeCount: trees.length,
    occupiedCellCount: cells.length,
    cellSpanX: cells.length ? Math.max(...cellXs) - Math.min(...cellXs) + 1 : 0,
    cellSpanY: cells.length ? Math.max(...cellYs) - Math.min(...cellYs) + 1 : 0,
    occupancy: {
      minimum: occupancies[0] || 0,
      median: percentile(occupancies, 0.5),
      p95: percentile(occupancies, 0.95),
      maximum: occupancies.at(-1) || 0
    },
    cells
  };
}

export function forestPressureNeighborhoods(cellSummary) {
  if (!cellSummary?.cells?.length) return [];
  const densest = cellSummary.cells[0];
  const outermost = cellSummary.cells.slice().sort((left, right) => (
    (Math.abs(right.cellX) + Math.abs(right.cellY))
      - (Math.abs(left.cellX) + Math.abs(left.cellY))
    || right.count - left.count
  ))[0];
  const centers = [
    { label: 'center', cellX: 0, cellY: 0 },
    { label: 'densest', cellX: densest.cellX, cellY: densest.cellY },
    { label: 'outer', cellX: outermost.cellX, cellY: outermost.cellY }
  ];
  const seen = new Set();
  return centers.filter((center) => {
    const key = `${center.cellX}:${center.cellY}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(center => ({
    ...center,
    cells: [-1, 0, 1].flatMap(yOffset => (
      [-1, 0, 1].map(xOffset => ({
        cellX: center.cellX + xOffset,
        cellY: center.cellY + yOffset
      }))
    ))
  }));
}

const AGGREGATION_STAGES = new Set([
  '$cursor', '$group', '$limit', '$match', '$project', '$replaceRoot', '$skip',
  '$sort', '$unwind'
]);

function isExecutionStageName(value) {
  return typeof value === 'string' && value === value.toUpperCase();
}

function addStageName(stages, key, value) {
  if (key === 'stage' && isExecutionStageName(value)) stages.add(value);
  if (AGGREGATION_STAGES.has(key)) stages.add(key);
}

export function summarizeExplain(explain) {
  const stages = new Set();
  const indexes = new Set();
  const stageDetails = [];
  const metricValues = new Map();
  let usedDisk = false;
  let spills = 0;

  function recordMetric(key, value, depth) {
    if (!['executionTimeMillis', 'nReturned', 'totalDocsExamined', 'totalKeysExamined'].includes(key)) {
      return;
    }
    if (!Number.isFinite(value)) return;

    const current = metricValues.get(key);
    if (!current || depth < current.depth) {
      metricValues.set(key, { depth, values: [value] });
    } else if (depth === current.depth) {
      current.values.push(value);
    }
  }

  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth + 1));
      return;
    }

    const hasPerformanceSignal = Number.isFinite(value.nReturned)
      || Number.isFinite(value.executionTimeMillisEstimate)
      || value.usedDisk === true
      || Number.isFinite(value.spills)
      || Number.isFinite(value.totalDataSizeSortedBytesEstimate)
      || Boolean(value.maxAccumulatorMemoryUsageBytes);
    const stageNames = [];
    if (hasPerformanceSignal && isExecutionStageName(value.stage)) {
      stageNames.push(value.stage);
    }
    if (hasPerformanceSignal) {
      stageNames.push(...Object.keys(value).filter(key => AGGREGATION_STAGES.has(key)));
    }
    for (const stage of stageNames) {
      const detail = {
        stage,
        nReturned: Number.isFinite(value.nReturned) ? value.nReturned : null,
        executionTimeEstimateMs: Number.isFinite(value.executionTimeMillisEstimate)
          ? value.executionTimeMillisEstimate
          : null,
        usedDisk: value.usedDisk === true,
        spills: Number.isFinite(value.spills) ? value.spills : 0,
      };
      if (Number.isFinite(value.totalDataSizeSortedBytesEstimate)) {
        detail.sortedBytesEstimate = value.totalDataSizeSortedBytesEstimate;
      }
      if (value.maxAccumulatorMemoryUsageBytes) {
        detail.maxAccumulatorMemoryUsageBytes = value.maxAccumulatorMemoryUsageBytes;
      }
      stageDetails.push(detail);
    }

    for (const [key, child] of Object.entries(value)) {
      addStageName(stages, key, child);
      if (key === 'indexName' && typeof child === 'string') indexes.add(child);
      if (key === 'usedDisk' && child === true) usedDisk = true;
      if (key === 'spills' && Number.isFinite(child)) spills += child;
      recordMetric(key, child, depth);
      visit(child, depth + 1);
    }
  }

  visit(explain);

  function metric(name, mode = 'sum') {
    const values = metricValues.get(name)?.values || [];
    if (!values.length) return null;
    return mode === 'max'
      ? Math.max(...values)
      : values.reduce((sum, value) => sum + value, 0);
  }

  const planStages = [...stages].sort();
  const nReturned = metric('nReturned');
  const docsExamined = metric('totalDocsExamined');
  const keysExamined = metric('totalKeysExamined');
  return {
    executionTimeMs: metric('executionTimeMillis', 'max'),
    nReturned,
    docsExamined,
    keysExamined,
    docsPerResult: nReturned > 0 && docsExamined != null
      ? Number((docsExamined / nReturned).toFixed(1))
      : null,
    keysPerResult: nReturned > 0 && keysExamined != null
      ? Number((keysExamined / nReturned).toFixed(1))
      : null,
    indexes: [...indexes].sort(),
    planStages,
    stageDetails,
    collectionScan: planStages.includes('COLLSCAN'),
    blockingSort: planStages.includes('SORT') || planStages.includes('$sort'),
    usedDisk,
    spills,
  };
}

export function parseTagQueryProfileArgs(argv) {
  const options = {
    prod: false,
    authorizedProductionRead: false,
    tag: null,
    preferredLang: 'en',
    timeframe: '30d',
    page: 1,
    limit: 20,
    maxTimeMs: 15_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [name, inlineValue] = argument.split('=', 2);
    const readValue = () => inlineValue ?? argv[++index];

    if (argument === '--prod') options.prod = true;
    else if (argument === '--authorized-production-read') options.authorizedProductionRead = true;
    else if (name === '--tag') options.tag = readValue();
    else if (name === '--lang') options.preferredLang = readValue();
    else if (name === '--timeframe') options.timeframe = readValue();
    else if (name === '--page') options.page = Number.parseInt(readValue(), 10);
    else if (name === '--limit') options.limit = Number.parseInt(readValue(), 10);
    else if (name === '--max-time-ms') options.maxTimeMs = Number.parseInt(readValue(), 10);
    else if (argument !== '--help') throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.tag) throw new Error('--tag is required.');
  if (!['7d', '30d', 'all'].includes(options.timeframe)) {
    throw new Error('--timeframe must be one of 7d, 30d, or all.');
  }
  for (const [name, value] of [
    ['page', options.page],
    ['limit', options.limit],
    ['max-time-ms', options.maxTimeMs],
  ]) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`--${name} must be a positive integer.`);
    }
  }
  if (options.prod && !options.authorizedProductionRead) {
    throw new Error('Production analysis requires --authorized-production-read.');
  }

  return options;
}

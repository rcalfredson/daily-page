import { hashSeed } from './forest/v3/random.js';

export const FOREST_OWNER_GROVE_PLACEMENT_VERSION = 1;

export const FOREST_OWNER_GROVE_PLACEMENT_CONFIG = Object.freeze({
  origin: Object.freeze({ worldX: 0, worldY: 0 }),
  centralClearingRadius: 260,
  shellWidth: 720,
  shellOverlap: 120,
  baseCandidatesPerShell: 72,
  candidatesPerNode: 6,
  microGroveNodePermille: 220,
  minimumMicroGroveCoreSize: 2,
  maximumMicroGroveCoreSize: 5,
  maximumMicroGroveHaloSize: 2,
  microGroveCoreRadius: Object.freeze({ minimum: 105, maximum: 185 }),
  microGroveHaloRadius: Object.freeze({ minimum: 230, maximum: 340 }),
  minimumMicroGroveAnchorSpacing: 700,
  microGroveOpeningRadius: 360,
  microGroveGroupingRadius: 180,
  minimumTreeSpacing: 84,
  maximumBatchSize: 1_000,
  maximumOccupiedPlacements: 10_000,
  maximumCandidateChecks: 128_000,
  maximumPlacementSlot: 1_000_000_000,
});

const TWO_PI = Math.PI * 2;

export class ForestOwnerGrovePlacementError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForestOwnerGrovePlacementError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ForestOwnerGrovePlacementError(code, message);
}

function validateWorldSeed(worldSeed) {
  if (
    typeof worldSeed !== 'string'
    || worldSeed.length === 0
    || worldSeed.length > 80
  ) {
    fail(
      'INVALID_PLACEMENT_INPUT',
      'worldSeed must be a non-empty string of at most 80 characters',
    );
  }

  return worldSeed;
}

function boundedInteger(value, fieldName, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(
      'INVALID_PLACEMENT_INPUT',
      `${fieldName} must be an integer from ${minimum} through ${maximum}`,
    );
  }

  return value;
}

function unit(seed) {
  return hashSeed(seed) / 4_294_967_296;
}

function versionedSeed(worldSeed, ...parts) {
  return [
    `owner-grove-placement-v${FOREST_OWNER_GROVE_PLACEMENT_VERSION}`,
    worldSeed,
    ...parts,
  ].join(':');
}

function candidatesBeforeShell(shell) {
  return FOREST_OWNER_GROVE_PLACEMENT_CONFIG.baseCandidatesPerShell
    * (shell ** 2);
}

function shellAndOffsetForSlot(placementSlot) {
  const base = FOREST_OWNER_GROVE_PLACEMENT_CONFIG.baseCandidatesPerShell;
  let shell = Math.floor(Math.sqrt(placementSlot / base));

  while (candidatesBeforeShell(shell + 1) <= placementSlot) shell += 1;
  while (candidatesBeforeShell(shell) > placementSlot) shell -= 1;

  return {
    shell,
    offset: placementSlot - candidatesBeforeShell(shell),
  };
}

function shellBounds(shell) {
  const config = FOREST_OWNER_GROVE_PLACEMENT_CONFIG;
  const nominalInnerRadius = config.centralClearingRadius
    + (shell * config.shellWidth);
  const nominalOuterRadius = nominalInnerRadius + config.shellWidth;

  return {
    innerRadius: Math.max(
      config.centralClearingRadius,
      nominalInnerRadius - config.shellOverlap,
    ),
    outerRadius: nominalOuterRadius + config.shellOverlap,
  };
}

function areaUniformPoint(worldSeed, shell, decision) {
  const { innerRadius, outerRadius } = shellBounds(shell);
  const seedBase = versionedSeed(worldSeed, 'shell', shell, decision);
  const angle = unit(`${seedBase}:angle`) * TWO_PI;
  const radialUnit = unit(`${seedBase}:radius`);
  const radius = Math.sqrt(
    (innerRadius ** 2)
    + (radialUnit * ((outerRadius ** 2) - (innerRadius ** 2))),
  );

  return {
    worldX: Math.round(Math.cos(angle) * radius),
    worldY: Math.round(Math.sin(angle) * radius),
  };
}

function nodeIdentity(shell, nodeIndex) {
  return `shell-${shell}-node-${nodeIndex}`;
}

function nodeDescription(worldSeed, shell, nodeIndex) {
  const nodeKey = nodeIdentity(shell, nodeIndex);
  const seedBase = versionedSeed(worldSeed, nodeKey);
  const microGrove = hashSeed(`${seedBase}:kind`) % 1_000
    < FOREST_OWNER_GROVE_PLACEMENT_CONFIG.microGroveNodePermille;

  if (!microGrove) return { nodeKey, microGrove: false };

  const config = FOREST_OWNER_GROVE_PLACEMENT_CONFIG;
  const coreRange = config.maximumMicroGroveCoreSize
    - config.minimumMicroGroveCoreSize + 1;
  const coreSize = config.minimumMicroGroveCoreSize
    + (hashSeed(`${seedBase}:core-size`) % coreRange);
  const availableHaloSlots = config.candidatesPerNode - coreSize;
  const haloSize = Math.min(
    availableHaloSlots,
    hashSeed(`${seedBase}:halo-size`) % (config.maximumMicroGroveHaloSize + 1),
  );
  const anchor = areaUniformPoint(worldSeed, shell, `${nodeKey}:anchor`);

  return {
    nodeKey,
    microGrove: true,
    coreSize,
    haloSize,
    anchor,
  };
}

function pointAroundAnchor({
  worldSeed,
  node,
  memberIndex,
  memberCount,
  radius,
  decision,
}) {
  const seedBase = versionedSeed(worldSeed, node.nodeKey, decision);
  const rotation = unit(`${seedBase}:rotation`) * TWO_PI;
  const angularJitter = (unit(`${seedBase}:angle:${memberIndex}`) - 0.5) * 0.42;
  const angle = rotation
    + ((memberIndex / Math.max(1, memberCount)) * TWO_PI)
    + angularJitter;
  const distance = radius.minimum
    + (unit(`${seedBase}:radius:${memberIndex}`)
      * (radius.maximum - radius.minimum));

  return {
    worldX: Math.round(node.anchor.worldX + (Math.cos(angle) * distance)),
    worldY: Math.round(node.anchor.worldY + (Math.sin(angle) * distance)),
  };
}

function microGroveCandidate(worldSeed, node, memberIndex) {
  const config = FOREST_OWNER_GROVE_PLACEMENT_CONFIG;
  if (memberIndex < node.coreSize) {
    if (memberIndex === 0) {
      return {
        candidateClass: 'core',
        enabled: true,
        ...node.anchor,
      };
    }

    return {
      candidateClass: 'core',
      enabled: true,
      ...pointAroundAnchor({
        worldSeed,
        node,
        memberIndex: memberIndex - 1,
        memberCount: node.coreSize - 1,
        radius: config.microGroveCoreRadius,
        decision: 'core',
      }),
    };
  }

  const haloIndex = memberIndex - node.coreSize;
  if (haloIndex < node.haloSize) {
    return {
      candidateClass: 'halo',
      enabled: true,
      ...pointAroundAnchor({
        worldSeed,
        node,
        memberIndex: haloIndex,
        memberCount: node.haloSize,
        radius: config.microGroveHaloRadius,
        decision: 'halo',
      }),
    };
  }

  return {
    candidateClass: 'unused',
    enabled: false,
    ...node.anchor,
  };
}

export function inspectForestOwnerGrovePlacementCandidate({
  worldSeed,
  placementSlot,
}) {
  const seed = validateWorldSeed(worldSeed);
  const slot = boundedInteger(
    placementSlot,
    'placementSlot',
    0,
    FOREST_OWNER_GROVE_PLACEMENT_CONFIG.maximumPlacementSlot,
  );
  const { shell, offset } = shellAndOffsetForSlot(slot);
  const candidatesPerNode = FOREST_OWNER_GROVE_PLACEMENT_CONFIG
    .candidatesPerNode;
  const nodeIndex = Math.floor(offset / candidatesPerNode);
  const memberIndex = offset % candidatesPerNode;
  const node = nodeDescription(seed, shell, nodeIndex);
  const proposal = node.microGrove
    ? microGroveCandidate(seed, node, memberIndex)
    : {
      candidateClass: 'open',
      enabled: true,
      ...areaUniformPoint(seed, shell, `open:${offset}`),
    };
  const distanceFromOrigin = Math.hypot(
    proposal.worldX,
    proposal.worldY,
  );

  return Object.freeze({
    placementVersion: FOREST_OWNER_GROVE_PLACEMENT_VERSION,
    placementSlot: slot,
    shell,
    shellOffset: offset,
    nodeIndex,
    nodeMemberIndex: memberIndex,
    candidateClass: proposal.candidateClass,
    enabled: proposal.enabled,
    worldX: proposal.worldX,
    worldY: proposal.worldY,
    distanceFromOrigin: Math.round(distanceFromOrigin),
    clearsCenter:
      distanceFromOrigin
      >= FOREST_OWNER_GROVE_PLACEMENT_CONFIG.centralClearingRadius,
    microGroveNodeKey: node.microGrove ? node.nodeKey : null,
    microGroveAnchor: node.microGrove
      ? Object.freeze({ ...node.anchor })
      : null,
  });
}

function placementBucketKey(worldX, worldY) {
  const size = FOREST_OWNER_GROVE_PLACEMENT_CONFIG.minimumTreeSpacing;

  return `${Math.floor(worldX / size)}:${Math.floor(worldY / size)}`;
}

function addPlacementToBuckets(buckets, placement) {
  const key = placementBucketKey(placement.worldX, placement.worldY);
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(placement);
}

function hasPlacementWithin(buckets, point, radius) {
  const size = FOREST_OWNER_GROVE_PLACEMENT_CONFIG.minimumTreeSpacing;
  const baseColumn = Math.floor(point.worldX / size);
  const baseRow = Math.floor(point.worldY / size);
  const bucketRadius = Math.ceil(radius / size);

  for (
    let columnOffset = -bucketRadius;
    columnOffset <= bucketRadius;
    columnOffset += 1
  ) {
    for (
      let rowOffset = -bucketRadius;
      rowOffset <= bucketRadius;
      rowOffset += 1
    ) {
      const nearby = buckets.get(
        `${baseColumn + columnOffset}:${baseRow + rowOffset}`,
      ) || [];
      if (nearby.some(placement => Math.hypot(
        placement.worldX - point.worldX,
        placement.worldY - point.worldY,
      ) < radius)) return true;
    }
  }

  return false;
}

function validateOccupiedPlacement(placement) {
  if (
    !placement
    || typeof placement !== 'object'
    || Array.isArray(placement)
    || Object.keys(placement).some(
      field => !['placementSlot', 'worldX', 'worldY'].includes(field),
    )
  ) {
    fail(
      'INVALID_PLACEMENT_INPUT',
      'occupied placements may contain only placementSlot, worldX, and worldY',
    );
  }

  return {
    placementSlot: boundedInteger(
      placement.placementSlot,
      'occupiedPlacement.placementSlot',
      0,
      FOREST_OWNER_GROVE_PLACEMENT_CONFIG.maximumPlacementSlot,
    ),
    worldX: boundedInteger(
      placement.worldX,
      'occupiedPlacement.worldX',
      -Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ),
    worldY: boundedInteger(
      placement.worldY,
      'occupiedPlacement.worldY',
      -Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

function buildPlacementState(worldSeed, occupiedPlacements) {
  if (!Array.isArray(occupiedPlacements)) {
    fail('INVALID_PLACEMENT_INPUT', 'occupiedPlacements must be an array');
  }
  if (
    occupiedPlacements.length
    > FOREST_OWNER_GROVE_PLACEMENT_CONFIG.maximumOccupiedPlacements
  ) {
    fail(
      'INVALID_PLACEMENT_INPUT',
      'occupiedPlacements exceeds the bounded placement input',
    );
  }

  const buckets = new Map();
  const microGroveAnchors = new Map();
  for (const rawPlacement of occupiedPlacements) {
    const placement = validateOccupiedPlacement(rawPlacement);
    addPlacementToBuckets(buckets, placement);
    const candidate = inspectForestOwnerGrovePlacementCandidate({
      worldSeed,
      placementSlot: placement.placementSlot,
    });
    if (candidate.microGroveNodeKey && candidate.enabled) {
      microGroveAnchors.set(
        candidate.microGroveNodeKey,
        candidate.microGroveAnchor,
      );
    }
  }

  return { buckets, microGroveAnchors };
}

function groveAnchorConflicts(state, candidate) {
  const config = FOREST_OWNER_GROVE_PLACEMENT_CONFIG;
  if (state.microGroveAnchors.has(candidate.microGroveNodeKey)) return false;

  for (const anchor of state.microGroveAnchors.values()) {
    if (Math.hypot(
      anchor.worldX - candidate.microGroveAnchor.worldX,
      anchor.worldY - candidate.microGroveAnchor.worldY,
    ) < config.minimumMicroGroveAnchorSpacing) return true;
  }

  return false;
}

function openCandidateEntersGroveBuffer(state, candidate) {
  const radius = FOREST_OWNER_GROVE_PLACEMENT_CONFIG.microGroveOpeningRadius;

  for (const anchor of state.microGroveAnchors.values()) {
    if (Math.hypot(
      anchor.worldX - candidate.worldX,
      anchor.worldY - candidate.worldY,
    ) < radius) return true;
  }

  return false;
}

function acceptedPlacement(candidate) {
  return Object.freeze({
    placementVersion: FOREST_OWNER_GROVE_PLACEMENT_VERSION,
    placementSlot: candidate.placementSlot,
    worldX: candidate.worldX,
    worldY: candidate.worldY,
  });
}

export function allocateForestOwnerGrovePlacements({
  worldSeed,
  nextCandidateSlot = 0,
  count,
  occupiedPlacements = [],
  isExcluded = () => false,
  maximumCandidateChecks,
}) {
  const seed = validateWorldSeed(worldSeed);
  const config = FOREST_OWNER_GROVE_PLACEMENT_CONFIG;
  const startingSlot = boundedInteger(
    nextCandidateSlot,
    'nextCandidateSlot',
    0,
    config.maximumPlacementSlot,
  );
  const requestedCount = boundedInteger(
    count,
    'count',
    1,
    config.maximumBatchSize,
  );
  if (typeof isExcluded !== 'function') {
    fail('INVALID_PLACEMENT_INPUT', 'isExcluded must be a function');
  }
  const checkLimit = maximumCandidateChecks === undefined
    ? Math.min(config.maximumCandidateChecks, requestedCount * 128)
    : boundedInteger(
      maximumCandidateChecks,
      'maximumCandidateChecks',
      requestedCount,
      config.maximumCandidateChecks,
    );
  const state = buildPlacementState(seed, occupiedPlacements);
  const placements = [];
  const rejectedGroveNodes = new Set();
  const diagnostics = {
    inspectedCandidateCount: 0,
    unusedNodeCandidateCount: 0,
    clearingRejectionCount: 0,
    exclusionRejectionCount: 0,
    spacingRejectionCount: 0,
    groveSeparationRejectionCount: 0,
    groveBufferRejectionCount: 0,
  };
  let candidateSlot = startingSlot;

  while (
    placements.length < requestedCount
    && diagnostics.inspectedCandidateCount < checkLimit
    && candidateSlot <= config.maximumPlacementSlot
  ) {
    const candidate = inspectForestOwnerGrovePlacementCandidate({
      worldSeed: seed,
      placementSlot: candidateSlot,
    });
    candidateSlot += 1;
    diagnostics.inspectedCandidateCount += 1;

    if (!candidate.enabled) {
      diagnostics.unusedNodeCandidateCount += 1;
      continue;
    }
    if (!candidate.clearsCenter) {
      diagnostics.clearingRejectionCount += 1;
      continue;
    }
    if (candidate.microGroveNodeKey) {
      if (rejectedGroveNodes.has(candidate.microGroveNodeKey)) {
        diagnostics.groveSeparationRejectionCount += 1;
        continue;
      }
      if (groveAnchorConflicts(state, candidate)) {
        rejectedGroveNodes.add(candidate.microGroveNodeKey);
        diagnostics.groveSeparationRejectionCount += 1;
        continue;
      }
    } else if (openCandidateEntersGroveBuffer(state, candidate)) {
      diagnostics.groveBufferRejectionCount += 1;
      continue;
    }
    const excluded = isExcluded(candidate);
    if (typeof excluded !== 'boolean') {
      fail(
        'INVALID_PLACEMENT_DEPENDENCY',
        'isExcluded must return a boolean',
      );
    }
    if (excluded) {
      diagnostics.exclusionRejectionCount += 1;
      continue;
    }
    if (hasPlacementWithin(
      state.buckets,
      candidate,
      config.minimumTreeSpacing,
    )) {
      diagnostics.spacingRejectionCount += 1;
      continue;
    }

    const placement = acceptedPlacement(candidate);
    placements.push(placement);
    addPlacementToBuckets(state.buckets, placement);
    if (candidate.microGroveNodeKey) {
      state.microGroveAnchors.set(
        candidate.microGroveNodeKey,
        candidate.microGroveAnchor,
      );
    }
  }

  if (placements.length !== requestedCount) {
    fail(
      'PLACEMENT_SEARCH_EXHAUSTED',
      `Could place only ${placements.length} of ${requestedCount} requested trees`,
    );
  }

  return Object.freeze({
    placementVersion: FOREST_OWNER_GROVE_PLACEMENT_VERSION,
    startingCandidateSlot: startingSlot,
    nextCandidateSlot: candidateSlot,
    placements: Object.freeze(placements),
    diagnostics: Object.freeze({
      ...diagnostics,
      acceptedPlacementCount: placements.length,
      termination: 'requested-count-reached',
    }),
  });
}

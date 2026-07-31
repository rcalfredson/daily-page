const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2})?$/i;
const SUPPORTED_AUTHORSHIP_STATES = new Set(['live', 'deleted-author', 'anonymous']);
const SUPPORTED_STATUSES = new Set(['in-progress', 'locked']);
const SUPPORTED_VISIBILITIES = new Set(['public', 'unlisted']);

function asString(value) {
  return value === undefined || value === null ? '' : String(value);
}

function objectIdString(value) {
  const normalized = asString(value);
  return OBJECT_ID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

function validLanguage(value) {
  return typeof value === 'string'
    && value.length >= 2
    && value.length <= 5
    && LANGUAGE_PATTERN.test(value);
}

function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function validRoom(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 120;
}

function reportCount(count, minimumBucketSize) {
  if (count === 0 || count >= minimumBucketSize) return count;
  return `<${minimumBucketSize}`;
}

function reportMap(counts, minimumBucketSize) {
  return Object.fromEntries(
    [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => [key, reportCount(count, minimumBucketSize)])
  );
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function monthLabel(value) {
  return validDate(value) ? value.toISOString().slice(0, 7) : null;
}

function groupState(groups, groupId) {
  if (!groups.has(groupId)) {
    groups.set(groupId, {
      blockCount: 0,
      languages: new Set(),
      liveOwnerIds: new Set(),
      retainedAuthorshipStates: new Set(),
      eligibleOwnerKeys: new Set()
    });
  }
  return groups.get(groupId);
}

function ownerState(owners, ownerId) {
  if (!owners.has(ownerId)) owners.set(ownerId, { groupIds: new Set() });
  return owners.get(ownerId);
}

export function summarizeActivityForestWritingAudit({
  records,
  currentUserIds,
  minimumBucketSize = 5
}) {
  if (!records || typeof records[Symbol.iterator] !== 'function') {
    throw new Error('records must be iterable.');
  }
  if (!currentUserIds || typeof currentUserIds[Symbol.iterator] !== 'function') {
    throw new Error('currentUserIds must be iterable.');
  }
  if (!Number.isInteger(minimumBucketSize) || minimumBucketSize < 3) {
    throw new Error('minimumBucketSize must be an integer of at least 3.');
  }

  const users = new Set([...currentUserIds].map(objectIdString).filter(Boolean));
  const authorshipStates = new Map();
  const statusVisibility = new Map();
  const groupIdentityShapes = new Map();
  const ownershipGroupIdentityShapes = new Map();
  const groups = new Map();
  const eligibleOwnerGroups = new Map();
  const allNonemptyGroupValues = new Set();
  const owners = new Map();
  const malformed = new Map([
    ['invalidBlockIdentity', 0],
    ['missingGroup', 0],
    ['unsupportedGroupIdentity', 0],
    ['missingOrInvalidLanguage', 0],
    ['missingOrInvalidCreationDate', 0],
    ['missingOrInvalidRoom', 0],
    ['unreconstructableCanonicalRoute', 0],
    ['unsupportedAuthorshipState', 0],
    ['invalidOwnerIdentity', 0],
    ['ownerUserMissing', 0],
    ['retainedAuthorshipStillHasOwner', 0]
  ]);
  let totalBlocks = 0;
  let creatorOnlyBlocks = 0;
  let exactLiveOwnerBlocks = 0;
  let eligibleOwnerBlocks = 0;
  let retainedBlocks = 0;
  let earliestEligibleCreation = null;
  let latestEligibleCreation = null;

  for (const record of records) {
    totalBlocks += 1;
    const blockId = objectIdString(record?._id);
    const groupId = objectIdString(record?.groupId);
    const rawGroupId = record?.groupId;
    const userId = objectIdString(record?.userId);
    const state = record?.authorshipState === undefined ? 'live' : record.authorshipState;
    const dateIsValid = validDate(record?.createdAt);
    const roomIsValid = validRoom(record?.roomId);
    const languageIsValid = validLanguage(record?.lang);
    const statusIsSupported = SUPPORTED_STATUSES.has(record?.status);
    const visibilityIsSupported = SUPPORTED_VISIBILITIES.has(record?.visibility);
    const authorshipIsSupported = SUPPORTED_AUTHORSHIP_STATES.has(state);
    const retained = state === 'deleted-author' || state === 'anonymous';

    increment(authorshipStates, authorshipIsSupported ? state : 'unsupported');
    if (!blockId) increment(malformed, 'invalidBlockIdentity');
    if (rawGroupId === undefined || rawGroupId === null || rawGroupId === '') {
      increment(groupIdentityShapes, 'missing');
      increment(malformed, 'missingGroup');
    } else if (groupId) {
      increment(groupIdentityShapes, 'object-id');
      allNonemptyGroupValues.add(String(rawGroupId));
    } else if (typeof rawGroupId === 'string' && UUID_PATTERN.test(rawGroupId)) {
      increment(groupIdentityShapes, 'uuid');
      increment(malformed, 'unsupportedGroupIdentity');
      allNonemptyGroupValues.add(rawGroupId);
    } else if (typeof rawGroupId === 'string') {
      increment(groupIdentityShapes, 'other-string');
      increment(malformed, 'unsupportedGroupIdentity');
      allNonemptyGroupValues.add(rawGroupId);
    } else {
      increment(groupIdentityShapes, 'non-string');
      increment(malformed, 'unsupportedGroupIdentity');
    }
    if (!languageIsValid) increment(malformed, 'missingOrInvalidLanguage');
    if (!dateIsValid) increment(malformed, 'missingOrInvalidCreationDate');
    if (!roomIsValid) increment(malformed, 'missingOrInvalidRoom');
    if (!blockId || !roomIsValid) increment(malformed, 'unreconstructableCanonicalRoute');
    if (!authorshipIsSupported) increment(malformed, 'unsupportedAuthorshipState');

    const hasOwnerEvidence = record?.userId !== undefined
      && record?.userId !== null
      && record?.userId !== '';
    if (hasOwnerEvidence && !userId) increment(malformed, 'invalidOwnerIdentity');
    if (!hasOwnerEvidence && state === 'live') creatorOnlyBlocks += 1;
    if (retained) {
      retainedBlocks += 1;
      if (hasOwnerEvidence) increment(malformed, 'retainedAuthorshipStillHasOwner');
    }

    const currentOwner = userId && users.has(userId);
    if (state === 'live' && userId && !currentOwner) increment(malformed, 'ownerUserMissing');
    if (state === 'live' && currentOwner) exactLiveOwnerBlocks += 1;
    const ownershipShape = state !== 'live'
      ? 'retained'
      : (currentOwner ? 'exact-current-owner' : (hasOwnerEvidence ? 'other-owner-evidence' : 'creator-only'));
    const groupShape = groupId
      ? 'object-id'
      : (typeof rawGroupId === 'string' && UUID_PATTERN.test(rawGroupId)
        ? 'uuid'
        : (rawGroupId ? 'other' : 'missing'));
    increment(ownershipGroupIdentityShapes, `${ownershipShape}/${groupShape}`);

    if (groupId) {
      const group = groupState(groups, groupId);
      group.blockCount += 1;
      if (languageIsValid) group.languages.add(record.lang.toLowerCase());
      if (state === 'live' && currentOwner) group.liveOwnerIds.add(userId);
      if (retained) group.retainedAuthorshipStates.add(state);
    }

    const eligible = Boolean(
      blockId
      && groupId
      && languageIsValid
      && dateIsValid
      && roomIsValid
      && authorshipIsSupported
      && state === 'live'
      && currentOwner
      && statusIsSupported
      && visibilityIsSupported
    );
    if (!eligible) continue;

    eligibleOwnerBlocks += 1;
    increment(statusVisibility, `${record.status}/${record.visibility}`);
    ownerState(owners, userId).groupIds.add(groupId);
    const ownerGroupKey = `${userId}:${groupId}`;
    if (!eligibleOwnerGroups.has(ownerGroupKey)) {
      eligibleOwnerGroups.set(ownerGroupKey, {
        variantCount: 0,
        languages: new Set(),
        creationTimes: []
      });
    }
    const ownerGroup = eligibleOwnerGroups.get(ownerGroupKey);
    ownerGroup.variantCount += 1;
    ownerGroup.languages.add(record.lang.toLowerCase());
    ownerGroup.creationTimes.push(record.createdAt.getTime());
    const group = groupState(groups, groupId);
    group.eligibleOwnerKeys.add(ownerGroupKey);
    if (!earliestEligibleCreation || record.createdAt < earliestEligibleCreation) {
      earliestEligibleCreation = record.createdAt;
    }
    if (!latestEligibleCreation || record.createdAt > latestEligibleCreation) {
      latestEligibleCreation = record.createdAt;
    }
  }

  const eligibleOwnerGroupCount = [...groups.values()].reduce(
    (sum, group) => sum + group.eligibleOwnerKeys.size,
    0
  );
  const groupSizeCounts = new Map();
  let multilingualGroupCount = 0;
  let multiOwnerGroupCount = 0;
  let retainedMixedGroupCount = 0;
  for (const group of groups.values()) {
    increment(groupSizeCounts, String(group.blockCount));
    if (group.languages.size > 1) multilingualGroupCount += 1;
    if (group.liveOwnerIds.size > 1) multiOwnerGroupCount += 1;
    if (group.retainedAuthorshipStates.size && group.liveOwnerIds.size) {
      retainedMixedGroupCount += 1;
    }
  }
  const ownerGroupVariantSizeCounts = new Map();
  let multilingualOwnerGroupCount = 0;
  let foundingTimestampTieCount = 0;
  for (const ownerGroup of eligibleOwnerGroups.values()) {
    increment(ownerGroupVariantSizeCounts, String(ownerGroup.variantCount));
    if (ownerGroup.languages.size > 1) multilingualOwnerGroupCount += 1;
    if (ownerGroup.creationTimes.length > 1) {
      const earliest = Math.min(...ownerGroup.creationTimes);
      if (ownerGroup.creationTimes.filter(value => value === earliest).length > 1) {
        foundingTimestampTieCount += 1;
      }
    }
  }

  const groupCountsByOwner = [...owners.values()]
    .map(owner => owner.groupIds.size)
    .sort((left, right) => left - right);
  const largeOwnerHistoryCount = groupCountsByOwner.filter(count => count >= 100).length;
  const ownerDistributionReport = owners.size >= minimumBucketSize
    ? {
      owners: owners.size,
      minimumGroups: groupCountsByOwner[0],
      medianGroups: percentile(groupCountsByOwner, 0.5),
      p90Groups: percentile(groupCountsByOwner, 0.9),
      maximumGroups: groupCountsByOwner.at(-1),
      ownersWithAtLeast100Groups: reportCount(largeOwnerHistoryCount, minimumBucketSize)
    }
    : {
      owners: reportCount(owners.size, minimumBucketSize),
      distribution: 'suppressed-small-owner-population'
    };

  return {
    reportVersion: 1,
    privacy: {
      minimumBucketSize,
      smallNonzeroBuckets: `reported as <${minimumBucketSize}`,
      identifiersOrContentEmitted: false,
      creationRangePrecision: 'month'
    },
    totals: {
      users: users.size,
      blocks: totalBlocks,
      nonemptyTranslationGroupValues: allNonemptyGroupValues.size,
      policyValidTranslationGroups: groups.size,
      creatorOnlyBlocks: reportCount(creatorOnlyBlocks, minimumBucketSize),
      exactLiveOwnerBlocks: reportCount(exactLiveOwnerBlocks, minimumBucketSize),
      eligibleOwnerBlocks: reportCount(eligibleOwnerBlocks, minimumBucketSize),
      eligibleOwnerGroups: reportCount(eligibleOwnerGroupCount, minimumBucketSize),
      retainedBlocks: reportCount(retainedBlocks, minimumBucketSize)
    },
    authorshipStates: reportMap(authorshipStates, minimumBucketSize),
    groupIdentityShapes: reportMap(groupIdentityShapes, minimumBucketSize),
    ownershipByGroupIdentityShape: reportMap(
      ownershipGroupIdentityShapes,
      minimumBucketSize
    ),
    eligibleStatusVisibility: reportMap(statusVisibility, minimumBucketSize),
    ownerEligibleGroupDistribution: ownerDistributionReport,
    groupShape: {
      sizeHistogram: reportMap(groupSizeCounts, minimumBucketSize),
      multilingualPolicyValidGroups: reportCount(multilingualGroupCount, minimumBucketSize),
      eligibleOwnerVariantSizeHistogram: reportMap(
        ownerGroupVariantSizeCounts,
        minimumBucketSize
      ),
      eligibleOwnerGroupsWithMultipleOwnerAuthoredLanguages: reportCount(
        multilingualOwnerGroupCount,
        minimumBucketSize
      ),
      groupsSpanningMultipleCurrentOwners: reportCount(multiOwnerGroupCount, minimumBucketSize),
      groupsMixingCurrentAndRetainedAuthorship: reportCount(
        retainedMixedGroupCount,
        minimumBucketSize
      ),
      deterministicFoundingTimestampTies: reportCount(
        foundingTimestampTieCount,
        minimumBucketSize
      )
    },
    eligibleCreationRange: eligibleOwnerBlocks >= minimumBucketSize
      ? {
        earliestMonth: monthLabel(earliestEligibleCreation),
        latestMonth: monthLabel(latestEligibleCreation)
      }
      : 'suppressed-small-eligible-population',
    malformedOrUnsupported: reportMap(malformed, minimumBucketSize)
  };
}

export function assertPrivacySafeActivityForestAudit(report) {
  const pending = [report];
  while (pending.length) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (value && typeof value === 'object') {
      pending.push(...Object.values(value));
      continue;
    }
    if (typeof value === 'string' && (
      OBJECT_ID_PATTERN.test(value)
      || /\/rooms\//u.test(value)
      || /@/u.test(value)
    )) {
      throw new Error('Refusing to emit an Activity Forest audit containing identifying values.');
    }
  }
  return report;
}

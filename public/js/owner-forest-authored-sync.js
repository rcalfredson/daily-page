import { forestReturnTreeId } from './forest-writing-navigation.js';

export const FOREST_AUTHORED_SYNC_RETRY_DELAYS_MS = Object.freeze([250, 750]);

export function forestAuthoredMutationIsAmbiguous(error) {
  return !error?.code || error.code === 'FOREST_AUTHORED_MUTATION_UNAVAILABLE';
}

function annotateFailure(error, { attempts, outcomeUncertain }) {
  const failure = error instanceof Error ? error : new Error('Forest authored mutation failed.');
  failure.syncAttempts = attempts;
  failure.syncOutcomeUncertain = outcomeUncertain;
  return failure;
}

export async function runForestAuthoredMutationWithRetry(execute, {
  retryDelays = FOREST_AUTHORED_SYNC_RETRY_DELAYS_MS,
  wait = delay => new Promise(resolve => globalThis.setTimeout(resolve, delay))
} = {}) {
  if (typeof execute !== 'function' || !Array.isArray(retryDelays)
    || retryDelays.some(delay => !Number.isSafeInteger(delay) || delay < 0)
    || typeof wait !== 'function') {
    throw new TypeError('Invalid forest authored synchronization dependencies.');
  }
  let outcomeUncertain = false;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return { result: await execute(), attempts: attempt + 1 };
    } catch (error) {
      const ambiguous = forestAuthoredMutationIsAmbiguous(error);
      outcomeUncertain ||= ambiguous;
      if (!ambiguous || attempt === retryDelays.length) {
        throw annotateFailure(error, { attempts: attempt + 1, outcomeUncertain });
      }
      await wait(retryDelays[attempt]);
    }
  }
  throw new Error('Forest authored synchronization exhausted unexpectedly.');
}

export function projectForestAuthoredPendingMarker(markersById, pending) {
  if (!(markersById instanceof Map) || !pending?.objectId) {
    throw new TypeError('Invalid forest authored pending projection.');
  }
  if (pending.predictedMarker) {
    markersById.set(pending.objectId, {
      ...pending.predictedMarker,
      syncState: pending.phase === 'failed' ? 'failed' : 'syncing'
    });
  } else {
    markersById.delete(pending.objectId);
  }
  return markersById;
}

export function projectForestAuthoredPendingMarkers(markersById, pendingById) {
  if (!(pendingById instanceof Map)) {
    throw new TypeError('Invalid forest authored pending collection.');
  }
  for (const pending of pendingById.values()) {
    projectForestAuthoredPendingMarker(markersById, pending);
  }
  return markersById;
}

// Transport version 1 omitted schemaVersion; version 2 represents unlinked relationships as null.
export function forestAuthoredClientHasSupportedFormat(object) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return false;
  const version = object.schemaVersion === undefined ? 1 : object.schemaVersion;
  if (![1, 2].includes(version)) return false;
  if (version === 1) return object.writingLink == null;
  const link = object.writingLink;
  return Boolean(link && typeof link === 'object' && !Array.isArray(link)
    && Object.keys(link).length === 2 && link.version === 1
    && typeof link.writingTreeId === 'string'
    && forestReturnTreeId(link.writingTreeId) === link.writingTreeId);
}

export function forestAuthoredCanonicalMatchesPrediction(operation, canonical, predictedMarker) {
  if (operation === 'remove') return canonical?.state === 'removed';
  if (!['create', 'move'].includes(operation) || !canonical || !predictedMarker) return false;
  const worldX = canonical.worldX ?? canonical.placement?.worldX;
  const worldY = canonical.worldY ?? canonical.placement?.worldY;
  const canonicalLink = canonical.writingLink ?? null;
  const predictedLink = predictedMarker.writingLink ?? null;
  if (![canonical, predictedMarker].every(forestAuthoredClientHasSupportedFormat)) return false;
  if (canonicalLink || predictedLink) {
    if (!canonicalLink || !predictedLink || canonicalLink.version !== 1 || predictedLink.version !== 1
      || Object.keys(canonicalLink).length !== 2 || Object.keys(predictedLink).length !== 2
      || forestReturnTreeId(canonicalLink.writingTreeId) !== canonicalLink.writingTreeId
      || canonicalLink.writingTreeId !== predictedLink.writingTreeId) return false;
  }
  return canonical.state !== 'removed'
    && canonical.objectId === predictedMarker.objectId
    && worldX === predictedMarker.worldX
    && worldY === predictedMarker.worldY;
}

export function forestAuthoredFailureResolution({ operation, error, predictedMarker }) {
  if (error?.object && forestAuthoredCanonicalMatchesPrediction(
    operation, error.object, predictedMarker
  )) return 'confirmed';
  if (error?.object) return 'reconciled';
  if (error?.syncOutcomeUncertain) return 'pending';
  return 'rejected';
}

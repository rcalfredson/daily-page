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

export function forestAuthoredCanonicalMatchesPrediction(operation, canonical, predictedMarker) {
  if (operation === 'remove') return canonical?.state === 'removed';
  if (!['create', 'move'].includes(operation) || !canonical || !predictedMarker) return false;
  const worldX = canonical.worldX ?? canonical.placement?.worldX;
  const worldY = canonical.worldY ?? canonical.placement?.worldY;
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

import {
  forestAuthoredCanonicalMatchesPrediction,
  forestAuthoredFailureResolution,
  forestAuthoredMutationIsAmbiguous,
  projectForestAuthoredPendingMarker,
  projectForestAuthoredPendingMarkers,
  runForestAuthoredMutationWithRetry
} from '../public/js/owner-forest-authored-sync.js';

function failure(code) {
  return Object.assign(new Error(code || 'network failure'), code ? { code } : {});
}

describe('owner forest authored client synchronization', () => {
  it('retries only ambiguous failures with the identical operation callback', async () => {
    const execute = jasmine.createSpy('execute');
    execute.and.rejectWith(failure('FOREST_AUTHORED_MUTATION_UNAVAILABLE'));
    execute.withArgs().and.callFake(async () => {
      if (execute.calls.count() < 3) throw failure('FOREST_AUTHORED_MUTATION_UNAVAILABLE');
      return { outcome: 'accepted' };
    });
    const wait = jasmine.createSpy('wait').and.resolveTo();

    const completed = await runForestAuthoredMutationWithRetry(execute, {
      retryDelays: [10, 20], wait
    });

    expect(completed).toEqual({ result: { outcome: 'accepted' }, attempts: 3 });
    expect(execute).toHaveBeenCalledTimes(3);
    expect(wait.calls.allArgs()).toEqual([[10], [20]]);
  });

  it('does not retry an initial authoritative rejection', async () => {
    const execute = jasmine.createSpy('execute').and.rejectWith(
      failure('FOREST_AUTHORED_PLACEMENT_COLLISION')
    );
    const wait = jasmine.createSpy('wait');

    await expectAsync(runForestAuthoredMutationWithRetry(execute, { wait }))
      .toBeRejectedWith(jasmine.objectContaining({
        code: 'FOREST_AUTHORED_PLACEMENT_COLLISION',
        syncAttempts: 1,
        syncOutcomeUncertain: false
      }));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('retains uncertainty when a retry receives a definitive response', async () => {
    const errors = [failure(), failure('FOREST_AUTHORED_MUTATION_RATE_LIMITED')];
    const execute = jasmine.createSpy('execute').and.callFake(async () => {
      throw errors.shift();
    });

    await expectAsync(runForestAuthoredMutationWithRetry(execute, {
      retryDelays: [0], wait: async () => {}
    })).toBeRejectedWith(jasmine.objectContaining({
      code: 'FOREST_AUTHORED_MUTATION_RATE_LIMITED',
      syncAttempts: 2,
      syncOutcomeUncertain: true
    }));
  });

  it('projects syncing and failed creates or moves over region state', () => {
    const markers = new Map([['confirmed', { objectId: 'confirmed' }]]);
    const pending = new Map([
      ['created', {
        objectId: 'created',
        phase: 'syncing',
        predictedMarker: { objectId: 'created', worldX: 1, worldY: 2 }
      }],
      ['moved', {
        objectId: 'moved',
        phase: 'failed',
        predictedMarker: { objectId: 'moved', worldX: 3, worldY: 4 }
      }]
    ]);

    projectForestAuthoredPendingMarkers(markers, pending);

    expect(markers.get('created')).toEqual(jasmine.objectContaining({ syncState: 'syncing' }));
    expect(markers.get('moved')).toEqual(jasmine.objectContaining({ syncState: 'failed' }));
    expect(markers.has('confirmed')).toBeTrue();
  });

  it('projects a predicted removal by hiding its confirmed marker', () => {
    const markers = new Map([['removed', { objectId: 'removed', recordRevision: 2 }]]);

    projectForestAuthoredPendingMarker(markers, {
      objectId: 'removed', operation: 'remove', phase: 'syncing', predictedMarker: null
    });

    expect(markers.has('removed')).toBeFalse();
  });

  it('recognizes canonical acknowledgements of predicted state', () => {
    const predicted = { objectId: 'marker', worldX: 10, worldY: -20 };

    expect(forestAuthoredCanonicalMatchesPrediction('move', {
      objectId: 'marker', state: 'active', placement: { worldX: 10, worldY: -20 }
    }, predicted)).toBeTrue();
    expect(forestAuthoredCanonicalMatchesPrediction('move', {
      objectId: 'marker', state: 'active', worldX: 11, worldY: -20
    }, predicted)).toBeFalse();
    expect(forestAuthoredCanonicalMatchesPrediction('remove', {
      objectId: 'marker', state: 'removed'
    }, null)).toBeTrue();
  });

  it('classifies only transport and generic unavailable failures as ambiguous', () => {
    expect(forestAuthoredMutationIsAmbiguous(failure())).toBeTrue();
    expect(forestAuthoredMutationIsAmbiguous(
      failure('FOREST_AUTHORED_MUTATION_UNAVAILABLE')
    )).toBeTrue();
    expect(forestAuthoredMutationIsAmbiguous(
      failure('FOREST_AUTHORED_OBJECT_CONFLICT')
    )).toBeFalse();
  });

  it('lets canonical evidence resolve an otherwise uncertain outcome', () => {
    const predictedMarker = { objectId: 'marker', worldX: 10, worldY: 20 };

    expect(forestAuthoredFailureResolution({
      operation: 'move',
      predictedMarker,
      error: {
        syncOutcomeUncertain: true,
        object: { objectId: 'marker', state: 'active', worldX: 10, worldY: 20 }
      }
    })).toBe('confirmed');
    expect(forestAuthoredFailureResolution({
      operation: 'move',
      predictedMarker,
      error: {
        syncOutcomeUncertain: true,
        object: { objectId: 'marker', state: 'active', worldX: 9, worldY: 20 }
      }
    })).toBe('reconciled');
    expect(forestAuthoredFailureResolution({
      operation: 'move', predictedMarker, error: { syncOutcomeUncertain: true }
    })).toBe('pending');
    expect(forestAuthoredFailureResolution({
      operation: 'move', predictedMarker, error: { syncOutcomeUncertain: false }
    })).toBe('rejected');
  });
});

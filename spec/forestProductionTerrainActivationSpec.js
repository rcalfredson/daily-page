import { parseProductionTerrainArgs, productionTerrainAction, runProductionTerrainOperation }
  from '../scripts/forest/activateProductionTerrain.js';

describe('single-account production terrain activation', () => {
  const ownerUserId = '64b00000000000000000a071';
  const args = ['roberto.c.alfredo', '--authorized-production-read'];
  const world = terrain => ({ status: 'active', reconciliation: { state: 'idle' }, terrain });
  const active = (extra = {}) => ({ generationVersion: 4, state: 'active', phase: 'ready', ...extra });
  const preparing = (phase = 'trees') => ({ generationVersion: 4, state: 'preparing', phase });

  it('defaults to read-only and requires explicit production access', () => {
    expect(parseProductionTerrainArgs(args)).toEqual({ username: args[0], write: false,
      confirmOwner: undefined, cancel: false });
    expect(() => parseProductionTerrainArgs([args[0]])).toThrowError(/authorized-production-read/);
  });

  it('requires an owner confirmation for writes and rejects malformed or ambiguous flags', () => {
    expect(() => parseProductionTerrainArgs([...args, '--write'])).toThrowError(/confirm-owner/);
    expect(parseProductionTerrainArgs([...args, '--write', `--confirm-owner=${ownerUserId}`]).confirmOwner).toBe(ownerUserId);
    for (const flags of [['--all'], ['--write', '--write'], ['--cancel'], ['--confirm-owner='],
      ['--write', '--confirm-owner=bad'], ['--write', `--confirm-owner=${ownerUserId}`, '--confirm-owner=bad']]) {
      expect(() => parseProductionTerrainArgs([...args, ...flags])).toThrow();
    }
  });

  it('selects fresh activation, upgrade, resume, publication and retired cleanup', () => {
    expect(productionTerrainAction(world())).toBe('start');
    expect(productionTerrainAction(world(active({ generationVersion: 3 })))).toBe('upgrade');
    expect(productionTerrainAction(world(preparing()))).toBe('step');
    expect(productionTerrainAction(world(preparing('ready')))).toBe('publish');
    expect(productionTerrainAction(world(active({ generationVersion: 3, replacement: preparing() })))).toBe('step');
    expect(productionTerrainAction(world(active({ retiredActivationId: 'old' })))).toBe('cleanup');
    expect(productionTerrainAction(world(active()))).toBeNull();
  });

  it('refuses missing, deleting, reconciling or incompatible unfinished worlds', () => {
    expect(() => productionTerrainAction(null)).toThrow();
    expect(() => productionTerrainAction({ status: 'deleting' })).toThrow();
    expect(() => productionTerrainAction({ ...world(), reconciliation: { state: 'running' } })).toThrow();
    expect(() => productionTerrainAction(world({ ...preparing(), generationVersion: 3 }))).toThrow();
    expect(() => productionTerrainAction(world({ ...preparing(), state: 'cancelling' }))).toThrow();
  });

  it('cancels only unfinished work, including older-generation preparation', () => {
    expect(productionTerrainAction(world({ ...preparing(), generationVersion: 3 }), true)).toBe('cancel');
    expect(productionTerrainAction(world(active({ generationVersion: 3, replacement: preparing() })), true)).toBe('cancel');
    expect(() => productionTerrainAction(world(active()), true)).toThrowError(/cannot be cancelled/);
    expect(() => productionTerrainAction(world(), true)).toThrow();
  });

  it('uses owner-scoped service calls through verification, publication and cleanup', async () => {
    const advance = jasmine.createSpy().and.returnValues(
      Promise.resolve(preparing()), Promise.resolve(preparing('verify')),
      Promise.resolve(preparing('ready')), Promise.resolve(active({ retiredActivationId: 'old' })),
      Promise.resolve(active()));
    const result = await runProductionTerrainOperation({ ownerUserId, action: 'upgrade', advance });
    expect(result.complete).toBeTrue();
    expect(advance.calls.allArgs()).toEqual(['upgrade', 'step', 'step', 'publish', 'cleanup']
      .map(action => [{ ownerUserId, action, generationVersion: 4 }]));
  });

  it('bounds work and allows resumption without publishing before ready', async () => {
    const advance = jasmine.createSpy().and.resolveTo(preparing('verify'));
    const result = await runProductionTerrainOperation({ ownerUserId, action: 'step', advance, maxSteps: 2 });
    expect(result.complete).toBeFalse();
    expect(advance).toHaveBeenCalledTimes(2);
    expect(advance.calls.allArgs().every(([input]) => input.action === 'step')).toBeTrue();
  });

  it('finishes cancellation without starting or publishing terrain', async () => {
    const advance = jasmine.createSpy().and.returnValues(
      Promise.resolve({ ...preparing(), state: 'cancelling' }), Promise.resolve(null));
    expect((await runProductionTerrainOperation({ ownerUserId, action: 'cancel', advance })).complete).toBeTrue();
    expect(advance.calls.allArgs().every(([input]) => input.action === 'cancel')).toBeTrue();
  });

  it('stops on service failure without proceeding to publication', async () => {
    const advance = jasmine.createSpy().and.rejectWith(new Error('access failed'));
    await expectAsync(runProductionTerrainOperation({ ownerUserId, action: 'step', advance }))
      .toBeRejectedWithError('access failed');
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it('rejects unexpected service state and never reactivates an already active world', async () => {
    for (const result of [null, active({ generationVersion: 3 }), { ...preparing(), state: 'cancelling' }]) {
      await expectAsync(runProductionTerrainOperation({ ownerUserId, action: 'step',
        advance: async () => result })).toBeRejected();
    }
    const advance = jasmine.createSpy();
    expect((await runProductionTerrainOperation({ ownerUserId, action: null, advance })).complete).toBeTrue();
    expect(advance).not.toHaveBeenCalled();
  });
});

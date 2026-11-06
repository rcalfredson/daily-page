import { inspectForestAuthoredWritingLink } from '../server/services/forestAuthoredWritingLink.js';

const OWNER = '507f1f77bcf86cd799439011';
const FOREST = '11111111-1111-4111-8111-111111111111';
const TREE = '33333333-3333-4333-8333-333333333333';
const GROUP = '507f191e810c19729de860ea';
const LINK = { version: 1, writingTreeId: TREE };

function tree(overrides = {}) {
  return {
    schemaVersion: 1, identityVersion: 1, writingTreeId: TREE, forestId: FOREST, ownerUserId: OWNER,
    translationGroupId: GROUP, sourceState: 'active', hiddenFromForest: false, recordRevision: 1,
    foundingSource: { blockId: '507f1f77bcf86cd799439013' },
    placement: { policyVersion: 1, worldX: -720, worldY: 720 },
    placementIndex: { version: 1, cellX: -1, cellY: 1 },
    projection: {
      revision: 1, schemaVersion: 1, mappingVersion: 1, specimenSeed: 123456,
      phenotypeId: 'open-crown-deciduous', phenotypeAssetVersion: 2, creationSeason: 'spring',
      foliagePaletteId: 'meadow-green', projectionFingerprint: 'mapping-v1:fixture-projection',
      visualFingerprint: 'mapping-v1:foliage-meadow-green'
    }, ...overrides
  };
}

function harness({ stored = tree(), classification = 'eligible' } = {}) {
  const query = { session: jasmine.createSpy('session'), lean: jasmine.createSpy('lean').and.resolveTo(stored) };
  query.session.and.returnValue(query);
  const Model = { findOne: jasmine.createSpy('findOne').and.returnValue(query) };
  const readGroupEvidence = jasmine.createSpy('readGroupEvidence').and.resolveTo({ classification });
  return {
    Model, query, readGroupEvidence,
    inspect: (overrides = {}) => inspectForestAuthoredWritingLink({
      ownerUserId: OWNER, world: { forestId: FOREST }, writingLink: LINK,
      worldX: -720, worldY: 800, session: 'creation-transaction',
      ForestWritingTreeModel: Model, readGroupEvidence, ...overrides
    })
  };
}

describe('transaction-bound authored writing source', () => {
  it('uses exact owner/world/tree authority and the same transaction for current eligibility', async () => {
    const test = harness();
    expect(await test.inspect()).toEqual(LINK);
    expect(test.Model.findOne).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER, forestId: FOREST, writingTreeId: TREE,
      sourceState: 'active', hiddenFromForest: false
    });
    expect(test.query.session).toHaveBeenCalledOnceWith('creation-transaction');
    expect(test.readGroupEvidence).toHaveBeenCalledOnceWith({
      ownerUserId: OWNER, translationGroupId: GROUP, session: 'creation-transaction'
    });
  });

  it('requires a transaction before looking up any private source', async () => {
    const test = harness();
    await expectAsync(test.inspect({ session: null })).toBeRejectedWithError('AUTHORED_WRITING_TRANSACTION_REQUIRED');
    expect(test.Model.findOne).not.toHaveBeenCalled();
  });

  it('rejects absent, hidden, inactive, foreign and unsupported tree identity without source details', async () => {
    for (const stored of [null, tree({ hiddenFromForest: true }), tree({ sourceState: 'inactive' }),
      tree({ ownerUserId: '507f1f77bcf86cd799439012' }), tree({ schemaVersion: 9 }),
      tree({ projection: {} }), tree({ placementIndex: { version: 1, cellX: 0, cellY: 0 } })]) {
      const test = harness({ stored });
      await expectAsync(test.inspect()).toBeRejectedWithError('AUTHORED_WRITING_UNAVAILABLE');
      expect(test.readGroupEvidence).not.toHaveBeenCalled();
    }
  });

  it('requires current eligible owner writing, including unresolved or over-budget evidence', async () => {
    for (const classification of ['ineligible', 'unresolved']) {
      await expectAsync(harness({ classification }).inspect()).toBeRejectedWithError('AUTHORED_WRITING_UNAVAILABLE');
    }
  });

  it('enforces the exact initial neighborhood boundary across signed cells', async () => {
    const test = harness();
    await expectAsync(test.inspect({ worldX: -880, worldY: 720 })).toBeResolved();
    await expectAsync(test.inspect({ worldX: -881, worldY: 720 })).toBeRejectedWithError('AUTHORED_WRITING_DISTANCE');
  });
});

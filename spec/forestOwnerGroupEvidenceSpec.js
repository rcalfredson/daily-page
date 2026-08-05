import {
  buildForestOwnerGroupEvidenceReader,
  FOREST_OWNER_GROUP_EVIDENCE_BLOCK_PROJECTION,
  FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS,
  FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES,
} from '../server/services/forestOwnerGroupEvidence.js';

const OWNER_USER_ID = '507f1f77bcf86cd799439011';
const GROUP_ID = '507f191e810c19729de860ea';
const BLOCK_ID = '507f1f77bcf86cd799439012';

function query(value) {
  const chain = {
    sort: jasmine.createSpy('sort').and.callFake(() => chain),
    limit: jasmine.createSpy('limit').and.callFake(() => chain),
    session: jasmine.createSpy('session').and.callFake(() => chain),
    lean: jasmine.createSpy('lean').and.resolveTo(value),
  };
  return chain;
}

function block(overrides = {}) {
  return {
    _id: BLOCK_ID,
    userId: OWNER_USER_ID,
    authorshipState: 'live',
    groupId: GROUP_ID,
    lang: 'en',
    status: 'locked',
    visibility: 'public',
    createdAt: new Date('2024-06-15T10:30:00.000Z'),
    roomId: 'daily',
    ...overrides,
  };
}

function harness({ eligible = block(), fallback = [] } = {}) {
  const eligibleQuery = query(eligible);
  const fallbackQuery = query(fallback);
  const BlockModel = {
    findOne: jasmine.createSpy('findOne').and.returnValue(eligibleQuery),
    find: jasmine.createSpy('find').and.returnValue(fallbackQuery),
  };
  return {
    reader: buildForestOwnerGroupEvidenceReader({ BlockModel, rowLimit: 2 }),
    BlockModel,
    eligibleQuery,
    fallbackQuery,
  };
}

describe('forest owner-group evidence reader', () => {
  it('uses one indexed exact-owner query for the deterministic eligible founder', async () => {
    const test = harness();

    const evidence = await test.reader({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      session: 'transaction-session',
    });

    expect(evidence.classification)
      .toBe(FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.ELIGIBLE);
    expect(evidence.foundingVariant).toEqual(jasmine.objectContaining({
      blockId: BLOCK_ID,
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      createdAt: '2024-06-15T10:30:00.000Z',
    }));
    const [filter, projection] = test.BlockModel.findOne.calls.first().args;
    expect(filter).toEqual(jasmine.objectContaining({
      userId: OWNER_USER_ID,
      groupId: GROUP_ID,
    }));
    expect(filter.$and).toContain(jasmine.objectContaining({
      status: { $in: ['in-progress', 'locked'] },
    }));
    expect(projection).toBe(FOREST_OWNER_GROUP_EVIDENCE_BLOCK_PROJECTION);
    expect(test.eligibleQuery.sort).toHaveBeenCalledOnceWith({ createdAt: 1, _id: 1 });
    expect(test.eligibleQuery.session).toHaveBeenCalledOnceWith('transaction-session');
    expect(test.BlockModel.find).not.toHaveBeenCalled();
  });

  it('proves a bounded exact-owner group has no eligible variants', async () => {
    const test = harness({
      eligible: null,
      fallback: [block({ authorshipState: 'deleted-author' })],
    });

    const evidence = await test.reader({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      session: 'transaction-session',
    });

    expect(evidence.classification)
      .toBe(FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.INELIGIBLE);
    expect(evidence.reasonCode)
      .toBe(FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES.NO_ELIGIBLE_OWNER_VARIANT);
    expect(evidence.diagnostics).toEqual({
      scannedBlockCount: 1,
      rowLimitReached: false,
    });
    expect(test.fallbackQuery.limit).toHaveBeenCalledOnceWith(3);
    expect(test.fallbackQuery.session).toHaveBeenCalledOnceWith('transaction-session');
  });

  it('fails closed for malformed evidence or a group beyond the inspection bound', async () => {
    const malformed = harness({
      eligible: null,
      fallback: [block({ lang: 'not a language' })],
    });
    const malformedEvidence = await malformed.reader({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      session: 'transaction-session',
    });
    expect(malformedEvidence.classification)
      .toBe(FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.UNRESOLVED);
    expect(malformedEvidence.reasonCode).toBe('invalid-language');

    const oversized = harness({
      eligible: null,
      fallback: [
        block({ _id: '507f1f77bcf86cd799439013', authorshipState: 'deleted-author' }),
        block({ _id: '507f1f77bcf86cd799439014', authorshipState: 'anonymous' }),
        block({ _id: '507f1f77bcf86cd799439015', authorshipState: 'deleted-author' }),
      ],
    });
    const oversizedEvidence = await oversized.reader({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
      session: 'transaction-session',
    });
    expect(oversizedEvidence.classification)
      .toBe(FOREST_OWNER_GROUP_EVIDENCE_CLASSIFICATIONS.UNRESOLVED);
    expect(oversizedEvidence.reasonCode)
      .toBe(FOREST_OWNER_GROUP_EVIDENCE_REASON_CODES.ROW_LIMIT_EXCEEDED);
    expect(oversizedEvidence.diagnostics.rowLimitReached).toBeTrue();
  });

  it('rejects invalid identities, sessions, bounds, and dependencies', async () => {
    const test = harness();
    await expectAsync(test.reader({
      ownerUserId: 'owner',
      translationGroupId: GROUP_ID,
      session: 'session',
    })).toBeRejectedWithError(/canonical ObjectId/);
    await expectAsync(test.reader({
      ownerUserId: OWNER_USER_ID,
      translationGroupId: GROUP_ID,
    })).toBeRejectedWithError(/transaction session/);
    expect(() => buildForestOwnerGroupEvidenceReader({
      BlockModel: {},
    })).toThrowError(/findOne and BlockModel.find/);
    expect(() => buildForestOwnerGroupEvidenceReader({
      BlockModel: test.BlockModel,
      rowLimit: 101,
    })).toThrowError(/rowLimit/);
  });
});

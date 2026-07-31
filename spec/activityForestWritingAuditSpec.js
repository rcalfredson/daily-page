import {
  assertPrivacySafeActivityForestAudit,
  summarizeActivityForestWritingAudit
} from '../scripts/lib/activityForestWritingAudit.js';

const OWNER_A = '64b000000000000000000001';
const OWNER_B = '64b000000000000000000002';

function block(ordinal, overrides = {}) {
  return {
    _id: `65b0000000000000000000${String(ordinal).padStart(2, '0')}`,
    userId: OWNER_A,
    authorshipState: 'live',
    groupId: `66b0000000000000000000${String(ordinal).padStart(2, '0')}`,
    lang: 'en',
    status: 'locked',
    visibility: 'public',
    createdAt: new Date(`2026-01-${String(ordinal).padStart(2, '0')}T00:00:00.000Z`),
    roomId: 'history',
    ...overrides
  };
}

describe('Activity Forest production writing audit', () => {
  it('classifies exact owners, retained writing, multilingual groups, and malformed evidence', () => {
    const sharedGroup = '66b000000000000000000099';
    const records = [
      block(1, { groupId: sharedGroup }),
      block(2, { groupId: sharedGroup, lang: 'es', userId: OWNER_B }),
      block(3, {
        groupId: sharedGroup,
        lang: 'fr',
        userId: undefined,
        authorshipState: 'deleted-author'
      }),
      block(4, { userId: undefined }),
      block(5, { lang: 'not-a-language' })
    ];

    const report = summarizeActivityForestWritingAudit({
      records,
      currentUserIds: [OWNER_A, OWNER_B],
      minimumBucketSize: 3
    });

    expect(report.totals.blocks).toBe(5);
    expect(report.totals.eligibleOwnerBlocks).toBe('<3');
    expect(report.groupShape.multilingualPolicyValidGroups).toBe('<3');
    expect(report.groupShape.eligibleOwnerGroupsWithMultipleOwnerAuthoredLanguages).toBe(0);
    expect(report.groupShape.groupsSpanningMultipleCurrentOwners).toBe('<3');
    expect(report.groupShape.groupsMixingCurrentAndRetainedAuthorship).toBe('<3');
    expect(report.malformedOrUnsupported.missingOrInvalidLanguage).toBe('<3');
    expect(report.totals.creatorOnlyBlocks).toBe('<3');
    expect(report.groupIdentityShapes['object-id']).toBe(5);
    expect(report.ownershipByGroupIdentityShape['exact-current-owner/object-id']).toBe(3);
  });

  it('reports an owner distribution only when enough owners exist', () => {
    const records = [1, 2, 3].map((ordinal) => block(ordinal, {
      userId: `64b0000000000000000000${ordinal + 10}`
    }));
    const currentUserIds = records.map(record => record.userId);

    const report = summarizeActivityForestWritingAudit({
      records,
      currentUserIds,
      minimumBucketSize: 3
    });

    expect(report.ownerEligibleGroupDistribution).toEqual({
      owners: 3,
      minimumGroups: 1,
      medianGroups: 1,
      p90Groups: 1,
      maximumGroups: 1,
      ownersWithAtLeast100Groups: 0
    });
  });

  it('refuses to emit identifiers, routes, or email-shaped values', () => {
    expect(() => assertPrivacySafeActivityForestAudit({
      accidental: OWNER_A
    })).toThrowError(/identifying values/);
    expect(() => assertPrivacySafeActivityForestAudit({
      accidental: '/rooms/history/blocks/example'
    })).toThrowError(/identifying values/);
    expect(() => assertPrivacySafeActivityForestAudit({
      accidental: 'person@example.com'
    })).toThrowError(/identifying values/);
  });
});

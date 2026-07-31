import {
  BLOCK_PROJECTION,
  buildForestOwnerBlockAdapter,
  FOREST_OWNER_BLOCK_ADAPTER_REASON_CODES,
  FOREST_OWNER_BLOCK_ADAPTER_VERSION,
  FOREST_OWNER_BLOCK_CURSOR_VERSION
} from '../server/services/forestOwnerBlockAdapter.js';

const OWNER_ID = '64b000000000000000000001';
const OTHER_OWNER_ID = '64b000000000000000000002';

function block(ordinal, overrides = {}) {
  return {
    _id: `65b0000000000000000000${String(ordinal).padStart(2, '0')}`,
    userId: OWNER_ID,
    authorshipState: 'live',
    groupId: `66b0000000000000000000${String(ordinal).padStart(2, '0')}`,
    lang: 'en',
    status: 'locked',
    visibility: 'public',
    createdAt: new Date(`2026-04-${String(ordinal).padStart(2, '0')}T00:00:00.000Z`),
    roomId: 'history',
    ...overrides
  };
}

function cursorValue(cursor) {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
}

describe('Activity Forest exact-owner Block adapter', () => {
  it('queries an exact owner with a narrow projection and stable ascending cursor order', async () => {
    const calls = [];
    const adapter = buildForestOwnerBlockAdapter({
      fetchBlockPage: async (options) => {
        calls.push(options);
        return [block(1), block(2), block(3)];
      }
    });

    const result = await adapter({ authenticatedOwnerId: OWNER_ID, limit: 2 });

    expect(calls).toEqual([{
      ownerUserId: OWNER_ID,
      afterBlockId: null,
      limit: 3,
      projection: BLOCK_PROJECTION,
      sort: { _id: 1 }
    }]);
    expect(Object.keys(BLOCK_PROJECTION).sort()).toEqual([
      '_id',
      'authorshipState',
      'createdAt',
      'groupId',
      'lang',
      'roomId',
      'status',
      'userId',
      'visibility'
    ]);
    expect(result.adapterVersion).toBe(FOREST_OWNER_BLOCK_ADAPTER_VERSION);
    expect(result.eligibleBlocks.length).toBe(2);
    expect(result.page.nextCursor).not.toBeNull();
    expect(cursorValue(result.page.nextCursor)).toEqual({
      version: FOREST_OWNER_BLOCK_CURSOR_VERSION,
      afterBlockId: String(block(2)._id)
    });
  });

  it('resumes strictly after the last scanned Block without offset pagination', async () => {
    const firstRows = [block(1), block(2), block(3)];
    const secondCalls = [];
    const firstAdapter = buildForestOwnerBlockAdapter({
      fetchBlockPage: async () => firstRows
    });
    const first = await firstAdapter({ authenticatedOwnerId: OWNER_ID, limit: 2 });
    const secondAdapter = buildForestOwnerBlockAdapter({
      fetchBlockPage: async (options) => {
        secondCalls.push(options);
        return [block(3), block(4)];
      }
    });

    const second = await secondAdapter({
      authenticatedOwnerId: OWNER_ID,
      cursor: first.page.nextCursor,
      limit: 2
    });

    expect(secondCalls[0].afterBlockId).toBe(String(block(2)._id));
    expect(second.eligibleBlocks.map(({ blockId }) => blockId)).toEqual([
      String(block(3)._id),
      String(block(4)._id)
    ]);
    expect(second.page.nextCursor).toBeNull();
  });

  it('applies policy and bounded adapter reason codes without returning excluded records', async () => {
    const adapter = buildForestOwnerBlockAdapter({
      fetchBlockPage: async () => [
        block(1),
        block(2, { authorshipState: 'deleted-author' }),
        block(3, { groupId: 'legacy-group' }),
        block(4, { createdAt: 'not-a-date' }),
        block(5, { roomId: '' })
      ]
    });

    const result = await adapter({ authenticatedOwnerId: OWNER_ID, limit: 5 });

    expect(result.eligibleBlocks.map(({ blockId }) => blockId)).toEqual([
      String(block(1)._id)
    ]);
    expect(result.page.classificationCounts).toEqual({
      eligible: 1,
      ineligible: 1,
      unresolved: 3
    });
    expect(result.page.reasonCounts).toEqual({
      'non-live-authorship': 1,
      'invalid-group-identity': 1,
      [FOREST_OWNER_BLOCK_ADAPTER_REASON_CODES.INVALID_CREATION_DATE]: 1,
      [FOREST_OWNER_BLOCK_ADAPTER_REASON_CODES.INVALID_ROOM_IDENTITY]: 1
    });
  });

  it('returns an explicit empty terminal page', async () => {
    const adapter = buildForestOwnerBlockAdapter({
      fetchBlockPage: async () => []
    });

    const result = await adapter({ authenticatedOwnerId: OWNER_ID });

    expect(result.page).toEqual({
      scannedBlockCount: 0,
      eligibleBlockCount: 0,
      classificationCounts: {
        eligible: 0,
        ineligible: 0,
        unresolved: 0
      },
      reasonCounts: {},
      nextCursor: null
    });
    expect(result.eligibleBlocks).toEqual([]);
  });

  it('rejects foreign owners, malformed cursors, and unbounded page sizes before reading', async () => {
    let readCount = 0;
    const adapter = buildForestOwnerBlockAdapter({
      fetchBlockPage: async () => {
        readCount += 1;
        return [];
      }
    });

    await expectAsync(adapter({
      authenticatedOwnerId: 'not-an-owner'
    })).toBeRejectedWithError(/authenticatedOwnerId/);
    await expectAsync(adapter({
      authenticatedOwnerId: OWNER_ID,
      cursor: Buffer.from(JSON.stringify({
        version: 99,
        afterBlockId: String(block(1)._id)
      })).toString('base64url')
    })).toBeRejectedWithError(/cursor is invalid or unsupported/);
    await expectAsync(adapter({
      authenticatedOwnerId: OWNER_ID,
      limit: 101
    })).toBeRejectedWithError(/limit/);
    expect(readCount).toBe(0);
  });

  it('does not use creator or collaborator evidence as an ownership input', async () => {
    const adapter = buildForestOwnerBlockAdapter({
      fetchBlockPage: async ({ ownerUserId }) => {
        expect(ownerUserId).toBe(OWNER_ID);
        return [
          block(1, {
            userId: OTHER_OWNER_ID,
            creator: 'matching-display-name',
            collaborators: ['matching-display-name']
          })
        ];
      }
    });

    const result = await adapter({ authenticatedOwnerId: OWNER_ID });

    expect(result.eligibleBlocks).toEqual([]);
    expect(result.page.reasonCounts).toEqual({ 'owner-mismatch': 1 });
  });
});

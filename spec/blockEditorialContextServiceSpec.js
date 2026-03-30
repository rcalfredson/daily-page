import Block from '../server/db/models/Block.js';
import { getBlockEditorialContext } from '../server/db/blockEditorialContextService.js';

function makeQueryResult(result) {
  return {
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(result);
    }
  };
}

describe('getBlockEditorialContext', () => {
  afterEach(() => {
    if (Block.find.calls) {
      Block.find.calls.reset();
    }
  });

  it('returns null for ordinary blocks with no editorial metadata', async () => {
    expect(await getBlockEditorialContext({
      _id: '507f1f77bcf86cd799439001',
      roomId: 'physics',
      lang: 'en'
    })).toBeNull();
  });

  it('builds a restrained editorial view model from curated references', async () => {
    spyOn(Block, 'find').and.callFake((filter) => {
      if (filter._id?.$in) {
        return makeQueryResult([
          {
            _id: '507f1f77bcf86cd799439011',
            title: 'Momentum fundamentals',
            roomId: 'physics',
            lang: 'en',
            groupId: 'pillar-group',
            visibility: 'public',
            editorial: { guideTitle: 'Momentum guide', role: 'pillar', sequence: 0 }
          },
          {
            _id: '507f1f77bcf86cd799439012',
            title: 'Impulso lineal',
            roomId: 'physics',
            lang: 'es',
            groupId: 'related-group',
            visibility: 'public',
            editorial: { role: 'companion', sequence: 2 }
          },
          {
            _id: '507f1f77bcf86cd799439013',
            title: 'Hidden note',
            roomId: 'physics',
            lang: 'en',
            groupId: 'hidden-group',
            visibility: 'private',
            editorial: { role: 'texture', sequence: 4 }
          },
          {
            _id: '507f1f77bcf86cd799439014',
            title: 'Other room article',
            roomId: 'math',
            lang: 'en',
            groupId: 'other-room-group',
            visibility: 'public',
            editorial: { role: 'companion', sequence: 5 }
          }
        ]);
      }

      if (filter.groupId?.$in) {
        return makeQueryResult([
          {
            _id: '507f1f77bcf86cd799439022',
            title: 'Linear momentum',
            roomId: 'physics',
            lang: 'en',
            groupId: 'related-group',
            visibility: 'public',
            editorial: { role: 'companion', sequence: 2 }
          }
        ]);
      }

      if (filter['editorial.clusterKey'] === 'momentum-basics') {
        return makeQueryResult([
          {
            _id: '507f1f77bcf86cd799439031',
            title: 'Momentum examples',
            roomId: 'physics',
            lang: 'en',
            groupId: 'cluster-a',
            visibility: 'public',
            createdAt: '2026-01-02T00:00:00.000Z',
            editorial: { role: 'companion', sequence: 3 }
          },
          {
            _id: '507f1f77bcf86cd799439022',
            title: 'Linear momentum',
            roomId: 'physics',
            lang: 'en',
            groupId: 'related-group',
            visibility: 'public',
            createdAt: '2026-01-01T00:00:00.000Z',
            editorial: { role: 'companion', sequence: 2 }
          },
          {
            _id: '507f1f77bcf86cd799439011',
            title: 'Momentum fundamentals',
            roomId: 'physics',
            lang: 'en',
            groupId: 'pillar-group',
            visibility: 'public',
            createdAt: '2025-12-31T00:00:00.000Z',
            editorial: { role: 'pillar', sequence: 0 }
          }
        ]);
      }

      throw new Error(`Unexpected Block.find call: ${JSON.stringify(filter)}`);
    });

    const context = await getBlockEditorialContext({
      _id: '507f1f77bcf86cd799439099',
      roomId: 'physics',
      lang: 'en',
      editorial: {
        clusterKey: 'momentum-basics',
        role: 'texture',
        sequence: 4,
        primaryPillarBlockId: '507f1f77bcf86cd799439011',
        relatedBlockIds: [
          '507f1f77bcf86cd799439012',
          '507f1f77bcf86cd799439013',
          '507f1f77bcf86cd799439014'
        ]
      }
    });

    expect(context).toEqual({
      role: {
        key: 'texture',
        label: 'Texture',
        sequence: 4
      },
      primaryPillar: {
        id: '507f1f77bcf86cd799439011',
        roomId: 'physics',
        title: 'Momentum fundamentals',
        lang: 'en',
        status: null,
        role: 'pillar',
        roleLabel: 'Pillar',
        sequence: 0
      },
      related: [
        {
          id: '507f1f77bcf86cd799439022',
          roomId: 'physics',
          title: 'Linear momentum',
          lang: 'en',
          status: null,
          role: 'companion',
          roleLabel: 'Companion',
          sequence: 2
        }
      ],
      cluster: {
        key: 'momentum-basics',
        label: 'Momentum guide',
        totalItems: 4,
        nearby: [
          {
            id: '507f1f77bcf86cd799439031',
            roomId: 'physics',
            title: 'Momentum examples',
            lang: 'en',
            status: null,
            role: 'companion',
            roleLabel: 'Companion',
            sequence: 3
          }
        ]
      }
    });
  });

  it('falls back to the pillar title when no guide title is available', async () => {
    spyOn(Block, 'find').and.callFake((filter) => {
      if (filter._id?.$in) {
        return makeQueryResult([
          {
            _id: '507f1f77bcf86cd799439211',
            title: 'Forces and motion',
            roomId: 'physics',
            lang: 'en',
            groupId: 'pillar-group',
            visibility: 'public',
            editorial: { role: 'pillar', sequence: 1 }
          }
        ]);
      }

      if (filter['editorial.clusterKey'] === 'forces-path') {
        return makeQueryResult([
          {
            _id: '507f1f77bcf86cd799439212',
            title: 'Net force examples',
            roomId: 'physics',
            lang: 'en',
            groupId: 'cluster-group',
            visibility: 'public',
            createdAt: '2026-01-03T00:00:00.000Z',
            editorial: { role: 'companion', sequence: 2 }
          }
        ]);
      }

      throw new Error(`Unexpected Block.find call: ${JSON.stringify(filter)}`);
    });

    const context = await getBlockEditorialContext({
      _id: '507f1f77bcf86cd799439299',
      title: 'Inertia notes',
      roomId: 'physics',
      lang: 'en',
      editorial: {
        clusterKey: 'forces-path',
        role: 'texture',
        primaryPillarBlockId: '507f1f77bcf86cd799439211'
      }
    });

    expect(context?.cluster?.label).toBe('Forces and motion');
    expect(context?.cluster?.key).toBe('forces-path');
  });
});

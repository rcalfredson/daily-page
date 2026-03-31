import Block from '../server/db/models/Block.js';
import { getRoomEditorialClusters } from '../server/db/roomEditorialClusterService.js';

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

describe('getRoomEditorialClusters', () => {
  afterEach(() => {
    if (Block.find.calls) {
      Block.find.calls.reset();
    }
  });

  it('returns an empty list when the room has no structured editorial blocks', async () => {
    spyOn(Block, 'find').and.returnValue(makeQueryResult([]));

    await expectAsync(getRoomEditorialClusters({
      roomId: 'history',
      preferredLang: 'en'
    })).toBeResolvedTo([]);
  });

  it('surfaces one preferred-language entry point per cluster and prioritizes pillars', async () => {
    spyOn(Block, 'find').and.callFake((filter) => {
      expect(filter.roomId).toBe('physics');
      expect(filter.status).toBe('locked');
      expect(filter.visibility).toBe('public');

      return makeQueryResult([
        {
          _id: '507f1f77bcf86cd799439101',
          title: 'Impulso general',
          roomId: 'physics',
          lang: 'es',
          groupId: 'pillar-group',
          visibility: 'public',
          status: 'locked',
          createdAt: '2026-01-02T00:00:00.000Z',
          editorial: {
            clusterKey: 'momentum-basics',
            guideTitle: 'Momentum starter guide',
            role: 'pillar',
            sequence: 1
          }
        },
        {
          _id: '507f1f77bcf86cd799439102',
          title: 'Momentum overview',
          roomId: 'physics',
          lang: 'en',
          groupId: 'pillar-group',
          visibility: 'public',
          status: 'locked',
          createdAt: '2026-01-03T00:00:00.000Z',
          editorial: {
            clusterKey: 'momentum-basics',
            guideTitle: 'Momentum starter guide',
            role: 'pillar',
            sequence: 1
          }
        },
        {
          _id: '507f1f77bcf86cd799439103',
          title: 'Reading a momentum graph',
          roomId: 'physics',
          lang: 'en',
          groupId: 'companion-group',
          visibility: 'public',
          status: 'locked',
          createdAt: '2026-01-04T00:00:00.000Z',
          editorial: {
            clusterKey: 'momentum-basics',
            guideTitle: 'Momentum starter guide',
            role: 'companion',
            sequence: 2
          }
        },
        {
          _id: '507f1f77bcf86cd799439104',
          title: 'Forces overview',
          roomId: 'physics',
          lang: 'en',
          groupId: 'forces-pillar-group',
          visibility: 'public',
          status: 'locked',
          createdAt: '2026-01-05T00:00:00.000Z',
          editorial: {
            clusterKey: 'forces-path',
            guideTitle: 'Forces starter guide',
            role: 'pillar',
            sequence: 3
          }
        }
      ]);
    });

    await expectAsync(getRoomEditorialClusters({
      roomId: 'physics',
      preferredLang: 'en'
    })).toBeResolvedTo([
      {
        key: 'momentum-basics',
        label: 'Momentum starter guide',
        totalItems: 2,
        hasPillar: true,
        entryPoint: {
          id: '507f1f77bcf86cd799439102',
          roomId: 'physics',
          title: 'Momentum overview',
          lang: 'en',
          role: 'pillar',
          roleLabel: 'Pillar',
          sequence: 1
        }
      },
      {
        key: 'forces-path',
        label: 'Forces starter guide',
        totalItems: 1,
        hasPillar: true,
        entryPoint: {
          id: '507f1f77bcf86cd799439104',
          roomId: 'physics',
          title: 'Forces overview',
          lang: 'en',
          role: 'pillar',
          roleLabel: 'Pillar',
          sequence: 3
        }
      }
    ]);
  });

  it('falls back to the first ordered block when a cluster has no pillar', async () => {
    spyOn(Block, 'find').and.returnValue(makeQueryResult([
      {
        _id: '507f1f77bcf86cd799439201',
        title: 'Listening to the language',
        roomId: 'linguistics',
        lang: 'en',
        groupId: 'cluster-a',
        visibility: 'public',
        status: 'locked',
        createdAt: '2026-01-03T00:00:00.000Z',
        editorial: {
          clusterKey: 'phonetics-path',
          guideTitle: 'Phonetics path',
          role: 'companion',
          sequence: 2
        }
      },
      {
        _id: '507f1f77bcf86cd799439202',
        title: 'Consonant inventory',
        roomId: 'linguistics',
        lang: 'en',
        groupId: 'cluster-b',
        visibility: 'public',
        status: 'locked',
        createdAt: '2026-01-02T00:00:00.000Z',
        editorial: {
          clusterKey: 'phonetics-path',
          guideTitle: 'Phonetics path',
          role: 'companion',
          sequence: 1
        }
      }
    ]));

    const clusters = await getRoomEditorialClusters({
      roomId: 'linguistics',
      preferredLang: 'en'
    });

    expect(clusters).toEqual([
      {
        key: 'phonetics-path',
        label: 'Phonetics path',
        totalItems: 2,
        hasPillar: false,
        entryPoint: {
          id: '507f1f77bcf86cd799439202',
          roomId: 'linguistics',
          title: 'Consonant inventory',
          lang: 'en',
          role: 'companion',
          roleLabel: 'Companion',
          sequence: 1
        }
      }
    ]);
  });
});

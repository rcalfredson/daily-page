import { buildRelatedRecommendationMatch } from '../server/db/blockRecommendationService.js';

describe('block recommendation service', () => {
  it('only surfaces completed, explicitly public posts in the related lane', () => {
    expect(buildRelatedRecommendationMatch({
      _id: 'source-id',
      groupId: 'source-group',
      lang: 'es'
    })).toEqual({
      _id: { $ne: 'source-id' },
      groupId: { $ne: 'source-group' },
      lang: 'es',
      visibility: 'public',
      status: 'locked'
    });
  });
});

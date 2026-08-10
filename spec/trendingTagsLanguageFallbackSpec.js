import Block from '../server/db/models/Block.js';
import { getTrendingTagsWithFallback } from '../server/db/blockService.js';

describe('trending tag language-family aggregation', () => {
  it('resolves the complete family before applying a conceptual source-date window', async () => {
    const aggregateSpy = spyOn(Block, 'aggregate').and.returnValue({
      exec: async () => []
    });

    await getTrendingTagsWithFallback({
      limit: 17,
      minCount: 9876,
      preferredLang: 'ru'
    });

    const pipeline = aggregateSpy.calls.argsFor(0)[0];
    const familyGroupIndex = pipeline.findIndex(stage => stage.$group?._id === '$groupId');
    const familyProjectionIndex = pipeline.findIndex(stage => stage.$project?.groupId === 1);
    const familyDateIndex = pipeline.findIndex(stage => stage.$match?.familyCreatedAt);
    const familyBandIndex = pipeline.findIndex(stage => stage.$addFields?.familyAgeBand);
    const tagsUnwindIndex = pipeline.findIndex(stage => stage.$unwind === '$tags');
    const serialized = JSON.stringify(pipeline);

    expect(pipeline[0].$match).toEqual({
      $or: [
        { visibility: 'public' },
        { visibility: 'unlisted', status: 'locked' }
      ]
    });
    expect(familyGroupIndex).toBeGreaterThan(0);
    expect(familyProjectionIndex).toBeGreaterThan(0);
    expect(familyProjectionIndex).toBeLessThan(familyGroupIndex);
    expect(familyDateIndex).toBeGreaterThan(familyGroupIndex);
    expect(familyBandIndex).toBeGreaterThan(familyDateIndex);
    expect(tagsUnwindIndex).toBeGreaterThan(familyBandIndex);
    expect(serialized).toContain('"familyCreatedAt":"$source.createdAt"');
    expect(serialized).toContain('"$eq":["$$d.lang","ru"]');
    expect(aggregateSpy).toHaveBeenCalledTimes(1);
  });
});

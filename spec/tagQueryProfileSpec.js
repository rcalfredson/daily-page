import {
  parseTagQueryProfileArgs,
  summarizeExplain
} from '../scripts/lib/tagQueryProfile.js';

describe('tag query profile audit', () => {
  it('summarizes index, scan, sort, and execution statistics', () => {
    const summary = summarizeExplain({
      executionStats: {
        executionTimeMillis: 42,
        nReturned: 20,
      totalDocsExamined: 800,
      totalKeysExamined: 900,
      executionStages: {
        stage: 'SORT',
        nReturned: 20,
        executionTimeMillisEstimate: 40,
        usedDisk: true,
          spills: 2,
          inputStage: { stage: 'IXSCAN', indexName: 'tags_1' }
        }
      },
      stages: [{ $group: { _id: '$groupId' }, spills: 1 }]
    });

    expect(summary).toEqual({
      executionTimeMs: 42,
      nReturned: 20,
      docsExamined: 800,
      keysExamined: 900,
      docsPerResult: 40,
      keysPerResult: 45,
      indexes: ['tags_1'],
      planStages: ['$group', 'IXSCAN', 'SORT'],
      stageDetails: [
        {
          stage: 'SORT',
          nReturned: 20,
          executionTimeEstimateMs: 40,
          usedDisk: true,
          spills: 2,
        },
        {
          stage: '$group',
          nReturned: null,
          executionTimeEstimateMs: null,
          usedDisk: false,
          spills: 1,
        },
      ],
      collectionScan: false,
      blockingSort: true,
      usedDisk: true,
      spills: 3,
    });
  });

  it('requires explicit authorization for production reads', () => {
    expect(() => parseTagQueryProfileArgs(['--prod', '--tag', 'performance']))
      .toThrowError(/authorized-production-read/);

    expect(parseTagQueryProfileArgs([
      '--prod',
      '--authorized-production-read',
      '--tag=performance',
      '--timeframe=all',
      '--limit=10',
    ])).toEqual(jasmine.objectContaining({
      prod: true,
      tag: 'performance',
      timeframe: 'all',
      limit: 10,
    }));
  });
});

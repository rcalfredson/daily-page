import {
  buildReadingTrailCandidateAudit,
  parseReadingTrailAuditArgs
} from '../scripts/audits/readingTrailCandidates.js';

describe('reading trail candidate audit', () => {
  function candidate(id, overrides = {}) {
    return {
      _id: id,
      groupId: `group-${id}`,
      roomId: 'physics',
      lang: 'en',
      title: `Post ${id}`,
      description: 'A useful description.',
      tags: ['dimensions'],
      contentLength: 1200,
      ...overrides
    };
  }

  it('requires explicit authorization for production reads', () => {
    expect(() => parseReadingTrailAuditArgs(['--prod']))
      .toThrowError(/--authorized-production-read/);
    expect(parseReadingTrailAuditArgs(['--prod', '--authorized-production-read']).prod)
      .toBeTrue();
  });

  it('summarizes rooms, tags, and reading-guide clusters', () => {
    const report = buildReadingTrailCandidateAudit([
      candidate('a', { editorial: { clusterKey: 'spacetime', guideTitle: 'Spacetime' } }),
      candidate('b'),
      candidate('c', { roomId: 'fiction', tags: ['characters'] })
    ], parseReadingTrailAuditArgs([]));

    expect(report.rooms[0]).toEqual({ value: 'physics', count: 2 });
    expect(report.tags).toContain(jasmine.objectContaining({ value: 'dimensions', count: 2 }));
    expect(report.clusters).toEqual([{ value: 'spacetime', count: 1, title: 'Spacetime' }]);
  });

  it('filters candidates while preserving stable post-family identity', () => {
    const options = parseReadingTrailAuditArgs(['--search', 'Shira', '--limit', '1']);
    const report = buildReadingTrailCandidateAudit([
      candidate('a', { title: 'An afternoon with Shira', roomId: 'portraits-in-words' }),
      candidate('b', { title: 'A physics post' })
    ], options);

    expect(report.matchingCount).toBe(1);
    expect(report.candidates[0]).toEqual(jasmine.objectContaining({
      groupId: 'group-a',
      roomId: 'portraits-in-words'
    }));
  });
});

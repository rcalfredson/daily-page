import {
  buildHomeDiscoveryDiagnostic,
  parseHomeDiscoveryDiagnosticArgs
} from '../scripts/audits/homeDiscovery.js';

describe('home discovery diagnostic', () => {
  function candidate(id, roomId = `room-${id}`) {
    return {
      _id: id,
      groupId: `group-${id}`,
      roomId,
      lang: 'en',
      title: `Post ${id}`,
      description: 'A sufficiently descriptive introduction for a discovery card.',
      contentLength: 1200,
      tags: [`tag-${id}`],
      createdAt: new Date('2026-08-01T00:00:00.000Z')
    };
  }

  it('parses deterministic preview options', () => {
    const result = parseHomeDiscoveryDiagnosticArgs([
      '--lang', 'es',
      '--date', '2026-09-15',
      '--limit', '4',
      '--candidate-limit', '80',
      '--alternatives', '3',
      '--json'
    ]);

    expect(result).toEqual({
      prod: false,
      json: true,
      preferredLang: 'es',
      now: new Date('2026-09-15T12:00:00.000Z'),
      limit: 4,
      candidateLimit: 80,
      alternativeLimit: 3
    });
  });

  it('requires explicit authorization for production reads', () => {
    expect(() => parseHomeDiscoveryDiagnosticArgs(['--prod']))
      .toThrowError(/authorized-production-read/);
  });

  it('reports the shelf separately from the next alternatives', () => {
    const report = buildHomeDiscoveryDiagnostic(
      Array.from({ length: 8 }, (_, index) => candidate(String(index))),
      {
        preferredLang: 'en',
        now: new Date('2026-09-15T12:00:00.000Z'),
        limit: 3,
        alternativeLimit: 2
      }
    );

    expect(report.dateKey).toBe('2026-09-15');
    expect(report.candidateCount).toBe(8);
    expect(report.candidateRoomCount).toBe(8);
    expect(report.selected).toHaveSize(3);
    expect(report.alternatives).toHaveSize(2);
    expect(new Set([
      ...report.selected.map(item => item.id),
      ...report.alternatives.map(item => item.id)
    ]).size).toBe(5);
  });
});

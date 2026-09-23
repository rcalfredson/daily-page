import {
  buildReadingTrailHealthReport,
  readingTrailAuditGroupIds
} from '../scripts/lib/readingTrailHealthAudit.js';
import { parseReadingTrailHealthAuditArgs } from '../scripts/reading-trails/auditReadingTrails.js';

function trail(overrides = {}) {
  return {
    _id: 'trail-id',
    slug: 'healthy-trail',
    status: 'published',
    sourceLanguage: 'en',
    publishedLocales: ['en'],
    title_i18n: { en: 'Healthy trail' },
    description_i18n: { en: 'Two readings.' },
    coverImage: { url: 'https://images.example.com/trail.jpg' },
    items: [{ groupId: 'group-1' }, { groupId: 'group-2' }],
    ...overrides
  };
}

function post(groupId, overrides = {}) {
  return {
    _id: `${groupId}-en`,
    groupId,
    lang: 'en',
    status: 'locked',
    visibility: 'public',
    bannerImage: { kind: 'image', url: `https://images.example.com/${groupId}.jpg` },
    ...overrides
  };
}

describe('reading trail publication health audit', () => {
  it('requires explicit authorization for production reads and rejects unknown flags', () => {
    expect(() => parseReadingTrailHealthAuditArgs(['--prod']))
      .toThrowError(/--authorized-production-read/);
    expect(parseReadingTrailHealthAuditArgs(['--prod', '--authorized-production-read', '--json']))
      .toEqual({ prod: true, json: true });
    expect(() => parseReadingTrailHealthAuditArgs(['--write']))
      .toThrowError(/Unknown argument/);
  });

  it('reports a complete published trail as healthy', () => {
    const report = buildReadingTrailHealthReport(
      [trail()],
      [post('group-1'), post('group-2')]
    );

    expect(report.hasFailures).toBeFalse();
    expect(report.healthyPublishedTrailCount).toBe(1);
    expect(report.trails[0].publicationHealthy).toBeTrue();
  });

  it('fails when a published locale loses an exact available stop', () => {
    const report = buildReadingTrailHealthReport(
      [trail()],
      [post('group-1'), post('group-2', { visibility: 'unlisted' })]
    );

    expect(report.hasFailures).toBeTrue();
    expect(report.unhealthyPublishedTrailCount).toBe(1);
    expect(report.trails[0].brokenPublishedLocales).toEqual(['en']);
    expect(report.trails[0].localeReports[0].problems).toContain(jasmine.objectContaining({
      code: 'non-public-post-translation', groupId: 'group-2'
    }));
  });

  it('reports draft problems without failing the audit', () => {
    const report = buildReadingTrailHealthReport([
      trail({ status: 'draft', publishedLocales: [] })
    ], []);

    expect(report.hasFailures).toBeFalse();
    expect(report.draftTrailCount).toBe(1);
    expect(report.trails[0].localeReports[0].ready).toBeFalse();
  });

  it('fails a published trail when its post-derived cover loses its banner', () => {
    const subject = trail({ coverImage: undefined, coverGroupId: 'cover-group' });
    const report = buildReadingTrailHealthReport([subject], [
      post('group-1'),
      post('group-2'),
      post('cover-group', { bannerImage: undefined })
    ]);

    expect(report.hasFailures).toBeTrue();
    expect(report.trails[0].cover).toEqual(jasmine.objectContaining({
      healthy: false,
      problems: [{ code: 'missing-cover-banner', groupId: 'cover-group' }]
    }));
  });

  it('collects stop and post-cover families without intrinsic cover URLs', () => {
    expect(readingTrailAuditGroupIds([
      trail(),
      trail({
        slug: 'post-cover',
        coverImage: undefined,
        coverGroupId: 'cover-group',
        items: [{ groupId: 'group-2' }, { groupId: 'group-3' }]
      })
    ])).toEqual(['group-1', 'group-2', 'group-3', 'cover-group']);
  });
});

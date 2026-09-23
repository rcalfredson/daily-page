import { inspectReadingTrailLocales } from '../../server/db/readingTrailDomain.js';

function stringValue(value) {
  return value == null ? '' : String(value);
}

function coverHealth(trail, posts) {
  if (trail.coverImage?.url) {
    return { kind: 'intrinsic', groupId: null, healthy: true, problems: [] };
  }

  const groupId = stringValue(trail.coverGroupId || trail.items?.[0]?.groupId);
  if (!groupId) {
    return {
      kind: 'post',
      groupId: null,
      healthy: false,
      problems: [{ code: 'missing-cover-source' }]
    };
  }

  const family = posts.filter(post => stringValue(post.groupId) === groupId);
  const available = family.filter(post => (
    post.status === 'locked' && post.visibility === 'public'
  ));
  let problems = [];
  if (!family.length) problems = [{ code: 'missing-cover-post-family', groupId }];
  else if (!available.length) problems = [{ code: 'unavailable-cover-post', groupId }];
  else if (!available.some(post => post.bannerImage?.url)) {
    problems = [{ code: 'missing-cover-banner', groupId }];
  }

  return {
    kind: 'post',
    groupId,
    healthy: problems.length === 0,
    problems
  };
}

export function readingTrailAuditGroupIds(trails) {
  return [...new Set((trails || []).flatMap(trail => [
    ...(trail.items || []).map(item => stringValue(item.groupId)),
    trail.coverImage?.url
      ? ''
      : stringValue(trail.coverGroupId || trail.items?.[0]?.groupId)
  ]).filter(Boolean))];
}

export function buildReadingTrailHealthReport(trails = [], posts = []) {
  const auditedTrails = trails.map((trail) => {
    const localeReports = inspectReadingTrailLocales(trail, posts).map(report => ({
      locale: report.locale,
      published: report.published,
      ready: report.ready,
      problems: report.problems
    }));
    const publishedLocales = (trail.publishedLocales || []).map(stringValue);
    const brokenPublishedLocales = localeReports.filter(report => (
      publishedLocales.includes(report.locale) && !report.ready
    ));
    const cover = coverHealth(trail, posts);
    const published = trail.status === 'published';
    const publicationHealthy = !published || (
      brokenPublishedLocales.length === 0 && cover.healthy
    );

    return {
      id: stringValue(trail._id),
      slug: stringValue(trail.slug),
      status: stringValue(trail.status),
      sourceLanguage: stringValue(trail.sourceLanguage),
      publishedLocales,
      publicationHealthy,
      brokenPublishedLocales: brokenPublishedLocales.map(report => report.locale),
      cover,
      localeReports
    };
  });
  const publishedTrails = auditedTrails.filter(trail => trail.status === 'published');
  const unhealthyTrails = publishedTrails.filter(trail => !trail.publicationHealthy);

  return {
    trailCount: auditedTrails.length,
    publishedTrailCount: publishedTrails.length,
    draftTrailCount: auditedTrails.filter(trail => trail.status === 'draft').length,
    healthyPublishedTrailCount: publishedTrails.length - unhealthyTrails.length,
    unhealthyPublishedTrailCount: unhealthyTrails.length,
    hasFailures: unhealthyTrails.length > 0,
    trails: auditedTrails
  };
}

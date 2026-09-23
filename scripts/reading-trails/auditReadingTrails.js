import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import Block from '../../server/db/models/Block.js';
import ReadingTrail from '../../server/db/models/ReadingTrail.js';
import {
  buildReadingTrailHealthReport,
  readingTrailAuditGroupIds
} from '../lib/readingTrailHealthAudit.js';

const PRODUCTION_READ_FLAG = '--authorized-production-read';
const ALLOWED_ARGS = new Set(['--prod', PRODUCTION_READ_FLAG, '--json']);

export function parseReadingTrailHealthAuditArgs(args) {
  const unknown = args.filter(arg => !ALLOWED_ARGS.has(arg));
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);

  const prod = args.includes('--prod');
  if (prod && !args.includes(PRODUCTION_READ_FLAG)) {
    throw new Error(`Production reads require ${PRODUCTION_READ_FLAG}.`);
  }
  return { prod, json: args.includes('--json') };
}

function problemLabel(problem) {
  return `${problem.code}${problem.groupId ? ` (${problem.groupId})` : ''}`;
}

function printTrail(trail) {
  const marker = trail.status !== 'published' ? '-' : trail.publicationHealthy ? 'OK' : 'FAIL';
  const locales = trail.publishedLocales.length ? trail.publishedLocales.join(', ') : 'none';
  console.log(`\n[${marker}] ${trail.slug} · ${trail.status} · published locales: ${locales}`);

  for (const locale of trail.localeReports) {
    const publication = locale.published ? 'published' : 'not published';
    const readiness = locale.ready ? 'ready' : 'blocked';
    console.log(`  ${locale.locale}: ${readiness}, ${publication}`);
    locale.problems.forEach(problem => console.log(`    - ${problemLabel(problem)}`));
  }
  if (!trail.cover.healthy) {
    console.log('  cover: blocked');
    trail.cover.problems.forEach(problem => console.log(`    - ${problemLabel(problem)}`));
  }
}

export function printReadingTrailHealthReport(report, database) {
  console.log('Daily Page reading trail publication health audit');
  console.log(`Database: ${database}`);
  console.log(
    `Trails: ${report.trailCount} total · ${report.publishedTrailCount} published · ` +
    `${report.draftTrailCount} draft`
  );
  console.log(
    `Published health: ${report.healthyPublishedTrailCount} healthy · ` +
    `${report.unhealthyPublishedTrailCount} unhealthy`
  );
  report.trails.forEach(printTrail);
}

function printUsage() {
  console.log(`Usage:
  npm run trail:audit
  npm run trail:audit -- --json
  npm run trail:audit -- --prod ${PRODUCTION_READ_FLAG} [--json]

This audit is read-only. It exits nonzero when a published trail has an
unready locale or unusable post-derived cover. Production access requires an
explicit read acknowledgement.`);
}

async function loadAuditRecords() {
  const trails = await ReadingTrail.find({}).sort({ slug: 1 }).lean();
  const groupIds = readingTrailAuditGroupIds(trails);
  const posts = groupIds.length ? await Block.find(
    { groupId: { $in: groupIds } },
    '_id groupId lang status visibility bannerImage'
  ).sort({ createdAt: 1, _id: 1 }).lean() : [];
  return { trails, posts };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printUsage();
    return;
  }

  const options = parseReadingTrailHealthAuditArgs(rawArgs);
  await initMongooseConnection({ useProductionDb: options.prod, quiet: options.json });
  const expectedDatabase = options.prod ? 'daily-page' : 'daily-page-test';
  if (mongoose.connection.name !== expectedDatabase) {
    throw new Error(`Refusing audit on unexpected database ${mongoose.connection.name}.`);
  }

  const { trails, posts } = await loadAuditRecords();
  const report = buildReadingTrailHealthReport(trails, posts);
  if (options.json) console.log(JSON.stringify({ database: expectedDatabase, ...report }, null, 2));
  else printReadingTrailHealthReport(report, expectedDatabase);
  if (report.hasFailures) process.exitCode = 1;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  main()
    .catch((error) => {
      console.error('Reading trail health audit failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect().catch(() => {}));
}

import path from 'path';
import { fileURLToPath } from 'url';

import mongoose from 'mongoose';

import { initMongooseConnection } from '../../server/db/mongoose.js';
import * as cache from '../../server/services/cache.js';
import {
  getHomeDiscoveryCandidates,
  HOME_DISCOVERY_POOL_LIMIT
} from '../../server/services/homeDiscovery.js';

const AUTHORIZATION_FLAG = '--authorized-production-read';
const DEFAULT_RESULT_LIMIT = 80;

function optionValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return args[index + 1];
}

function positiveInteger(value, fallback, flag) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function normalized(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedKey(value) {
  return normalized(value).toLocaleLowerCase();
}

export function parseReadingTrailAuditArgs(args) {
  const prod = args.includes('--prod');
  if (prod && !args.includes(AUTHORIZATION_FLAG)) {
    throw new Error(`Refusing production read without ${AUTHORIZATION_FLAG}.`);
  }

  return {
    prod,
    json: args.includes('--json'),
    preferredLang: optionValue(args, '--lang') || 'en',
    room: optionValue(args, '--room') || null,
    tag: optionValue(args, '--tag') || null,
    search: optionValue(args, '--search') || null,
    cluster: optionValue(args, '--cluster') || null,
    limit: positiveInteger(optionValue(args, '--limit'), DEFAULT_RESULT_LIMIT, '--limit'),
    candidateLimit: positiveInteger(
      optionValue(args, '--candidate-limit'),
      HOME_DISCOVERY_POOL_LIMIT,
      '--candidate-limit'
    )
  };
}

function candidateView(candidate) {
  const id = String(candidate._id);
  return {
    id,
    groupId: String(candidate.groupId || id),
    roomId: candidate.roomId,
    lang: candidate.lang || 'en',
    title: normalized(candidate.title),
    description: normalized(candidate.description),
    tags: (candidate.tags || []).map(normalized).filter(Boolean),
    voteCount: Number(candidate.familyVoteCount ?? candidate.voteCount) || 0,
    contentLength: Number(candidate.contentLength) || 0,
    hasBanner: Boolean(candidate.bannerImage?.url),
    editorial: candidate.editorial
      ? {
          clusterKey: candidate.editorial.clusterKey || null,
          guideTitle: normalized(candidate.editorial.guideTitle) || null,
          role: candidate.editorial.role || null,
          sequence: Number.isInteger(candidate.editorial.sequence)
            ? candidate.editorial.sequence
            : null
        }
      : null,
    createdAt: candidate.familyCreatedAt || candidate.createdAt || null,
    path: `/rooms/${candidate.roomId}/blocks/${id}`
  };
}

function countBy(items, valuesForItem) {
  const counts = new Map();
  for (const item of items) {
    for (const value of valuesForItem(item)) {
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function matchesFilters(candidate, options) {
  if (options.room && candidate.roomId !== options.room) return false;
  if (options.cluster && candidate.editorial?.clusterKey !== options.cluster) return false;
  if (options.tag) {
    const wantedTag = normalizedKey(options.tag);
    if (!candidate.tags.some(tag => normalizedKey(tag) === wantedTag)) return false;
  }
  if (options.search) {
    const query = normalizedKey(options.search);
    const haystack = normalizedKey([
      candidate.title,
      candidate.description,
      candidate.roomId,
      candidate.tags.join(' '),
      candidate.editorial?.guideTitle,
      candidate.editorial?.clusterKey
    ].join(' '));
    if (!haystack.includes(query)) return false;
  }
  return true;
}

export function buildReadingTrailCandidateAudit(candidates, options) {
  const items = (candidates || []).map(candidateView);
  const matching = items.filter(candidate => matchesFilters(candidate, options));
  const clusters = countBy(
    items.filter(candidate => candidate.editorial?.clusterKey),
    candidate => [candidate.editorial.clusterKey]
  ).map(cluster => ({
    ...cluster,
    title: items.find(candidate => (
      candidate.editorial?.clusterKey === cluster.value
      && candidate.editorial?.guideTitle
    ))?.editorial.guideTitle || null
  }));

  return {
    preferredLang: options.preferredLang,
    candidateCount: items.length,
    matchingCount: matching.length,
    filters: {
      room: options.room,
      tag: options.tag,
      search: options.search,
      cluster: options.cluster
    },
    rooms: countBy(items, candidate => [candidate.roomId]),
    tags: countBy(items, candidate => candidate.tags).filter(item => item.count > 1),
    clusters,
    candidates: matching.slice(0, options.limit)
  };
}

function printCounts(title, items, limit = 25) {
  console.log(`\n${title}`);
  if (!items.length) {
    console.log('  None');
    return;
  }
  for (const item of items.slice(0, limit)) {
    const detail = item.title ? ` · ${item.title}` : '';
    console.log(`  ${item.count.toString().padStart(3)}  ${item.value}${detail}`);
  }
}

function printCandidate(candidate, index) {
  const details = [
    candidate.lang,
    `${candidate.contentLength} chars`,
    `${candidate.voteCount} votes`,
    candidate.createdAt ? new Date(candidate.createdAt).toISOString().slice(0, 10) : null,
    candidate.hasBanner ? 'banner' : null,
    candidate.editorial?.role ? `editorial:${candidate.editorial.role}` : null
  ].filter(Boolean).join(' · ');

  console.log(`\n${index + 1}. [${candidate.roomId}] ${candidate.title}`);
  console.log(`   groupId: ${candidate.groupId}`);
  console.log(`   ${details}`);
  if (candidate.description) console.log(`   ${candidate.description}`);
  if (candidate.tags.length) console.log(`   tags: ${candidate.tags.join(', ')}`);
  if (candidate.editorial?.clusterKey) {
    console.log(`   guide: ${candidate.editorial.guideTitle || candidate.editorial.clusterKey}`);
  }
  console.log(`   ${candidate.path}`);
}

function printReport(report, database) {
  console.log('Daily Page reading trail candidate audit');
  console.log(`Database: ${database} · preferred language: ${report.preferredLang}`);
  console.log(`Candidate pool: ${report.candidateCount} public, completed post families`);
  printCounts('Rooms', report.rooms);
  printCounts('Recurring tags', report.tags);
  printCounts('Reading-guide clusters', report.clusters);

  const activeFilters = Object.entries(report.filters).filter(([, value]) => value);
  if (activeFilters.length) {
    console.log(`\nFilters: ${activeFilters.map(([key, value]) => `${key}=${value}`).join(' · ')}`);
    console.log(`Matches: ${report.matchingCount}`);
    report.candidates.forEach(printCandidate);
  } else {
    console.log('\nAdd --room, --tag, --search, or --cluster to list matching candidates.');
  }
}

function printUsage() {
  console.log(`Usage:
  npm run audit:reading-trails -- [--lang en] [--room room-id] [--tag tag]
      [--search text] [--cluster cluster-key] [--limit 80] [--json]
  npm run audit:reading-trails -- --prod ${AUTHORIZATION_FLAG} [options]

This audit is read-only. Production access requires both production flags.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    printUsage();
    return;
  }

  const options = parseReadingTrailAuditArgs(args);
  await initMongooseConnection({ useProductionDb: options.prod });

  const expectedDatabase = options.prod ? 'daily-page' : 'daily-page-test';
  if (mongoose.connection.name !== expectedDatabase) {
    throw new Error(`Refusing audit on unexpected database ${mongoose.connection.name}.`);
  }

  const candidates = await getHomeDiscoveryCandidates({
    preferredLang: options.preferredLang,
    limit: options.candidateLimit
  });
  const report = buildReadingTrailCandidateAudit(candidates, options);

  if (options.json) console.log(JSON.stringify({ database: expectedDatabase, ...report }, null, 2));
  else printReport(report, expectedDatabase);
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  main()
    .catch((error) => {
      console.error('Reading trail candidate audit failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      cache.clear();
      await mongoose.disconnect().catch(() => {});
    });
}

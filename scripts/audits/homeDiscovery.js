import path from 'path';
import { fileURLToPath } from 'url';

import mongoose from 'mongoose';

import { initMongooseConnection } from '../../server/db/mongoose.js';
import * as cache from '../../server/services/cache.js';
import {
  getHomeDiscoveryCandidates,
  HOME_DISCOVERY_POOL_LIMIT,
  HOME_DISCOVERY_SHELF_LIMIT,
  homeDiscoveryDateKey,
  selectHomeDiscoveryPosts
} from '../../server/services/homeDiscovery.js';

const AUTHORIZATION_FLAG = '--authorized-production-read';
const DEFAULT_ALTERNATIVE_LIMIT = 6;

function positiveInteger(value, fallback, flag) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function optionValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return args[index + 1];
}

function diagnosticDate(value) {
  if (value === undefined) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('--date must use YYYY-MM-DD.');
  }
  const result = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || homeDiscoveryDateKey(result) !== value) {
    throw new Error('--date must be a real calendar date.');
  }
  return result;
}

export function parseHomeDiscoveryDiagnosticArgs(args) {
  const prod = args.includes('--prod');
  if (prod && !args.includes(AUTHORIZATION_FLAG)) {
    throw new Error(`Refusing production read without ${AUTHORIZATION_FLAG}.`);
  }

  return {
    prod,
    json: args.includes('--json'),
    preferredLang: optionValue(args, '--lang') || 'en',
    now: diagnosticDate(optionValue(args, '--date')),
    limit: positiveInteger(
      optionValue(args, '--limit'),
      HOME_DISCOVERY_SHELF_LIMIT,
      '--limit'
    ),
    candidateLimit: positiveInteger(
      optionValue(args, '--candidate-limit'),
      HOME_DISCOVERY_POOL_LIMIT,
      '--candidate-limit'
    ),
    alternativeLimit: positiveInteger(
      optionValue(args, '--alternatives'),
      DEFAULT_ALTERNATIVE_LIMIT,
      '--alternatives'
    )
  };
}

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function candidateView(candidate) {
  const id = String(candidate._id);
  return {
    id,
    groupId: String(candidate.groupId || id),
    roomId: candidate.roomId,
    lang: candidate.lang,
    title: oneLine(candidate.title),
    description: oneLine(candidate.description),
    tags: (candidate.tags || []).slice(0, 8),
    voteCount: Number(candidate.familyVoteCount ?? candidate.voteCount) || 0,
    contentLength: Number(candidate.contentLength) || 0,
    hasBanner: Boolean(candidate.bannerImage?.url),
    editorialRole: candidate.editorial?.role || null,
    createdAt: candidate.familyCreatedAt || candidate.createdAt || null,
    path: `/rooms/${candidate.roomId}/blocks/${id}`
  };
}

export function buildHomeDiscoveryDiagnostic(candidates, options) {
  const selection = selectHomeDiscoveryPosts(candidates, {
    limit: options.limit + options.alternativeLimit,
    now: options.now
  });
  const selected = selection.slice(0, options.limit).map(candidateView);
  const alternatives = selection
    .slice(options.limit, options.limit + options.alternativeLimit)
    .map(candidateView);

  return {
    dateKey: homeDiscoveryDateKey(options.now),
    preferredLang: options.preferredLang,
    candidateCount: candidates.length,
    candidateRoomCount: new Set(candidates.map(candidate => candidate.roomId).filter(Boolean)).size,
    selected,
    alternatives
  };
}

function printCandidate(candidate, index) {
  const details = [
    `${candidate.voteCount} votes`,
    `${candidate.contentLength} chars`,
    candidate.hasBanner ? 'banner' : 'no banner',
    candidate.editorialRole ? `editorial:${candidate.editorialRole}` : null
  ].filter(Boolean).join(' · ');

  console.log(`${index + 1}. [${candidate.roomId}] ${candidate.title}`);
  console.log(`   ${candidate.lang} · ${details}`);
  if (candidate.description) console.log(`   ${candidate.description}`);
  if (candidate.tags.length) console.log(`   tags: ${candidate.tags.join(', ')}`);
  console.log(`   ${candidate.path}`);
}

function printReport(report, database) {
  console.log('Daily Page home discovery diagnostic');
  console.log(`Database: ${database}`);
  console.log(`Daily seed: ${report.dateKey} · preferred language: ${report.preferredLang}`);
  console.log(`Candidate pool: ${report.candidateCount} post families across ${report.candidateRoomCount} rooms`);
  console.log('\nSelected shelf');
  report.selected.forEach(printCandidate);

  if (report.alternatives.length) {
    console.log('\nNext alternatives');
    report.alternatives.forEach(printCandidate);
  }
}

function printUsage() {
  console.log(`Usage:
  npm run audit:home-discovery -- [--lang en] [--date YYYY-MM-DD] [--limit 6]
      [--candidate-limit 600] [--alternatives 6] [--json]
  npm run audit:home-discovery -- --prod ${AUTHORIZATION_FLAG} [options]

This diagnostic is read-only. Production access requires both production flags.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    printUsage();
    return;
  }

  const options = parseHomeDiscoveryDiagnosticArgs(args);
  await initMongooseConnection({ useProductionDb: options.prod });

  const expectedDatabase = options.prod ? 'daily-page' : 'daily-page-test';
  if (mongoose.connection.name !== expectedDatabase) {
    throw new Error(`Refusing diagnostic on unexpected database ${mongoose.connection.name}.`);
  }

  const candidates = await getHomeDiscoveryCandidates({
    preferredLang: options.preferredLang,
    limit: options.candidateLimit
  });
  const report = buildHomeDiscoveryDiagnostic(candidates, options);

  if (options.json) console.log(JSON.stringify({ database: expectedDatabase, ...report }, null, 2));
  else printReport(report, expectedDatabase);
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  main()
    .catch((error) => {
      console.error('Home discovery diagnostic failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      // The application cache intentionally owns long-lived expiration timers.
      // A one-shot CLI must release those timers so Node can exit naturally.
      cache.clear();
      await mongoose.disconnect().catch(() => {});
    });
}

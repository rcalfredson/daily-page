import mongoose from 'mongoose';

import { initMongooseConnection } from '../../server/db/mongoose.js';
import Block from '../../server/db/models/Block.js';
import {
  buildTagBlocksPipeline,
  buildTagTrendPipeline,
  publiclyVisibleBlockMatch
} from '../../server/db/blockService.js';
import {
  parseTagQueryProfileArgs,
  summarizeExplain
} from '../lib/tagQueryProfile.js';

function printUsage() {
  console.log(`Usage:
  npm run audit:tag-queries -- --tag <tag> [--timeframe 7d|30d|all] [--lang en] [--page 1] [--limit 20]
  npm run audit:tag-queries -- --prod --authorized-production-read --tag <tag> [options]

The audit is read-only. It executes each tag-detail query under explain("executionStats")
with a default 15000ms maximum. Override that guard with --max-time-ms <milliseconds>.`);
}

async function explainStage(name, explain) {
  const applicationStartedAt = process.hrtime.bigint();
  try {
    const result = await explain();
    return {
      name,
      applicationElapsedMs: Number(
        (Number(process.hrtime.bigint() - applicationStartedAt) / 1e6).toFixed(1)
      ),
      status: 'ok',
      ...summarizeExplain(result),
    };
  } catch (error) {
    return {
      name,
      applicationElapsedMs: Number(
        (Number(process.hrtime.bigint() - applicationStartedAt) / 1e6).toFixed(1)
      ),
      status: 'error',
      errorName: error?.name || 'Error',
      errorMessage: error?.message || String(error),
    };
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    printUsage();
    return;
  }

  const options = parseTagQueryProfileArgs(process.argv.slice(2));
  await initMongooseConnection({ useProductionDb: options.prod });

  const expectedDb = options.prod ? 'daily-page' : 'daily-page-test';
  if (mongoose.connection.name !== expectedDb) {
    throw new Error(`Refusing analysis on unexpected database ${mongoose.connection.name}.`);
  }

  const timeframe = options.timeframe === 'all'
    ? 'all'
    : Number.parseInt(options.timeframe, 10);
  const skip = (options.page - 1) * options.limit;
  const match = publiclyVisibleBlockMatch({ tags: options.tag });

  const stages = [];
  stages.push(await explainStage('tagged_blocks_query', () => Block.aggregate(
    buildTagBlocksPipeline({
      tag: options.tag,
      preferredLang: options.preferredLang,
      sortBy: 'voteCount',
      skip,
      limit: options.limit,
    })
  ).option({ maxTimeMS: options.maxTimeMs }).explain('executionStats')));

  stages.push(await explainStage('distinct_group_count_query', () => (
    mongoose.connection.db.command({
      explain: {
        distinct: Block.collection.name,
        key: 'groupId',
        query: match,
      },
      verbosity: 'executionStats',
      maxTimeMS: options.maxTimeMs,
    })
  )));

  stages.push(await explainStage('trend_query', () => Block.aggregate(
    buildTagTrendPipeline(options.tag, timeframe, { dedupeGroups: true })
  ).option({ maxTimeMS: options.maxTimeMs }).explain('executionStats')));

  console.log(JSON.stringify({
    database: expectedDb,
    inputs: {
      tag: options.tag,
      preferredLang: options.preferredLang,
      timeframe: options.timeframe,
      page: options.page,
      limit: options.limit,
      maxTimeMs: options.maxTimeMs,
    },
    stages,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('Tag query profile failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));

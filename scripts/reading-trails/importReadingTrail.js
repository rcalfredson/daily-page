import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import {
  importReadingTrail,
  validateReadingTrailManifest
} from '../lib/readingTrailImport.js';

const PRODUCTION_READ_FLAG = '--authorized-production-read';
const PRODUCTION_WRITE_FLAG = '--authorized-production-write';

function usage() {
  console.log(`Usage:
  npm run trail:import -- --config <manifest.json>
  npm run trail:import -- --config <manifest.json> --apply
  npm run trail:import -- --config <manifest.json> --prod ${PRODUCTION_READ_FLAG}
  npm run trail:import -- --config <manifest.json> --prod --apply ${PRODUCTION_WRITE_FLAG}

Safe default: validates post and metadata readiness and previews changes without writing.`);
}

export function parseReadingTrailImportArgs(argv) {
  const args = { apply: false, prod: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config') args.config = argv[++index];
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--prod') args.prod = true;
    else if (arg === PRODUCTION_READ_FLAG) args.authorizedProductionRead = true;
    else if (arg === PRODUCTION_WRITE_FLAG) args.authorizedProductionWrite = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.help && !args.config) throw new Error('--config is required.');
  if (args.prod && args.apply && !args.authorizedProductionWrite) {
    throw new Error(`Production writes require ${PRODUCTION_WRITE_FLAG}.`);
  }
  if (args.prod && !args.apply && !args.authorizedProductionRead && !args.authorizedProductionWrite) {
    throw new Error(`Production reads require ${PRODUCTION_READ_FLAG}.`);
  }
  return args;
}

function problemLabel(problem) {
  return `${problem.code}${problem.groupId ? ` (${problem.groupId})` : ''}`;
}

function printResult(result, apply) {
  console.log(`${apply ? 'Applied' : 'Planned'} reading trail action: ${result.plan.action}`);
  if (result.plan.changedFields.length) {
    console.log(`Fields: ${result.plan.changedFields.join(', ')}`);
  }
  console.log('Locale readiness:');
  for (const report of result.localeReports) {
    const publication = report.published ? 'published' : 'not published';
    const readiness = report.ready ? 'ready' : 'blocked';
    console.log(`  ${report.locale}: ${readiness}, ${publication}`);
    report.problems.forEach(problem => console.log(`    - ${problemLabel(problem)}`));
  }
  if (!apply) console.log('Dry run only. Re-run with --apply to persist this trail.');
}

async function main() {
  const args = parseReadingTrailImportArgs(process.argv.slice(2));
  if (args.help) return usage();

  const manifest = JSON.parse(await fs.readFile(path.resolve(args.config), 'utf8'));
  validateReadingTrailManifest(manifest);
  await initMongooseConnection({ useProductionDb: args.prod });
  const expectedDatabase = args.prod ? 'daily-page' : 'daily-page-test';
  if (mongoose.connection.name !== expectedDatabase) {
    throw new Error(`Refusing import on unexpected database ${mongoose.connection.name}.`);
  }
  const result = await importReadingTrail({ manifest, apply: args.apply });
  printResult(result, args.apply);
}

main()
  .catch((error) => {
    console.error('Reading trail import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));

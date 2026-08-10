import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import Block from '../../server/db/models/Block.js';
import { planBlockLanguageMetadataBackfill } from '../lib/blockLanguageMetadataBackfill.js';

function parseArgs(argv) {
  const allowed = new Set(['--write', '--prod', '--help', '-h']);
  const unknown = argv.find(arg => !allowed.has(arg));
  if (unknown) throw new Error(`Unknown argument: ${unknown}`);
  return {
    write: argv.includes('--write'),
    prod: argv.includes('--prod'),
    help: argv.includes('--help') || argv.includes('-h')
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/migrations/backfillBlockLanguageMetadata.js [--prod] [--write]');
    console.log('Dry-run/report mode is the default. --write applies only unambiguous families.');
    return;
  }

  await initMongooseConnection({ useProductionDb: args.prod });
  const blocks = await Block.find({})
    .select('_id title roomId groupId lang originalBlock sourceLanguage audienceScope translationPriority createdAt')
    .lean();
  const report = planBlockLanguageMetadataBackfill(blocks);

  console.log(JSON.stringify({
    mode: args.write ? 'write' : 'dry-run',
    families: report.families,
    ready: report.ready.length,
    ambiguous: report.ambiguous
  }, null, 2));

  if (!args.write) {
    console.log(`Dry run: ${report.operations.length} idempotent update(s) would be attempted.`);
    return;
  }
  if (!report.operations.length) return;
  const result = await Block.bulkWrite(report.operations, { ordered: false });
  console.log(`Applied ${result.modifiedCount || 0} modification(s).`);
}

main()
  .catch(error => {
    console.error('backfillBlockLanguageMetadata failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));

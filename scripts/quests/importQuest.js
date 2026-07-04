import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import { importQuest, validateQuestManifest } from '../lib/questImport.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function usage() {
  console.log('Usage: npm run quest:import -- --config <manifest.json> [options]');
  console.log('');
  console.log('Safe default: validates and previews changes without writing.');
  console.log('');
  console.log('Options:');
  console.log('  --write        Persist changes to MongoDB.');
  console.log('  --prod         Use the production database.');
  console.log('  --sync-status  Update the status of an existing quest from the manifest.');
  console.log('  --help         Show this help.');
}

export function parseArgs(argv) {
  const args = { write: false, prod: false, syncStatus: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config') args.config = argv[++index];
    else if (arg === '--write') args.write = true;
    else if (arg === '--prod') args.prod = true;
    else if (arg === '--sync-status') args.syncStatus = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.help && !args.config) throw new Error('--config is required.');
  return args;
}

async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, 'utf8'));
}

async function loadInput(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  const manifest = await readJson(absoluteConfigPath);
  validateQuestManifest(manifest);

  const publicRoot = path.join(projectRoot, 'public');
  const badgePath = path.resolve(publicRoot, `.${manifest.badgeAssetPath}`);
  if (!badgePath.startsWith(`${publicRoot}${path.sep}`) || path.extname(badgePath) !== '.svg') {
    throw new Error('badgeAssetPath must resolve to an SVG inside public/.');
  }
  await fs.access(badgePath);

  const items = manifest.itemsFile
    ? await readJson(path.resolve(path.dirname(absoluteConfigPath), manifest.itemsFile))
    : [];
  return { manifest, items };
}

function printPlan(plan, write) {
  console.log(`${write ? 'Applied' : 'Planned'} quest action: ${plan.questAction}`);
  if (plan.questChangedFields.length) console.log(`Quest fields: ${plan.questChangedFields.join(', ')}`);
  console.log(`Items: ${plan.itemCreates} create, ${plan.itemUpdates} update, ${plan.itemUnchanged} unchanged.`);
  if (!write) console.log('Dry run only. Re-run with --write to persist these changes.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  const input = await loadInput(args.config);
  await initMongooseConnection({ useProductionDb: args.prod });
  const plan = await importQuest({ ...input, write: args.write, syncStatus: args.syncStatus });
  printPlan(plan, args.write);
}

main()
  .catch((error) => {
    console.error('Quest import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));

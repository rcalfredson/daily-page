import { promises as fs } from 'fs';
import path from 'path';
import {
  createRoomTranslationExport,
  getLocalizableRoomFields
} from '../lib/roomI18nMigration.js';

const DEFAULT_EXPORT_ROOT = path.resolve(process.cwd(), 'tmp', 'room-i18n-exports');

function printUsage() {
  console.log('Usage: node scripts/migrations/exportRoomI18nSource.js --lang ru --prod [options]');
  console.log('');
  console.log('Reads room metadata and exports translator-ready JSON into a repo-local temp directory.');
  console.log('');
  console.log('Options:');
  console.log('  --lang <code>           Target language code. Required.');
  console.log('  --source-lang <code>    Source language code. Defaults to en.');
  console.log('  --prod                  Use the production DB name.');
  console.log('  --room <id[,id2]>       Limit to one or more room IDs. Repeatable.');
  console.log('  --rooms-file <path>     Newline-delimited room IDs to target.');
  console.log('  --field <name>          Restrict fields. Repeatable. Default: name, description, topic.');
  console.log('  --limit <n>             Limit how many matched rooms are exported.');
  console.log('  --include-complete      Include rooms that already have all target translations.');
  console.log('  --out-dir <path>        Override the export directory root.');
  console.log('  --help                  Show this help.');
}

function parseArgs(argv) {
  const args = {
    sourceLang: 'en',
    rooms: [],
    fields: [],
    prod: false,
    includeComplete: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--lang':
        args.lang = argv[++index];
        break;
      case '--source-lang':
        args.sourceLang = argv[++index];
        break;
      case '--prod':
        args.prod = true;
        break;
      case '--room': {
        const raw = argv[++index] || '';
        raw.split(',').map((value) => value.trim()).filter(Boolean).forEach((value) => {
          args.rooms.push(value);
        });
        break;
      }
      case '--rooms-file':
        args.roomsFile = argv[++index];
        break;
      case '--field':
        args.fields.push(argv[++index]);
        break;
      case '--limit':
        args.limit = Number.parseInt(argv[++index], 10);
        break;
      case '--include-complete':
        args.includeComplete = true;
        break;
      case '--out-dir':
        args.outDir = argv[++index];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function loadRoomIdsFromFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return raw
    .split(/\r?\n/g)
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith('#'));
}

function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function buildSummary(exportPayload) {
  return exportPayload.rooms.reduce((summary, room) => {
    summary.rooms += 1;
    summary.fieldsMissing += room.missingFields.length;
    room.missingFields.forEach((field) => {
      summary.byField[field] = (summary.byField[field] || 0) + 1;
    });
    return summary;
  }, {
    rooms: 0,
    fieldsMissing: 0,
    byField: {}
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.lang) {
    throw new Error('--lang is required.');
  }

  if (!args.prod) {
    throw new Error('Refusing to export without --prod. This script is intended for the production room dataset.');
  }

  const allowedFields = new Set(getLocalizableRoomFields());
  const fields = (args.fields.length ? args.fields : getLocalizableRoomFields()).map((field) => {
    const normalized = String(field || '').trim();
    if (!allowedFields.has(normalized)) {
      throw new Error(`Unsupported field "${field}". Allowed: ${[...allowedFields].join(', ')}`);
    }
    return normalized;
  });

  const roomIds = new Set(args.rooms);
  if (args.roomsFile) {
    (await loadRoomIdsFromFile(args.roomsFile)).forEach((roomId) => roomIds.add(roomId));
  }

  const query = roomIds.size ? { _id: { $in: [...roomIds] } } : {};
  const projection = fields.reduce((acc, field) => {
    acc[field] = 1;
    acc[`${field}_i18n`] = 1;
    return acc;
  }, { _id: 1 });

  let mongoose;

  try {
    ({ default: mongoose } = await import('mongoose'));
    const [{ initMongooseConnection }, { default: Room }] = await Promise.all([
      import('../../server/db/mongoose.js'),
      import('../../server/db/models/Room.js')
    ]);

    await initMongooseConnection({ useProductionDb: true });

    let rooms = await Room.find(query).select(projection).sort({ _id: 1 }).lean();
    if (Number.isInteger(args.limit) && args.limit > 0) {
      rooms = rooms.slice(0, args.limit);
    }

    const exportPayload = createRoomTranslationExport({
      rooms,
      targetLang: args.lang,
      sourceLang: args.sourceLang,
      fields,
      onlyMissing: !args.includeComplete
    });

    const exportRoot = path.resolve(args.outDir || DEFAULT_EXPORT_ROOT);
    const exportDir = path.join(exportRoot, `${timestampLabel()}-${args.lang}`);
    await ensureDir(exportDir);

    const exportFile = path.join(exportDir, `rooms.${args.lang}.json`);
    const summaryFile = path.join(exportDir, 'summary.json');

    await fs.writeFile(exportFile, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8');
    await fs.writeFile(summaryFile, `${JSON.stringify(buildSummary(exportPayload), null, 2)}\n`, 'utf8');

    console.log(`Exported ${exportPayload.rooms.length} room(s) to ${exportFile}`);
    console.log(`Wrote summary to ${summaryFile}`);
    console.log('Summary:', buildSummary(exportPayload));
  } finally {
    if (mongoose) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error('exportRoomI18nSource failed:', error.message);
  process.exitCode = 1;
});

import { promises as fs } from 'fs';
import path from 'path';
import {
  buildRoomI18nMigrationPlan,
  createRoomTranslationTemplate,
  getLocalizableRoomFields,
  parseRoomTranslationFilePayload
} from '../lib/roomI18nMigration.js';

function printUsage() {
  console.log('Usage: node scripts/migrations/populateRoomI18n.js --lang ru [options]');
  console.log('');
  console.log('Safe defaults: dry-run mode unless --write is provided.');
  console.log('');
  console.log('Options:');
  console.log('  --lang <code>              Target language code. Required.');
  console.log('  --source-lang <code>       Source language code. Defaults to en.');
  console.log('  --prod                     Use the production DB name.');
  console.log('  --translation-file <path>  JSON file containing translated room metadata.');
  console.log('  --template-out <path>      Write a translation template JSON file.');
  console.log('  --room <id[,id2]>          Limit to one or more room IDs. Repeatable.');
  console.log('  --rooms-file <path>        Newline-delimited room IDs to target.');
  console.log('  --field <name>             Restrict fields. Repeatable. Default: name, description, topic.');
  console.log('  --limit <n>                Limit how many matched rooms are processed.');
  console.log('  --overwrite                Allow replacing an existing target translation.');
  console.log('  --write                    Persist changes to MongoDB.');
  console.log('  --help                     Show this help.');
  console.log('');
  console.log('Supported translation file shapes:');
  console.log('  1. { "physics": { "name": "...", "description": "...", "topic": "..." } }');
  console.log('  2. { "rooms": [{ "roomId": "physics", "translation": { "name": "..." } }] }');
}

function parseArgs(argv) {
  const args = {
    write: false,
    overwrite: false,
    sourceLang: 'en',
    rooms: [],
    fields: [],
    prod: false
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
      case '--translation-file':
        args.translationFile = argv[++index];
        break;
      case '--template-out':
        args.templateOut = argv[++index];
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
      case '--overwrite':
        args.overwrite = true;
        break;
      case '--write':
        args.write = true;
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

async function loadTranslationFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return parseRoomTranslationFilePayload(JSON.parse(raw));
}

function summarizePlan(plan) {
  return plan.reduce((summary, roomPlan) => {
    roomPlan.fieldResults.forEach((result) => {
      summary[result.status] = (summary[result.status] || 0) + 1;
    });
    if (roomPlan.willWrite) {
      summary.roomsWithWrites = (summary.roomsWithWrites || 0) + 1;
    }
    return summary;
  }, {});
}

function logPlan(plan) {
  if (!plan.length) {
    console.log('No rooms matched the selected filters.');
    return;
  }

  plan.forEach((roomPlan) => {
    console.log(`\nRoom ${roomPlan.roomId}`);
    roomPlan.fieldResults.forEach((result) => {
      const suffix = result.status === 'create' || result.status === 'overwrite'
        ? ` -> ${JSON.stringify(result.incoming)}`
        : '';
      const existing = result.existing ? ` (existing: ${JSON.stringify(result.existing)})` : '';
      console.log(`  [${result.status}] ${result.path}${suffix}${existing}`);
    });
  });

  console.log('\nSummary:', summarizePlan(plan));
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

  if (args.write && !args.translationFile) {
    throw new Error('--write requires --translation-file.');
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

  let translationsByRoom = {};
  if (args.translationFile) {
    translationsByRoom = await loadTranslationFile(path.resolve(args.translationFile));
  }

  let mongoose;

  try {
    ({ default: mongoose } = await import('mongoose'));
    const [{ initMongooseConnection }, { default: Room }] = await Promise.all([
      import('../../server/db/mongoose.js'),
      import('../../server/db/models/Room.js')
    ]);

    await initMongooseConnection({ useProductionDb: args.prod });

    let rooms = await Room.find(query).select(projection).sort({ _id: 1 }).lean();
    if (Number.isInteger(args.limit) && args.limit > 0) {
      rooms = rooms.slice(0, args.limit);
    }

    console.log(`Matched ${rooms.length} room(s).`);

    if (args.templateOut) {
      const template = createRoomTranslationTemplate({
        rooms,
        targetLang: args.lang,
        sourceLang: args.sourceLang,
        fields
      });
      const outPath = path.resolve(args.templateOut);
      await fs.writeFile(outPath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
      console.log(`Wrote translation template to ${outPath}`);
    }

    const plan = buildRoomI18nMigrationPlan({
      rooms,
      targetLang: args.lang,
      sourceLang: args.sourceLang,
      translationsByRoom,
      overwrite: args.overwrite,
      fields
    });

    logPlan(plan);

    if (!args.write) {
      console.log('\nDry run only. Re-run with --write to persist the planned changes.');
      return;
    }

    const actionablePlans = plan.filter((roomPlan) => roomPlan.willWrite);
    if (!actionablePlans.length) {
      console.log('\nNo changes to write.');
      return;
    }

    let writes = 0;
    for (const roomPlan of actionablePlans) {
      await Room.updateOne(
        { _id: roomPlan.roomId },
        { $set: roomPlan.updates }
      );
      writes += 1;
      console.log(`Applied updates for room ${roomPlan.roomId}`);
    }

    console.log(`\nWrite complete. Updated ${writes} room(s).`);
  } finally {
    if (mongoose) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error('populateRoomI18n failed:', error.message);
  process.exitCode = 1;
});

function printUsage() {
  console.log('Usage: node scripts/migrations/cleanBlockCollaborators.js [options]');
  console.log('');
  console.log('Safe default: dry-run mode unless --write is provided.');
  console.log('');
  console.log('Options:');
  console.log('  --prod        Use the production DB name.');
  console.log('  --write       Persist changes to MongoDB.');
  console.log('  --block <id>  Limit cleanup to one block id.');
  console.log('  --limit <n>   Limit how many matched blocks are inspected.');
  console.log('  --help        Show this help.');
}

function parseArgs(argv) {
  const args = {
    prod: false,
    write: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--prod':
        args.prod = true;
        break;
      case '--write':
        args.write = true;
        break;
      case '--block':
        args.blockId = argv[++index];
        break;
      case '--limit':
        args.limit = Number.parseInt(argv[++index], 10);
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }

  return args;
}

function normalizeCollaborators(collaborators, creator) {
  const seen = new Set();
  const normalized = [];
  const creatorKey = typeof creator === 'string' ? creator.trim() : '';

  for (const collaborator of collaborators || []) {
    if (typeof collaborator !== 'string') continue;

    const trimmed = collaborator.trim();
    if (!trimmed || trimmed === creatorKey || seen.has(trimmed)) continue;

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  let mongoose;

  try {
    ({ default: mongoose } = await import('mongoose'));
    const [{ initMongooseConnection }, { default: Block }] = await Promise.all([
      import('../../server/db/mongoose.js'),
      import('../../server/db/models/Block.js')
    ]);

    await initMongooseConnection({ useProductionDb: args.prod });

    const query = args.blockId
      ? { _id: args.blockId }
      : { collaborators: { $exists: true, $type: 'array', $ne: [] } };

    const findQuery = Block.find(query)
      .select('_id title creator collaborators')
      .lean();

    if (args.limit) {
      findQuery.limit(args.limit);
    }

    const cursor = findQuery.cursor();

    const ops = [];
    const samples = [];
    const stats = {
      inspected: 0,
      changed: 0,
      removedCreatorRefs: 0,
      removedDuplicateOrBlankRefs: 0
    };

    for await (const block of cursor) {
      stats.inspected += 1;

      const original = Array.isArray(block.collaborators) ? block.collaborators : [];
      const cleaned = normalizeCollaborators(original, block.creator);
      if (arraysEqual(original, cleaned)) continue;

      stats.changed += 1;
      stats.removedCreatorRefs += original.filter((value) => value === block.creator).length;
      stats.removedDuplicateOrBlankRefs += original.length
        - cleaned.length
        - original.filter((value) => value === block.creator).length;

      if (samples.length < 20) {
        samples.push({
          id: String(block._id),
          title: block.title,
          creator: block.creator,
          before: original,
          after: cleaned
        });
      }

      ops.push({
        updateOne: {
          filter: { _id: block._id },
          update: { $set: { collaborators: cleaned } }
        }
      });
    }

    console.log('Collaborator cleanup summary:', stats);
    if (samples.length) {
      console.log('Sample changes:');
      samples.forEach((sample) => {
        console.log(`- ${sample.id} "${sample.title}"`);
        console.log(`  creator: ${sample.creator}`);
        console.log(`  before: ${JSON.stringify(sample.before)}`);
        console.log(`  after:  ${JSON.stringify(sample.after)}`);
      });
    }

    if (!args.write) {
      console.log('Dry run only. Re-run with --write to persist these changes.');
      return;
    }

    if (!ops.length) {
      console.log('No collaborator arrays needed updates.');
      return;
    }

    const result = await Block.bulkWrite(ops, { ordered: false });
    console.log(`Updated ${result.modifiedCount ?? 0} block(s).`);
  } finally {
    if (mongoose) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error('cleanBlockCollaborators failed:', error.message);
  process.exitCode = 1;
});

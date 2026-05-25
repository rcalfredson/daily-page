function printUsage() {
  console.log('Usage: node scripts/migrations/migratePrivateVisibilityToUnlisted.js [options]');
  console.log('');
  console.log('Safe default: dry-run mode unless --write is provided.');
  console.log('');
  console.log('Options:');
  console.log('  --prod   Use the production DB name.');
  console.log('  --write  Persist changes to MongoDB.');
  console.log('  --help   Show this help.');
}

function parseArgs(argv) {
  const args = {
    prod: false,
    write: false
  };

  for (const arg of argv) {
    switch (arg) {
      case '--prod':
        args.prod = true;
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

    const matched = await Block.countDocuments({ visibility: 'private' });
    console.log(`Matched ${matched} block(s) with legacy visibility "private".`);

    if (!args.write) {
      console.log('Dry run only. Re-run with --write to update them to "unlisted".');
      return;
    }

    const result = await Block.updateMany(
      { visibility: 'private' },
      { $set: { visibility: 'unlisted' } },
      { runValidators: false }
    );

    console.log(`Updated ${result.modifiedCount ?? 0} block(s) to visibility "unlisted".`);
  } finally {
    if (mongoose) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error('migratePrivateVisibilityToUnlisted failed:', error.message);
  process.exitCode = 1;
});

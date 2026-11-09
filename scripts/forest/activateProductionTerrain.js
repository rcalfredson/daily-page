import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

export function parseProductionTerrainArgs(args) {
  const [username, ...flags] = args;
  const confirmations = flags.filter(flag => flag.startsWith('--confirm-owner='));
  if (!username || username.startsWith('--') || username.length > 80
    || flags.some(flag => !['--authorized-production-read', '--write', '--cancel'].includes(flag)
      && !flag.startsWith('--confirm-owner='))
    || new Set(flags).size !== flags.length || confirmations.length > 1) {
    throw new Error('Expected one username and supported flags. Run with --help for usage.');
  }
  if (!flags.includes('--authorized-production-read')) {
    throw new Error('Production access requires --authorized-production-read.');
  }
  const write = flags.includes('--write');
  const confirmOwner = confirmations[0]?.slice('--confirm-owner='.length);
  if (write && !/^[a-f0-9]{24}$/.test(confirmOwner || '')) {
    throw new Error('Writes require --confirm-owner=<ObjectId from the preflight>.');
  }
  if (!write && (confirmations.length || flags.includes('--cancel'))) {
    throw new Error('--confirm-owner and --cancel require --write.');
  }
  return { username, write, confirmOwner, cancel: flags.includes('--cancel') };
}

export function productionTerrainAction(world, cancel = false) {
  if (!world || world.status !== 'active') throw new Error('Visit your production forest first; no active world was found.');
  const stored = world.terrain;
  const operation = stored?.replacement || stored;
  if (cancel) {
    if (!operation || operation.state === 'active') throw new Error('No unfinished preparation to cancel. Published terrain cannot be cancelled.');
    return 'cancel';
  }
  if (!stored) {
    if (world.reconciliation?.state !== 'idle') throw new Error('Forest reconciliation is running. Retry after it completes.');
    return 'start';
  }
  if (operation.state === 'cancelling') throw new Error('Finish cancellation with --cancel before activating.');
  if (stored.state === 'active' && !stored.replacement) {
    if (stored.generationVersion === 4) return stored.retiredActivationId ? 'cleanup' : null;
    if (world.reconciliation?.state !== 'idle') throw new Error('Forest reconciliation is running. Retry after it completes.');
    return 'upgrade';
  }
  if (operation.generationVersion !== 4) throw new Error('An unfinished older-generation activation must be cancelled first with --cancel.');
  return operation.phase === 'ready' ? 'publish' : 'step';
}

// The service owns all transactions, owner fencing, access proofs and publication.
// Every invocation is bounded; repeating it resumes the same operation.
export async function runProductionTerrainOperation({ ownerUserId, action, advance, maxSteps = 500, log = () => {} }) {
  if (!action) return { complete: true, result: null };
  let result;
  for (let step = 0; step < maxSteps; step++) {
    result = await advance({ ownerUserId, action, generationVersion: 4 });
    if (step % 25 === 0) log(`Step ${step + 1}: ${result?.state || 'cancelled'} / ${result?.phase || 'done'}`);
    if (action === 'cancel') {
      if (!result) return { complete: true, result };
    } else if (result?.state === 'active') {
      if (result.generationVersion !== 4) throw new Error('Unexpected published terrain generation. Run the read-only preflight.');
      if (!result.retiredActivationId) return { complete: true, result };
      action = 'cleanup';
    } else {
      if (!result || result.state !== 'preparing' || result.generationVersion !== 4) {
        throw new Error('Unexpected activation state. Run the read-only preflight before continuing.');
      }
      action = result.phase === 'ready' ? 'publish' : 'step';
    }
  }
  return { complete: false, result };
}

async function main() {
  if (process.argv.slice(2).some(arg => ['--help', '-h'].includes(arg))) {
    console.log(`Usage:
  npm run forest:terrain-activate-production -- USERNAME --authorized-production-read
  FOREST_LIVE_TERRAIN_ENABLED=true npm run forest:terrain-activate-production -- USERNAME --authorized-production-read --write --confirm-owner=OWNER_ID

Targets daily-page only. Without --write, reads one account's state without preparing terrain.
Add --cancel to a write command to cancel unfinished preparation; published terrain is retained.
Rerun the same write command to resume bounded work. No world seeds or placements are reset.`);
    return;
  }
  const options = parseProductionTerrainArgs(process.argv.slice(2));
  // Set before loading any models: the read-only preflight must not create collections/indexes.
  mongoose.set('autoCreate', false);
  mongoose.set('autoIndex', false);
  const { initMongooseConnection } = await import('../../server/db/mongoose.js');
  const { default: User } = await import('../../server/db/models/User.js');
  const { default: World } = await import('../../server/db/models/ForestOwnerWorld.js');
  const { validateForestOwnerTerrain } = await import('../../server/services/forestOwnerTerrain.js');
  await initMongooseConnection({ useProductionDb: true, quiet: true });
  if (mongoose.connection.name !== 'daily-page') throw new Error('Unexpected database; refusing operation.');
  const user = await User.findOne({ username: options.username }, { _id: 1, username: 1 }).lean();
  if (!user) throw new Error('Production account not found.');
  const ownerUserId = String(user._id);
  if (options.write && options.confirmOwner !== ownerUserId) throw new Error('Confirmed owner ID does not match this username. No activation was attempted.');
  const world = await World.findOne({ ownerUserId, worldRole: 'primary' },
    { status: 1, terrain: 1, 'reconciliation.state': 1 }).lean();
  validateForestOwnerTerrain(world?.terrain);
  console.log(JSON.stringify({ database: 'daily-page', username: user.username, ownerUserId,
    worldStatus: world?.status || 'missing', reconciliation: world?.reconciliation?.state,
    terrain: world?.terrain || null }, null, 2));
  const action = productionTerrainAction(world, options.cancel);
  console.log(`Planned operation: ${action || 'none; generation 4 is already active'}.`);
  if (!options.write) {
    console.log('Read-only preflight complete. No writes performed; access validation runs during activation.');
    return;
  }
  if (!action) return;
  if (action !== 'cancel' && action !== 'cleanup' && process.env.FOREST_LIVE_TERRAIN_ENABLED !== 'true') {
    throw new Error('Activation requires FOREST_LIVE_TERRAIN_ENABLED=true.');
  }
  const { default: Protection } = await import('../../server/db/models/ForestTerrainProtection.js');
  // Only the explicit write path can create these required indexes.
  await Protection.createIndexes();
  const { advanceForestOwnerTerrainActivation } = await import('../../server/services/forestOwnerTerrainActivation.js');
  const { complete } = await runProductionTerrainOperation({ ownerUserId, action,
    advance: advanceForestOwnerTerrainActivation, log: message => console.log(message) });
  if (!complete) {
    console.log('Bounded work paused. Rerun this same command to resume. New placements may remain paused until completion or cancellation.');
    process.exitCode = 2;
  } else {
    console.log(options.cancel ? 'Unfinished preparation cancelled. Previously published terrain is retained.'
      : 'Terrain generation 4 is active. Reload your production /forest.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Production terrain operation failed:', error.message);
    console.error('Run the read-only preflight to inspect state. Resume the same command, or use --write --cancel with the same owner confirmation to cancel unfinished preparation.');
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}

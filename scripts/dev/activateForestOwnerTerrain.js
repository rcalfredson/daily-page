// Explicit development-only preparation/publication. Never connects to the production database.
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import User from '../../server/db/models/User.js';
import ForestTerrainProtection from '../../server/db/models/ForestTerrainProtection.js';
import { advanceForestOwnerTerrainActivation } from '../../server/services/forestOwnerTerrainActivation.js';

const [ownerIdentifier, ...flags] = process.argv.slice(2);
if (typeof ownerIdentifier !== 'string' || !ownerIdentifier.length || ownerIdentifier.length > 80
  || ownerIdentifier.startsWith('--') || flags.some(f => !['--write', '--cancel', '--upgrade', '--cleanup', '--generation=3', '--generation=4'].includes(f))
  || flags.filter(f => f.startsWith('--generation=')).length > 1
  || flags.includes('--upgrade') && flags.includes('--generation=3')
  || flags.filter(f => ['--cancel', '--upgrade', '--cleanup'].includes(f)).length > 1) {
  throw new Error('Usage: npm run forest:terrain-activate -- <username or owner ObjectId> --write [--cancel|--upgrade|--cleanup] [--generation=3|4]');
}
if (process.env.NODE_ENV === 'production'
  || ['true', '1', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB || '').trim().toLowerCase())) {
  throw new Error('Refusing production terrain activation.');
}
if (!flags.includes('--write')) {
  console.log('No writes performed. Add --write to apply the selected development terrain operation.');
} else {
  try {
    await initMongooseConnection({ useProductionDb: false, quiet: true });
    if (mongoose.connection.name !== 'daily-page-test') throw new Error('Unexpected database.');
    const user = await User.findOne(/^[a-f0-9]{24}$/.test(ownerIdentifier)
      ? { _id: ownerIdentifier } : { username: ownerIdentifier }, { _id: 1 }).lean();
    if (!user) throw new Error('Development account was not found.');
    const ownerUserId = String(user._id);
    await ForestTerrainProtection.createIndexes();
    const cancelling = flags.includes('--cancel');
    const cleaning = flags.includes('--cleanup');
    const generationVersion = flags.includes('--generation=4') || flags.includes('--upgrade') ? 4 : 3;
    let result = await advanceForestOwnerTerrainActivation({ ownerUserId,
      action: cancelling ? 'cancel' : cleaning ? 'cleanup' : flags.includes('--upgrade') ? 'upgrade' : 'start', generationVersion });
    // Bound each invocation; a large owner can resume the same operation in a later invocation.
    for (let step = 0; step < 500 && result && result.state !== 'active'
      && (cancelling || result.phase !== 'ready'); step += 1) {
      result = await advanceForestOwnerTerrainActivation({ ownerUserId,
        action: cancelling ? 'cancel' : 'step' });
    }
    if (!cancelling && result?.state === 'preparing' && result.phase === 'ready') {
      result = await advanceForestOwnerTerrainActivation({ ownerUserId, action: 'publish' });
    }
    for (let step = 0; step < 500 && result?.state === 'active' && result.retiredActivationId; step++) {
      result = await advanceForestOwnerTerrainActivation({ ownerUserId, action: 'cleanup' });
    }
    console.log(cleaning ? !result ? 'No retired terrain cleanup is pending.'
      : result.retiredActivationId ? 'Retired terrain cleanup paused; rerun this command.' : 'Retired terrain cleanup complete.'
      : !result ? 'Unfinished preparation cancelled. Any published terrain remains active.' : result.state === 'active'
      ? `Terrain generation ${result.generationVersion} is active. Reload /forest in the development app.${result.retiredActivationId ? ' Rerun to finish retired-protection cleanup.' : ''}`
      : `Preparation paused at ${result.phase}; rerun this command to resume.`);
  } finally { await mongoose.disconnect(); }
}

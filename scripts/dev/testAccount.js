import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import User from '../../server/db/models/User.js';
import AccountDeletionRequest from '../../server/db/models/AccountDeletionRequest.js';
import { deleteAccount } from '../../server/services/accountDeletion.js';
import { accountDeletionCleanupHasConverged } from '../../server/services/accountDeletionEvidence.js';
import { cleanUpAccountDeletionForests } from '../../server/services/accountDeletionForestCleanup.js';
import { cleanUpAccountDeletionMedia } from '../../server/services/accountDeletionMedia.js';

const usage = `Usage:
  npm run test-account -- create [label]
  npm run test-account -- list
  npm run test-account -- delete <account-id>`;

async function create(label) {
  const username = `test-${label}-${randomBytes(6).toString('hex')}`;
  const email = `${username}@example.invalid`;
  const password = randomBytes(18).toString('base64url');
  const user = await User.create({
    username, email, password: await bcrypt.hash(password, 10),
    verified: true, disposableTestAccount: true
  });
  console.log(`Username: ${username}\nEmail: ${email}\nPassword: ${password}\nAccount ID: ${user.id}`);
}

async function list() {
  const accounts = await User.find({ disposableTestAccount: true }, { username: 1, email: 1 })
    .sort({ createdAt: 1 }).lean();
  if (!accounts.length) console.log('No disposable test accounts.');
  for (const account of accounts) console.log(`${account._id}  ${account.username}  ${account.email}`);
}

async function remove(ownerUserId) {
  const requestFilter = { ownerUserId, disposableTestAccount: true, status: 'completed' };
  const findRequest = () => AccountDeletionRequest.findOne(requestFilter).lean();
  try {
    await deleteAccount({ userId: ownerUserId, disposition: 'delete', requireDisposableTestAccount: true });
  } catch (error) {
    if (error.code === 'NOT_DISPOSABLE_TEST_ACCOUNT') {
      throw new Error('This account was not created by the disposable test account tool.');
    }
    if (error.code !== 'ACCOUNT_NOT_FOUND') throw error;
    if (!await findRequest()) throw new Error('Disposable test account not found.');
  }

  await cleanUpAccountDeletionForests({ ownerUserId, limit: 1, treeBatchSize: 1000 });
  await cleanUpAccountDeletionMedia({ ownerUserId, limit: 1 });
  if (!accountDeletionCleanupHasConverged(await findRequest())) {
    throw new Error(`Account deleted. Cleanup is pending. Run the same delete command again for ${ownerUserId}.`);
  }
  console.log(`Deleted disposable test account ${ownerUserId} and completed cleanup.`);
}

async function main([action, argument, ...extra]) {
  if (!action || action === '--help' || action === '-h') {
    console.log(usage);
    return;
  }
  if (extra.length || !['create', 'list', 'delete'].includes(action)
    || action === 'list' && argument !== undefined
    || action === 'create' && !/^[a-z0-9](?:[a-z0-9-]{0,23})$/.test(argument ?? 'qa')
    || action === 'delete' && !/^[a-f0-9]{24}$/.test(argument ?? '')) {
    throw new Error(`Invalid command. Labels use 1–24 lowercase letters, digits or hyphens and start with a letter or digit.\n${usage}`);
  }
  if (process.env.NODE_ENV === 'production'
    || ['1', 'true', 'yes', 'on'].includes(String(process.env.USE_PRODUCTION_DB).trim().toLowerCase())) {
    throw new Error('Disposable accounts require the development test database.');
  }

  try {
    await initMongooseConnection({ useProductionDb: false, quiet: true });
    if (mongoose.connection.name !== 'daily-page-test') throw new Error('Unexpected database. Expected daily-page-test.');
    if (action === 'create') await create(argument ?? 'qa');
    if (action === 'list') await list();
    if (action === 'delete') await remove(argument);
  } finally {
    await mongoose.disconnect();
  }
}

main(process.argv.slice(2)).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

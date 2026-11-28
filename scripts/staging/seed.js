import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { initMongooseConnection, STAGING_DATABASE } from '../../server/db/mongoose.js';
import Room from '../../server/db/models/Room.js';
import User from '../../server/db/models/User.js';

async function seed() {
  if (process.env.MONGODB_TARGET?.trim() !== 'staging') {
    throw new Error('Run this command with MONGODB_TARGET=staging.');
  }
  try {
    await initMongooseConnection({ quiet: true });
    if (mongoose.connection.name !== STAGING_DATABASE) throw new Error('Unexpected staging database.');
    await Room.updateOne({ _id: 'forest-smoke' }, { $setOnInsert: {
      topic: 'Writing', name: 'Forest smoke test', description: 'Synthetic posts for staging checks.'
    } }, { upsert: true });

    const username = `staging-forest-${randomBytes(6).toString('hex')}`;
    const password = randomBytes(18).toString('base64url');
    const email = `${username}@example.invalid`;
    await User.create({ username, email, password: await bcrypt.hash(password, 10), verified: true });
    console.log(`Username: ${username}\nEmail: ${email}\nPassword: ${password}\nWriting room: /en/rooms/forest-smoke`);
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

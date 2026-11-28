import mongoose from 'mongoose';
import { config } from '../../config/config.js';

export const STAGING_DATABASE = 'daily-page-staging';

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function resolveDbName({ useProductionDb } = {}) {
  const target = process.env.MONGODB_TARGET?.trim();
  if (target !== undefined) {
    if (target !== 'staging') throw new Error('MONGODB_TARGET must be staging when set.');
    if (useProductionDb !== undefined || envFlag(process.env.USE_PRODUCTION_DB)) {
      throw new Error('MONGODB_TARGET=staging cannot be combined with USE_PRODUCTION_DB=true or a database override.');
    }
    return STAGING_DATABASE;
  }
  if (process.env.MONGODB_STAGING_URI) throw new Error('MONGODB_STAGING_URI requires MONGODB_TARGET=staging.');
  const production = useProductionDb === undefined
    ? process.env.NODE_ENV === 'production' || envFlag(process.env.USE_PRODUCTION_DB) : useProductionDb;
  return production ? 'daily-page' : 'daily-page-test';
}

function stagingUri() {
  const uri = process.env.MONGODB_STAGING_URI?.trim();
  if (!uri) throw new Error('MONGODB_STAGING_URI is required for MONGODB_TARGET=staging.');
  let client;
  try {
    client = new mongoose.mongo.MongoClient(uri);
  } catch {
    throw new Error('MONGODB_STAGING_URI must be a valid MongoDB connection string.');
  }
  if (client.options.dbName !== STAGING_DATABASE) {
    throw new Error(`MONGODB_STAGING_URI must select ${STAGING_DATABASE}.`);
  }
  return uri;
}

export async function initMongooseConnection(options = {}) {
  const dbName = resolveDbName(options);
  const isStaging = dbName === STAGING_DATABASE;
  const uri = isStaging ? stagingUri()
    : `mongodb+srv://daily-page-admin:${config.mongoDbPw}@${config.mongoDbAddr}/${dbName}?retryWrites=true&w=majority`;
  try {
    await mongoose.connect(uri, {
      dbName,
      maxPoolSize: 10,
      connectTimeoutMS: process.env.MONGODB_CONNECT_TIMEOUT || 15000,
      socketTimeoutMS: process.env.MONGODB_SOCKET_TIMEOUT || 30000,
    });
    if (!options.quiet) console.log('Mongoose connected to database', dbName);
    return dbName;
  } catch (err) {
    if (isStaging) throw new Error(`Could not connect to ${STAGING_DATABASE}. Check the staging URI, credentials, and network access.`);
    console.error('Error connecting to Mongoose:', err.message);
    throw err;
  }
}

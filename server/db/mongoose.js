import mongoose from 'mongoose';
import { config } from '../../config/config.js';

const user = 'daily-page-admin';
const addr = config.mongoDbAddr;
const pw = config.mongoDbPw;
const baseURL = `mongodb+srv://${user}:${pw}@${addr}`;

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function resolveDbName({
  useProductionDb = process.env.NODE_ENV === 'production' || envFlag(process.env.USE_PRODUCTION_DB)
} = {}) {
  return `daily-page${useProductionDb ? '' : '-test'}`;
}

export async function initMongooseConnection(options = {}) {
  try {
    const dbName = resolveDbName(options);
    const fullConnectionString = `${baseURL}/${dbName}?retryWrites=true&w=majority`;
    await mongoose.connect(fullConnectionString, {
      maxPoolSize: 10,
      connectTimeoutMS: process.env.MONGODB_CONNECT_TIMEOUT || 15000,
      socketTimeoutMS: process.env.MONGODB_SOCKET_TIMEOUT || 30000,
    });
    const safeConnStr = fullConnectionString.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    console.log('Mongoose connected to', safeConnStr);
  } catch (err) {
    console.error('Error connecting to Mongoose:', err.message);
    throw err;
  }
}

import mongoose from 'mongoose';
import { config } from '../../config/config.js';

const user = 'daily-page-admin';
const addr = config.mongoDbAddr;
const pw = config.mongoDbPw;
const baseURL = `mongodb+srv://${user}:${pw}@${addr}`;

const dbName = `daily-page${process.env.NODE_ENV === 'production' ? '' : '-test'}`;

export async function initMongooseConnection() {
  try {
    const fullConnectionString = `${baseURL}/${dbName}?retryWrites=true&w=majority`;
    await mongoose.connect(fullConnectionString, {
      maxPoolSize: 10,
      connectTimeoutMS: process.env.MONGODB_CONNECT_TIMEOUT || 15000,
      socketTimeoutMS: process.env.MONGODB_SOCKET_TIMEOUT || 30000,
    });
    console.log('Mongoose connected to', fullConnectionString);
  } catch (err) {
    console.error('Error connecting to Mongoose:', err.message);
    throw err;
  }
}

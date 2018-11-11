const { MongoClient } = require('mongodb');
const dateHelper = require('../build/dateHelper');

const user = 'daily-page-admin';
const addr = process.env.MONGO_DB_ADDR;
const pw = process.env.MONGO_DB_PW;
const url = `mongodb+srv://${user}:${pw}@${addr}?retryWrites=true`;
const dbName = 'daily-page';
const collectionNames = { session: 'session-data', pages: 'pages' };
const collections = { session: null, pages: null };

let connection;
let db;

async function initConnection() {
  const connectTimeoutMS = process.env.MONGODB_CONNECT_TIMEOUT || 15000;
  const socketTimeoutMS = process.env.MONGODB_SOCKET_TIMEOUT || 30000;

  connection = await MongoClient.connect(url, {
    useNewUrlParser: true,
    poolSize: 10,
    connectTimeoutMS,
    socketTimeoutMS,
  });
}

async function initDB() {
  db = await connection.db(dbName);
}

async function initCollection(name) {
  await initDB();
  collections[name] = await db.collection(collectionNames[name]);
}

async function initPagesCollection() {
  await initCollection('pages');
}

async function initSessionCollection() {
  await initCollection('session');
}

async function peerIDs() {
  await initSessionCollection();
  const doc = await collections.session.findOne({ _id: peerIDs });
  delete doc._id; // eslint-disable-line no-underscore-dangle
  return doc;
}

async function rooms() {
  return Object.keys(await peerIDs());
}

async function addPeer(id) {
  await initSessionCollection();
  return collections.session.updateOne({ _id: peerIDs }, { $push: { peerIDs: id } });
}

async function removePeer(id) {
  await initSessionCollection();
  return collections.session.updateOne({ _id: peerIDs }, { $pull: { peerIDs: id } });
}

async function updatePage(content) {
  await initPagesCollection();
  return collections.pages
    .updateOne({ _id: dateHelper.currentDate() },
      { $set: { content, lastUpdate: new Date().getTime() } }, { upsert: true });
}

async function pageByDate(date) {
  return collections.pages.findOne({ _id: date });
}

async function getPage(date = dateHelper.currentDate()) {
  await initPagesCollection();
  try {
    return pageByDate(date);
  } catch (error) {
    await updatePage('');
    return pageByDate(date);
  }
}

module.exports = {
  initConnection,
  peerIDs,
  rooms,
  addPeer,
  removePeer,
  getPage,
  updatePage,
};

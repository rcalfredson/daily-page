const { MongoClient } = require('mongodb');
const moment = require('moment-timezone');

const user = 'daily-page-admin';
const pw = process.env.MONGO_DB_PW;
const url = `mongodb+srv://${user}:${pw}@dailypage-olyqk.gcp.mongodb.net/test?retryWrites=true`;
const dbName = 'daily-page';
const collectionNames = { session: 'session-data', pages: 'pages' };
const collections = { session: null, pages: null };

let connection;
let db;

async function initDB() {
  const connectTimeoutMS = process.env.MONGODB_CONNECT_TIMEOUT || 15000;
  const socketTimeoutMS = process.env.MONGODB_SOCKET_TIMEOUT || 30000;

  connection = await MongoClient.connect(url, {
    useNewUrlParser: true,
    poolSize: 10,
    connectTimeoutMS,
    socketTimeoutMS,
  });
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
  return (await collections.session.findOne({ _id: peerIDs })).peerIDs;
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
  const currentDate = moment(Date.now()).tz('Europe/London').format('YYYY-MM-DD');
  return collections.pages
    .updateOne({ _id: currentDate }, { $set: { content } }, { upsert: true });
}

module.exports = {
  peerIDs,
  addPeer,
  removePeer,
  updatePage,
};

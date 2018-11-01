const { MongoClient } = require('mongodb');

const user = 'daily-page-admin';
const pw = process.env.MONGO_DB_PW;
const url = `mongodb+srv://${user}:${pw}@dailypage-olyqk.gcp.mongodb.net/test?retryWrites=true`;
const dbName = 'daily-page';
const collectionName = 'session-data';

let collection;
let connection;
let db;

async function init() {
  const connectTimeoutMS = process.env.MONGODB_CONNECT_TIMEOUT || 15000;
  const socketTimeoutMS = process.env.MONGODB_SOCKET_TIMEOUT || 30000;

  connection = await MongoClient.connect(url, {
    useNewUrlParser: true,
    poolSize: 10,
    connectTimeoutMS,
    socketTimeoutMS,
  });
  db = await connection.db(dbName);
  collection = db.collection(collectionName);
}

async function peerIDs() {
  await init();

  return (await collection.findOne({ _id: peerIDs })).peerIDs;
}

async function addPeer(id) {
  await init();

  return collection.updateOne({ _id: peerIDs }, { $push: { peerIDs: id } });
}

async function removePeer(id) {
  await init();

  return collection.updateOne({ _id: peerIDs }, { $pull: { peerIDs: id } });
}

module.exports = {
  init,
  peerIDs,
  addPeer,
  removePeer,
};

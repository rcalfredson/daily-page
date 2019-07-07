/* eslint-disable no-underscore-dangle */
const { MongoClient } = require('mongodb');
const sanitizeHtml = require('sanitize-html');
const dateHelper = require('../build/dateHelper');

const user = 'daily-page-admin';
const addr = process.env.MONGO_DB_ADDR;
const pw = process.env.MONGO_DB_PW;
const url = `mongodb+srv://${user}:${pw}@${addr}?retryWrites=true`;
const dbName = 'daily-page';
const collectionNames = { session: 'session-data', pages: 'pages' };
const collections = { session: null, pages: null };
const collectionSuffix = process.env.NODE_ENV === 'production' ? '' : '-test';

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
  collections[name] = await db.collection(`${collectionNames[name]}${collectionSuffix}`);
}

async function initPagesCollection() {
  await initCollection('pages');
}

async function initSessionCollection() {
  await initCollection('session');
}

async function peerIDs(room = null) {
  await initSessionCollection();
  const doc = await collections.session.findOne({ _id: peerIDs });
  delete doc._id; // eslint-disable-line no-underscore-dangle
  return room ? doc[room] : doc;
}

async function rooms() {
  return Object.keys(await peerIDs());
}

async function addPeer(id, room) {
  await initSessionCollection();
  return collections.session.updateOne({ _id: peerIDs }, { $push: { [room]: id } });
}

async function removePeer(id, room) {
  await initSessionCollection();
  return collections.session.updateOne({ _id: peerIDs }, { $pull: { [room]: id } });
}

async function updatePage(content, room) {
  await initPagesCollection();
  const date = dateHelper.currentDate();
  const dateArray = date.split('-');

  return collections.pages
    .updateOne({
      date, room, year: dateArray[0], month: dateArray[1], day: dateArray[2],
    },
    { $set: { content: sanitizeHtml(content), lastUpdate: new Date().getTime() } },
    { upsert: true });
}

async function pageByDate(date) {
  const pages = await collections.pages.find({ date }).toArray();

  if (pages.length === 0) {
    return null;
  }

  const content = (pages).sort((docA, docB) => {
    const roomA = docA.room.toUpperCase();
    const roomB = docB.room.toUpperCase();

    if (roomA < roomB) {
      return -1;
    }
    return (roomA > roomB) ? 1 : 0;
  }).map(doc => doc.content).join('\n');

  return { content };
}

async function pageByDateAndRoom(date, room, options) {
  return collections.pages.findOne({ date, room },
    { projection: options ? Object.assign({ _id: 0 }, options) : null });
}

async function getPageDatesByYearAndMonth(year, month) {
  await initPagesCollection();
  return (await collections.pages.find({ year, month }, { date: 1 }).sort({ date: -1 }).toArray())
    .map(doc => doc.date).filter((v, i, a) => a.indexOf(v) === i);
}

async function getPageMonthYearCombos() {
  await initPagesCollection();
  return (await collections.pages.aggregate([
    { $sort: { year: 1, month: 1 } },
    { $group: { _id: { year: '$year', month: '$month' } } }]).toArray())
    .map(doc => ({ year: doc._id.year, month: doc._id.month }));
}

async function getPageForRoom(date, room, options) {
  try {
    const page = await pageByDateAndRoom(date, room, options);
    if (!page) {
      throw new Error('Page does not exist.');
    }
    return page;
  } catch (error) {
    await updatePage('', room);
    return pageByDateAndRoom(date, room, options);
  }
}

async function getPage(date = dateHelper.currentDate(), room = null, options = null) {
  await initPagesCollection();
  if (room) {
    return getPageForRoom(date, room, options);
  }
  return pageByDate(date);
}

module.exports = {
  initConnection,
  peerIDs,
  rooms,
  addPeer,
  removePeer,
  getPage,
  updatePage,
  getPageDatesByYearAndMonth,
  getPageMonthYearCombos,
};

/* eslint-disable no-underscore-dangle */
const { all } = require('bluebird');
const { MongoClient } = require('mongodb');
const sanitizeHtml = require('sanitize-html');

sanitizeHtml.defaults.allowedAttributes.img = ['src', 'width'];
const dateHelper = require('../build/dateHelper');

const user = 'daily-page-admin';
const addr = process.env.MONGO_DB_ADDR;
const pw = process.env.MONGO_DB_PW;
const url = `mongodb+srv://${user}:${pw}@${addr}?retryWrites=true`;
const dbName = 'daily-page';
const collectionNames = {
  session: 'session-data',
  pages: 'pages',
  backup: 'doc-backup',
};
const collections = { session: null, pages: null, backup: null };
const collectionSuffix = process.env.NODE_ENV === 'production' ? '' : '-test';

let connection;
let db;

async function initConnection() {
  const connectTimeoutMS = process.env.MONGODB_CONNECT_TIMEOUT || 15000;
  const socketTimeoutMS = process.env.MONGODB_SOCKET_TIMEOUT || 30000;

  connection = await MongoClient.connect(url, {
    useUnifiedTopology: true,
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

async function initBackupCollection() {
  await initCollection('backup');
}

async function updateDocMappings(mappings) {
  await initBackupCollection();
  await collections.backup.replaceOne({ _id: 'docMappings' }, mappings, { upsert: true });
  await collections.backup.updateOne({ _id: 'lastUpdate' }, { $set: { ts: new Date().getTime() } });
}

async function getDocMappings() {
  await initBackupCollection();
  const update = await collections.backup.findOne({ _id: 'lastUpdate' });

  if (new Date().getTime() - update.ts > 5 * 60 * 1000) {
    throw new Error('Doc mappings outdated');
  }
  const doc = await collections.backup.findOne({ _id: 'docMappings' });
  delete doc._id; // eslint-disable-line no-underscore-dangle
  return doc;
}

async function peerIDs(room = null, withTime = false) {
  await initSessionCollection();
  const doc = await collections.session.findOne({ _id: peerIDs });
  delete doc._id; // eslint-disable-line no-underscore-dangle
  if (withTime) {
    return doc;
  }
  return room ? Object.keys(doc[room]) : Object.keys(doc).reduce((obj, x) => {
    obj[x] = Object.keys(doc[x]);
    return obj;
  }, {});
}

async function cleanUpOldPeerIds() {
  const maxPeerAge = 24 * 60 * 60 * 1000;
  const allIds = await peerIDs(null, withTime = true);
  for (const room of Object.keys(allIds)) {
    for (const peer in allIds[room]) {
      if (new Date() - allIds[room][peer] > maxPeerAge) {
        await removePeer(peer, room);
      }
    }
  }
}

async function rooms() {
  return Object.keys(await peerIDs());
}

async function addPeer(id, room) {
  await initSessionCollection();
  return collections.session.updateOne({ _id: peerIDs }, { $set: { [`${room}.${id}`]: new Date() } });
}

async function removePeer(id, room) {
  await initSessionCollection();
  return collections.session.updateOne({ _id: peerIDs }, { $unset: { [`${room}.${id}`]: '' } });
}

async function updatePage(content, room) {
  await initPagesCollection();
  const date = dateHelper.currentDate();
  const dateArray = date.split('-');

  return collections.pages
    .updateOne({
      date, room, year: dateArray[0], month: dateArray[1], day: dateArray[2],
    },
    {
      $set: {
        content: sanitizeHtml(content, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        }),
        lastUpdate: new Date().getTime(),
      },
    },
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
  }).map((doc) => doc.content).join('\n');

  return { content };
}

async function pageByDateAndRoom(date, room, options) {
  const keysToConvertToInt = ['lastUpdate'];
  keysToConvertToInt.forEach((k) => {
    if (options[k] === 'true') {
      options[k] = 1;
    } else if (options[k] === 'false') {
      options[k] = 0;
    }
  });
  return collections.pages.findOne({ date, room },
    { projection: options ? Object.assign(options, { _id: 0 }) : null });
}

async function getPageDatesByYearAndMonth(year, month) {
  await initPagesCollection();
  return (await collections.pages.find({ year, month }, { date: 1 }).sort({ date: -1 }).toArray())
    .reduce((accumulator, doc) => {
      if (!(doc.content.charCodeAt(0) === 8203 && doc.content.length === 1) && doc.content.replace(/\s+/g, '').length > 0) {
        return accumulator.concat(doc);
      }
      return accumulator;
    }, [])
    .map((doc) => doc.date).filter((v, i, a) => a.indexOf(v) === i);
}

async function getPageMonthYearCombos() {
  await initPagesCollection();
  return (await collections.pages.aggregate([
    {
      $project: {
        date: { $dateFromString: { dateString: '$date' } }, year: '$year', month: '$month', content: '$content',
      },
    },
    { $sort: { date: -1 } }]).toArray())
    .reduce((accumulator, doc) => {
      if (!accumulator.some((result) => result.year === doc.year && result.month === doc.month) && !(doc.content.charCodeAt(0) === 8203 && doc.content.length === 1) && doc.content.replace(/\s+/g, '').length > 0) {
        return accumulator.concat({ year: doc.year, month: doc.month });
      }
      return accumulator;
    }, []);
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
  cleanUpOldPeerIds,
  getPage,
  updatePage,
  getDocMappings,
  updateDocMappings,
  getPageDatesByYearAndMonth,
  getPageMonthYearCombos,
};

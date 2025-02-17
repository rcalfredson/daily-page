/* eslint-disable no-underscore-dangle */
import mongo from 'mongodb';
import sanitizeHtml from 'sanitize-html';
import DateHelper from '../../lib/dateHelper.js';

const { MongoClient } = mongo;

sanitizeHtml.defaults.allowedAttributes.img = ['src', 'width'];

const user = 'daily-page-admin';
const addr = process.env.MONGO_DB_ADDR;
const pw = process.env.MONGO_DB_PW;
const url = `mongodb+srv://${user}:${pw}@${addr}?retryWrites=true`;
const dbName = 'daily-page';
const collectionNames = {
  session: 'session-data',
  pages: 'pages',
  backup: 'doc-backup',
  rooms: 'room-metadata',
  sites: 'sites',
  operations: 'operations'
};
const collections = { session: null, pages: null, backup: null };
const collectionSuffix = process.env.NODE_ENV === 'production' ? '' : '-test';

let connection;
let db;

export async function initConnection() {
  const connectTimeoutMS = process.env.MONGODB_CONNECT_TIMEOUT || 15000;
  const socketTimeoutMS = process.env.MONGODB_SOCKET_TIMEOUT || 30000;

  connection = await MongoClient.connect(url, {
    maxPoolSize: 10,
    connectTimeoutMS,
    socketTimeoutMS,
  });
}

export async function initDB() {
  db = await connection.db(dbName);
}

export async function initCollection(name) {
  await initDB();
  collections[name] = await db.collection(`${collectionNames[name]}${collectionSuffix}`);
}

export async function getCollection(name) {
  if (!collections[name]) {
    await initCollection(name);
  }
  return collections[name];
}

export async function initPagesCollection() {
  await initCollection('pages');
}

export async function initSessionCollection() {
  await initCollection('session');
}

export async function initBackupCollection() {
  await initCollection('backup');
}

export async function initRoomMetadataCollection() {
  await initCollection('rooms');
}

export async function getRoomMetadata(roomId) {
  try {
    const collection = await getCollection('rooms');
    return await collection.findOne({ _id: roomId });
  } catch (error) {
    console.error(`Error fetching room metadata for ID: ${roomId}`, error.message);
    throw error;
  }
}

export async function getAllRooms() {
  try {
    await initRoomMetadataCollection(); // Ensure the collection is initialized
    const roomsCollection = await getCollection('rooms');
    return await roomsCollection.find({}).toArray(); // Fetch all rooms as an array
  } catch (error) {
    console.error('Error fetching all rooms:', error.message);
    throw error;
  }
}

export async function updateDocMappings(mappings) {
  await initBackupCollection();
  await collections.backup.replaceOne({ _id: 'docMappings' }, mappings, { upsert: true });
  await collections.backup.updateOne({ _id: 'lastUpdate' }, { $set: { ts: new Date().getTime() } });
}

export async function getDocMappings() {
  await initBackupCollection();
  const update = await collections.backup.findOne({ _id: 'lastUpdate' });

  if (new Date().getTime() - update.ts > 5 * 60 * 1000) {
    throw new Error('Doc mappings outdated');
  }
  const doc = await collections.backup.findOne({ _id: 'docMappings' });
  delete doc._id; // eslint-disable-line no-underscore-dangle
  return doc;
}

export async function peerIDs(room = null, withTime = false) {
  await initSessionCollection();
  if (room) {
    const doc = await collections.session.findOne({ _id: room });
    if (!doc) return {};
    return withTime ? doc.peers : Object.keys(doc.peers || {});
  }

  const cursor = await collections.session.find({}, { projection: { peers: 1 } });
  const result = {};
  await cursor.forEach(doc => {
    result[doc._id] = withTime ? doc.peers : Object.keys(doc.peers || {});
  });
  return result;
}

export async function cleanUpOldPeerIds() {
  await initSessionCollection();
  const maxPeerAge = 24 * 60 * 60 * 1000; // 24 hours
  const now = new Date();

  const cursor = await collections.session.find({});
  const bulkOps = [];

  await cursor.forEach(doc => {
    const updatedPeers = {};
    for (const [peer, timestamp] of Object.entries(doc.peers || {})) {
      if (now - new Date(timestamp) <= maxPeerAge) {
        updatedPeers[peer] = timestamp;
      }
    }
    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { peers: updatedPeers } }
      }
    });
  });

  if (bulkOps.length) {
    await collections.session.bulkWrite(bulkOps);
  }
}

export async function rooms() {
  const cursor = await collections.session.find({}, { projection: { _id: 1 } });
  const roomIds = [];
  await cursor.forEach(doc => roomIds.push(doc._id));
  return roomIds;
}

export async function addPeer(id, room) {
  await initSessionCollection();
  return collections.session.updateOne(
    { _id: room },
    { $set: { [`peers.${id}`]: new Date() } },
    { upsert: true }
  );
}

export async function removePeer(id, room) {
  await initSessionCollection();
  return collections.session.updateOne(
    { _id: room },
    { $unset: { [`peers.${id}`]: '' } }
  );
}

export async function updatePage(content, room) {
  await initPagesCollection();
  const date = DateHelper.currentDate();
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

export async function pageByDate(date) {
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

export async function pagesByDate(date) {
  await initPagesCollection();
  try {
    const pages = await collections.pages.find({ date }).toArray();
    return pages;
  } catch (error) {
    console.error(`Error fetching pages for date: ${date}`, error.message);
    return [];
  }
}

export async function pageByDateAndRoom(date, room, options) {
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

export async function getPageDatesByYearAndMonth(year, month) {
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

export async function getPageMonthYearCombos() {
  await initPagesCollection();
  return (await collections.pages.aggregate([
    {
      $project: {
        date: { $dateFromString: { dateString: '$date' } }, year: '$year', month: '$month', content: '$content',
      },
    },
    { $sort: { date: -1 } }]).toArray())
    .reduce((accumulator, doc) => {
      if (!accumulator.some(
        (result) => result.year === doc.year && result.month === doc.month) &&
        !(doc.content.charCodeAt(0) === 8203 && doc.content.length === 1) &&
        doc.content.replace(/\s+/g, '').length > 0) {
        return accumulator.concat({ year: doc.year, month: doc.month });
      }
      return accumulator;
    }, []);
}

export async function getPageForRoom(date, room, options) {
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

export async function getPage(date = DateHelper.currentDate(), room = null, options = null) {
  await initPagesCollection();
  if (room) {
    return getPageForRoom(date, room, options);
  }
  return pageByDate(date);
}

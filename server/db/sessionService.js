import Session from './models/Session.js';
import Room from './models/Room.js';

let recentlyActiveCache = null;
let recentlyActiveCacheExpiration = 0;

/**
 * Return the peer IDs for a given room (or for all rooms).
 * @param {string|null} room 
 * @param {boolean} withTime 
 * @returns {Object} either an object of { [roomId]: peersOrTimestamps } or just the peers
 */
export async function getPeerIDs(room = null, withTime = false) {
  if (room) {
    let doc = await Session.findOne({ _id: room });
    if (!doc) return {};
    doc = doc.toObject();

    return withTime ? doc.peers : Object.keys(doc.peers || {});
  }

  // If no room is specified, gather them all
  const sessions = (await Session.find(
    {}, { peers: 1, _id: 1 })).map(doc => doc.toObject());

  const result = {};
  for (const doc of sessions) {
    result[doc._id] = withTime
      ? doc.peers
      : Object.keys(doc.peers || {});
  }
  return result;
}

/**
 * Removes peers older than 24 hours
 */
export async function cleanUpOldPeerIds() {
  const maxPeerAge = 24 * 60 * 60 * 1000; // 24 hours
  const now = new Date();

  // Grab all session docs so we can prune them in one go
  const sessions = (await Session.find({})).map(doc => doc.toObject());
  const bulkOps = [];

  for (const doc of sessions) {
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
  }

  if (bulkOps.length) {
    // Mongoose supports accessing the raw collection object:
    await Session.collection.bulkWrite(bulkOps);
  }
}

/**
 * Add a peer to a session
 */
export async function addPeer(id, room) {
  // Upsert means create new doc if it doesn't exist
  return Session.updateOne(
    { _id: room },
    { $set: { [`peers.${id}`]: new Date() } },
    { upsert: true }
  );
}

/**
 * Remove a peer from a session
 */
export async function removePeer(id, room) {
  return Session.updateOne(
    { _id: room },
    { $unset: { [`peers.${id}`]: '' } }
  );
}

/**
 * Gets X number of "recently active" rooms, meaning rooms with the most peers.
 */
export async function getRecentlyActiveRooms(limit = 5) {
  const now = Date.now();
  // If we have a valid cache, return it
  if (recentlyActiveCache && now < recentlyActiveCacheExpiration) {
    return recentlyActiveCache;
  }

  try {
    // Get all sessions, focusing on peers
    const sessions = (await Session.find(
      {}, { peers: 1, _id: 1 })).map(doc => doc.toObject());
    const activityData = [];

    for (const doc of sessions) {
      const activeUsers = Object.keys(doc.peers || {}).length;
      if (activeUsers > 0) {
        activityData.push({ roomId: doc._id, activeUsers });
      }
    }

    // Sort descending by activeUsers
    activityData.sort((a, b) => b.activeUsers - a.activeUsers);
    const topRooms = activityData.slice(0, limit);

    // For each top room, fetch the Room info
    const promises = topRooms.map(async ({ roomId, activeUsers }) => {
      const room = (await Room.findOne({ _id: roomId })).toObject();
      return room ? { ...room, activeUsers } : null;
    });
    const results = await Promise.all(promises);

    // Filter out null
    const final = results.filter(Boolean);

    // Cache the final data for 60 seconds
    recentlyActiveCache = final;
    recentlyActiveCacheExpiration = now + 60 * 1000;

    return final;
  } catch (error) {
    console.error('Error fetching recently active rooms:', error.message);
    throw error;
  }
}

/**
 * Gets the number of active users in a given room
 */
export async function getActiveUsers(roomId) {
  try {
    let doc = await Session.findOne({ _id: roomId }, { peers: 1 });
    if (!doc || !doc.peers) return 0;
    doc = doc.toObject();
    return Object.keys(doc.peers).length;
  } catch (error) {
    console.error(`Error fetching active users for room ${roomId}:`, error.message);
    throw error;
  }
}

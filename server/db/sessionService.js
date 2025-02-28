import Session from './models/Session.js';
import Room from './models/Room.js';

let recentlyActiveCache = null;
let recentlyActiveCacheExpiration = 0;

/**
 * Return the peer IDs for a given block (or all blocks).
 * @param {string|null} blockId - If provided, fetch peers for a single block.
 * @param {boolean} withTime - If true, return peers with timestamps.
 * @returns {Object} - { [blockId]: peers } or a peer list for a specific block.
 */
export async function getPeerIDs(blockId = null, withTime = false) {
  if (blockId) {
    let session = await Session.findOne({ _id: blockId });
    if (!session) return {};
    return withTime ? session.peers : Object.keys(session.peers || {});
  }

  // Fetch all sessions (blocks) if no specific block is requested
  const sessions = await Session.find({}, { peers: 1, _id: 1 }).lean();
  const result = {};

  for (const session of sessions) {
    result[session._id] = withTime ? session.peers : Object.keys(session.peers || {});
  }
  return result;
}

/**
 * Removes expired peers and deletes sessions for blocks older than 24 hours.
 */
export async function cleanUpExpiredSessions() {
  const maxPeerAge = 24 * 60 * 60 * 1000; // 24 hours
  const now = new Date();

  // Grab all session docs
  const sessions = await Session.find({}).lean();
  const bulkOps = [];
  const sessionsToDelete = [];

  for (const session of sessions) {
    const updatedPeers = {};

    for (const [peer, timestamp] of Object.entries(session.peers || {})) {
      if (now - new Date(timestamp) <= maxPeerAge) {
        updatedPeers[peer] = timestamp;
      }
    }

    if (Object.keys(updatedPeers).length > 0) {
      // Session still has active peers, so update it
      bulkOps.push({
        updateOne: {
          filter: { _id: session._id },
          update: { $set: { peers: updatedPeers } }
        }
      });
    } else {
      // No active peers left → Schedule session for deletion
      sessionsToDelete.push(session._id);
    }
  }

  // Perform updates
  if (bulkOps.length > 0) {
    await Session.bulkWrite(bulkOps);
  }

  // Delete expired sessions
  if (sessionsToDelete.length > 0) {
    await Session.deleteMany({ _id: { $in: sessionsToDelete } });
  }

  console.log(`✅ Cleaned up expired sessions: Deleted ${sessionsToDelete.length} and updated ${bulkOps.length}.`);
}

/**
 * Add a peer to a block session and associate it with a room.
 * @param {string} peerId - ID of the peer.
 * @param {string} blockId - ID of the block.
 * @param {string} roomId - ID of the room.
 */
export async function addPeer(peerId, blockId, roomId) {
  return await Session.updateOne(
    { _id: blockId },
    { 
      $set: { 
        [`peers.${peerId}`]: new Date(),
        roomId: roomId  // Ensure the session is linked to the correct room
      }
    },
    { upsert: true }
  );
}

/**
 * Remove a peer from a block session.
 * @param {string} peerId - ID of the peer.
 * @param {string} blockId - ID of the block.
 */
export async function removePeer(peerId, blockId) {
  return await Session.updateOne(
    { _id: blockId },
    { $unset: { [`peers.${peerId}`]: '' } }
  );
}

/**
 * Gets X number of "recently active" rooms, meaning rooms with the most peers across their blocks.
 */
export async function getRecentlyActiveRooms(limit = 5) {
  const now = Date.now();
  
  if (recentlyActiveCache && now < recentlyActiveCacheExpiration) {
    return recentlyActiveCache;
  }

  try {
    // Get all active block sessions (blocks with peers)
    const sessions = await Session.find({ peers: { $exists: true, $ne: {} } }).lean();

    // Group by room
    const roomActivity = {};
    for (const session of sessions) {
      if (!session.roomId) continue; // Skip if no room ID is recorded
      
      if (!roomActivity[session.roomId]) {
        roomActivity[session.roomId] = new Set();
      }

      Object.keys(session.peers).forEach(peer => roomActivity[session.roomId].add(peer));
    }

    // Convert to array and sort by most active users
    const sortedRooms = Object.entries(roomActivity)
      .map(([roomId, peers]) => ({ roomId, activeUsers: peers.size }))
      .sort((a, b) => b.activeUsers - a.activeUsers)
      .slice(0, limit);

    // Fetch room info for the top rooms
    const promises = sortedRooms.map(async ({ roomId, activeUsers }) => {
      const room = await Room.findOne({ _id: roomId }).lean();
      return room ? { ...room, activeUsers } : null;
    });

    const results = await Promise.all(promises);
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
 * Gets the number of active users in a given room.
 * Now aggregates across all blocks in the room.
 */
export async function getActiveUsers(roomId) {
  try {
    const sessions = await Session.find({ roomId }).lean();
    
    const uniqueUsers = new Set();
    sessions.forEach(session => {
      Object.keys(session.peers || {}).forEach(peer => uniqueUsers.add(peer));
    });

    return uniqueUsers.size;
  } catch (error) {
    console.error(`Error fetching active users for room ${roomId}:`, error.message);
    throw error;
  }
}

import Session from './models/Session.js';
import Room from './models/Room.js';
import Block from './models/Block.js';
import { publiclyVisibleBlockMatch } from './blockService.js';

export const PEER_TTL_MS = 5 * 60 * 1000;
export const RECENT_ROOM_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

let recentlyActiveCache = null;
let recentlyActiveCacheExpiration = 0;

function isFreshPeer(timestamp, now = new Date()) {
  return now - new Date(timestamp) <= PEER_TTL_MS;
}

function splitPeersByFreshness(peers = {}, now = new Date()) {
  const activePeers = {};
  const expiredPeerIds = [];

  for (const [peerId, timestamp] of Object.entries(peers || {})) {
    if (isFreshPeer(timestamp, now)) {
      activePeers[peerId] = timestamp;
    } else {
      expiredPeerIds.push(peerId);
    }
  }

  return { activePeers, expiredPeerIds };
}

async function pruneExpiredPeersForSession(session, now = new Date()) {
  if (!session) return {};

  const { activePeers, expiredPeerIds } = splitPeersByFreshness(session.peers, now);
  if (!expiredPeerIds.length) return activePeers;

  if (Object.keys(activePeers).length > 0) {
    const unsetFields = expiredPeerIds.reduce((fields, peerId) => {
      fields[`peers.${peerId}`] = '';
      return fields;
    }, {});

    await Session.updateOne({ _id: session._id }, { $unset: unsetFields });
  } else {
    await Session.deleteOne({ _id: session._id });
  }

  return activePeers;
}

/**
 * Return the peer IDs for a given block (or all blocks).
 * @param {string|null} blockId - If provided, fetch peers for a single block.
 * @param {boolean} withTime - If true, return peers with timestamps.
 * @returns {Object} - { [blockId]: peers } or a peer list for a specific block.
 */
export async function getPeerIDs(blockId = null, withTime = false) {
  if (blockId) {
    const session = await Session.findOne({ _id: blockId });
    if (!session) return withTime ? {} : [];

    const activePeers = await pruneExpiredPeersForSession(session);
    return withTime ? activePeers : Object.keys(activePeers);
  }

  // Fetch all sessions (blocks) if no specific block is requested
  const sessions = await Session.find({}, { peers: 1, _id: 1 }).lean();
  const result = {};

  for (const session of sessions) {
    const activePeers = await pruneExpiredPeersForSession(session);
    result[session._id] = withTime ? activePeers : Object.keys(activePeers);
  }
  return result;
}

/**
 * Removes expired peers and deletes sessions for blocks older than 24 hours.
 */
export async function cleanUpExpiredSessions() {
  const now = new Date();

  // Grab all session docs
  const sessions = await Session.find({}).lean();
  const bulkOps = [];
  const sessionsToDelete = [];

  for (const session of sessions) {
    const updatedPeers = {};

    Object.assign(updatedPeers, splitPeersByFreshness(session.peers, now).activePeers);

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

export function rankRoomActivity(recentBlockActivity = [], sessions = [], now = new Date()) {
  const roomActivity = new Map();

  for (const activity of recentBlockActivity) {
    if (!activity?._id) continue;

    roomActivity.set(String(activity._id), {
      activePeers: new Set(),
      recentPosts: activity.recentPosts || 0,
      lastActivityAt: activity.lastActivityAt || null
    });
  }

  for (const session of sessions) {
    if (!session.roomId) continue;

    const roomId = String(session.roomId);
    const activity = roomActivity.get(roomId) || {
      activePeers: new Set(),
      recentPosts: 0,
      lastActivityAt: null
    };
    const { activePeers } = splitPeersByFreshness(session.peers, now);

    for (const [peerId, timestamp] of Object.entries(activePeers)) {
      activity.activePeers.add(peerId);
      if (!activity.lastActivityAt || new Date(timestamp) > new Date(activity.lastActivityAt)) {
        activity.lastActivityAt = timestamp;
      }
    }

    if (activity.activePeers.size || activity.recentPosts) {
      roomActivity.set(roomId, activity);
    }
  }

  return [...roomActivity.entries()]
    .map(([roomId, activity]) => ({
      roomId,
      activeUsers: activity.activePeers.size,
      recentPosts: activity.recentPosts,
      lastActivityAt: activity.lastActivityAt
    }))
    .sort((a, b) => (
      b.activeUsers - a.activeUsers ||
      new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0) ||
      b.recentPosts - a.recentPosts
    ));
}

/**
 * Gets recently active rooms using fresh editor sessions and recent public post updates.
 */
export async function getRecentlyActiveRooms(limit = 5) {
  const now = Date.now();

  if (
    recentlyActiveCache?.limit === limit &&
    now < recentlyActiveCacheExpiration
  ) {
    return recentlyActiveCache.rooms;
  }

  try {
    const cutoff = new Date(now - RECENT_ROOM_ACTIVITY_MS);
    const [recentBlockActivity, sessions] = await Promise.all([
      Block.aggregate([
        { $match: publiclyVisibleBlockMatch({ updatedAt: { $gte: cutoff } }) },
        {
          $group: {
            _id: '$roomId',
            recentPosts: { $sum: 1 },
            lastActivityAt: { $max: '$updatedAt' }
          }
        }
      ]),
      Session.find({ peers: { $exists: true, $ne: {} } }).lean()
    ]);
    const rankedRooms = rankRoomActivity(recentBlockActivity, sessions, new Date(now)).slice(0, limit);
    const rooms = await Room.find({ _id: { $in: rankedRooms.map(room => room.roomId) } }).lean();
    const roomsById = new Map(rooms.map(room => [String(room._id), room]));
    const final = rankedRooms
      .map(activity => {
        const room = roomsById.get(activity.roomId);
        return room ? { ...room, ...activity } : null;
      })
      .filter(Boolean);

    // Cache the final data for 60 seconds
    recentlyActiveCache = { limit, rooms: final };
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
      const { activePeers } = splitPeersByFreshness(session.peers);
      Object.keys(activePeers).forEach(peer => uniqueUsers.add(peer));
    });

    return uniqueUsers.size;
  } catch (error) {
    console.error(`Error fetching active users for room ${roomId}:`, error.message);
    throw error;
  }
}

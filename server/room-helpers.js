import { getCollection, initRoomMetadataCollection } from './mongo.js';

let cachedTopics = null;
let cacheExpiration = 0;

let recentlyActiveCache = null;
let recentlyActiveCacheExpiration = 0;

export async function fetchAndGroupRooms() {
  const now = Date.now();
  if (cachedTopics && now < cacheExpiration) {
    return cachedTopics;
  }

  try {
    await initRoomMetadataCollection();
    const roomsCollection = await getCollection('rooms');
    const rooms = await roomsCollection.find({}).toArray();

    const topics = rooms.reduce((grouped, room) => {
      const topicGroup = grouped.find(g => g.topic === room.topic);
      if (topicGroup) {
        topicGroup.rooms.push(room);
      } else {
        grouped.push({ topic: room.topic, rooms: [room] });
      }
      return grouped;
    }, []);

    topics.sort((a, b) => a.topic.localeCompare(b.topic));
    topics.forEach(topic => {
      topic.rooms.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Cache the sorted topics
    cachedTopics = topics;
    cacheExpiration = now + 10 * 60 * 1000; // Cache for 10 minutes

    return topics;
  } catch (error) {
    console.error('Error fetching and grouping rooms:', error.message);
    throw error;
  }
}

export async function getRecentlyActiveRooms(limit = 5) {
  const now = Date.now();

  // Use cache if valid
  if (recentlyActiveCache && now < recentlyActiveCacheExpiration) {
    return recentlyActiveCache;
  }

  try {
    const sessionData = await getCollection('session');
    const cursor = sessionData.find({}, { projection: { _id: 1, peers: 1 } });

    const activityData = [];
    await cursor.forEach(doc => {
      const activeUsers = Object.keys(doc.peers || {}).length;
      if (activeUsers > 0) {
        activityData.push({ roomId: doc._id, activeUsers });
      }
    });

    activityData.sort((a, b) => b.activeUsers - a.activeUsers);
    const topRooms = activityData.slice(0, limit);

    const roomMetadata = await getCollection('rooms');
    const results = await Promise.all(
      topRooms.map(async ({ roomId, activeUsers }) => {
        const room = await roomMetadata.findOne({ _id: roomId });
        return room ? { ...room, activeUsers } : null;
      })
    );

    // Filter out null values and cache results
    recentlyActiveCache = results.filter(Boolean);
    recentlyActiveCacheExpiration = now + 60 * 1000; // Cache for 60 seconds

    return recentlyActiveCache;
  } catch (error) {
    console.error('Error fetching recently active rooms:', error.message);
    throw error;
  }
}

export async function getActiveUsers(roomId) {
  try {
    const sessionData = await getCollection('session');
    const doc = await sessionData.findOne({ _id: roomId }, { projection: { peers: 1 } });

    if (!doc || !doc.peers) {
      return 0; // No active users
    }

    return Object.keys(doc.peers).length;
  } catch (error) {
    console.error(`Error fetching active users for room ${roomId}:`, error.message);
    throw error;
  }
}
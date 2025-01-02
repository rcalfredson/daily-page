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

  // Check if the cache is valid
  if (recentlyActiveCache && now < recentlyActiveCacheExpiration) {
    return recentlyActiveCache;
  }

  try {
    const sessionData = await getCollection('session');
    const peerIDsDoc = await sessionData.findOne({ _id: 'peerIDs' });

    if (!peerIDsDoc) return [];

    const activityData = Object.entries(peerIDsDoc)
      .filter(([key]) => key !== '_id') // Exclude MongoDB ID field
      .map(([roomId, peers]) => ({
        roomId,
        activeUsers: Object.keys(peers).length,
      }))
      .sort((a, b) => b.activeUsers - a.activeUsers) // Sort by activity
      .slice(0, limit); // Limit to top N

    const roomMetadata = await getCollection('rooms');
    const results = await Promise.all(
      activityData.map(async ({ roomId, activeUsers }) => {
        const room = await roomMetadata.findOne({ _id: roomId });
        return room ? { ...room, activeUsers } : null;
      })
    );

    // Filter out null values and store in cache
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
    const peerIDsDoc = await sessionData.findOne({ _id: 'peerIDs' });

    if (!peerIDsDoc || !peerIDsDoc[roomId]) {
      return 0; // No active users
    }

    return Object.keys(peerIDsDoc[roomId]).length;
  } catch (error) {
    console.error(`Error fetching active users for room ${roomId}:`, error.message);
    throw error;
  }
}
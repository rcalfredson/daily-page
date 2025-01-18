import Room from './models/Room.js';

let cachedTopics = null;
let cacheExpiration = 0;

/**
 * Gets metadata for one room by ID
 */
export async function getRoomMetadata(roomId) {
  try {
    return (await Room.findOne({ _id: roomId })).toObject();
  } catch (error) {
    console.error(`Error fetching room metadata for ID: ${roomId}`, error.message);
    throw error;
  }
}

/**
 * Gets *all* rooms
 */
export async function getAllRooms() {
  try {
    return (await Room.find({})).map(doc => doc.toObject());
  } catch (error) {
    console.error('Error fetching all rooms:', error.message);
    throw error;
  }
}

/**
 * Fetches & groups rooms by their topic, caching the result 
 * for 10 minutes.
 */
export async function fetchAndGroupRooms() {
  const now = Date.now();
  if (cachedTopics && now < cacheExpiration) {
    return cachedTopics;
  }

  try {
    // Grab rooms from the DB
    const rooms = (await Room.find({})).map(doc => doc.toObject());

    // Build grouped topics
    const topics = rooms.reduce((grouped, room) => {
      const topicGroup = grouped.find(g => g.topic === room.topic);
      if (topicGroup) {
        topicGroup.rooms.push(room);
      } else {
        grouped.push({ topic: room.topic, rooms: [room] });
      }
      return grouped;
    }, []);

    // Sort topics and rooms
    topics.sort((a, b) => a.topic.localeCompare(b.topic));
    topics.forEach(topic => {
      topic.rooms.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Cache the sorted topics for 10 mins
    cachedTopics = topics;
    cacheExpiration = now + 10 * 60 * 1000;

    return topics;
  } catch (error) {
    console.error('Error fetching and grouping rooms:', error.message);
    throw error;
  }
}

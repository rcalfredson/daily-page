import { getCollection, initRoomMetadataCollection } from './mongo.js';

let cachedTopics = null;
let cacheExpiration = 0;

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
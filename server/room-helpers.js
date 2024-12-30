import { getCollection, initRoomMetadataCollection } from './mongo.js';

export async function fetchAndGroupRooms() {
  try {
    await initRoomMetadataCollection(); // Ensure the collection is initialized
    const roomsCollection = await getCollection('rooms');
    const rooms = await roomsCollection.find({}).toArray();

    // Group rooms by topic
    const topics = rooms.reduce((grouped, room) => {
      const topicGroup = grouped.find(g => g.topic === room.topic);
      if (topicGroup) {
        topicGroup.rooms.push(room);
      } else {
        grouped.push({ topic: room.topic, rooms: [room] });
      }
      return grouped;
    }, []);

    return topics;
  } catch (error) {
    console.error('Error fetching and grouping rooms:', error.message);
    throw error;
  }
}

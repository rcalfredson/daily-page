import Room from './models/Room.js';

let cachedTopics = null;
let cacheExpiration = 0;


function resolveRoomField(room, field, lang) {
  const map = room?.[`${field}_i18n`];
  if (map) {
    const getVal = (m, key) =>
      (typeof m.get === 'function') ? m.get(key) : m[key];

    const hit = getVal(map, lang);
    if (hit) return hit;

    const en = getVal(map, 'en');
    if (en) return en;

    const first = (typeof map.get === 'function')
      ? (map.size ? map.values().next().value : undefined)
      : Object.values(map)[0];

    if (first) return first;
  }
  return room?.[field]; // legacy fallback
}

export function toRoomI18nDTO(room, lang) {
  return {
    ...room,
    displayName: resolveRoomField(room, 'name', lang),
    displayDescription: resolveRoomField(room, 'description', lang)
  };
}

/**
 * Gets metadata for one room by ID
 */
export async function getRoomMetadata(roomId, lang = null) {
  try {
    const doc = await Room.findOne({ _id: roomId });
    const obj = doc?.toObject();
    if (!obj) return null;
    return lang ? toRoomI18nDTO(obj, lang) : obj;
  } catch (error) {
    console.error(`Error fetching room metadata for ID: ${roomId}`, error.message);
    throw error;
  }
}

/**
 * Gets *all* rooms
 */
export async function getAllRooms(lang = null) {
  try {
    const rooms = (await Room.find({})).map(doc => doc.toObject());
    return lang ? rooms.map(r => toRoomI18nDTO(r, lang)) : rooms;
  } catch (error) {
    console.error('Error fetching all rooms:', error.message);
    throw error;
  }
}

export async function getTotalRooms() {
  return await Room.countDocuments({});
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

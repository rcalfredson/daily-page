import Room from './models/Room.js';

let cachedTopicsByLang = new Map();

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
    displayDescription: resolveRoomField(room, 'description', lang),
    displayTopic: resolveRoomField(room, 'topic', lang)
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
export async function fetchAndGroupRooms(lang = null) {
  const now = Date.now();
  const hit = cachedTopicsByLang.get(lang || 'raw');
  if (hit && now < hit.exp) return hit.topics;

  try {
    const docs = (await Room.find({})).map(d => d.toObject());
    const rooms = lang ? docs.map(r => toRoomI18nDTO(r, lang)) : docs;

    const topics = rooms.reduce((grouped, room) => {
      const topicLabel = lang ? (room.displayTopic || room.topic) : room.topic;
      let topicGroup = grouped.find(g => g.topic === topicLabel);
      if (!topicGroup) {
        topicGroup = { topic: topicLabel, rooms: [] };
        grouped.push(topicGroup);
      }
      topicGroup.rooms.push(room);
      return grouped;
    }, []);

    // Sort “locale-aware”
    const collator = new Intl.Collator(lang || 'en');
    topics.sort((a, b) => collator.compare(a.topic, b.topic));
    topics.forEach(t => t.rooms.sort((a, b) =>
      collator.compare(a.displayName || a.name, b.displayName || b.name)
    ));

    // Cache 10 min por lang
    cachedTopicsByLang.set(lang || 'raw', { topics, exp: now + 10 * 60 * 1000 });
    return topics;
  } catch (error) {
    console.error('Error fetching and grouping rooms:', error.message);
    throw error;
  }
}

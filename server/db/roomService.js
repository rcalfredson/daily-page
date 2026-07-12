import Room from './models/Room.js';
import * as cache from '../services/cache.js';

let cachedTopicsByLang = new Map();
let cachedRawRooms = null;
let rawRoomsPromise = null;

const ROOM_STALE_TTL = 30 * 60 * 1000;
const ROOM_DIRECTORY_TTL = 10 * 60 * 1000;

function refreshRawRooms() {
  if (rawRoomsPromise) return rawRoomsPromise;

  rawRoomsPromise = Room.find({}).lean().then(rooms => {
    cachedRawRooms = {
      rooms,
      exp: Date.now() + ROOM_DIRECTORY_TTL,
    };
    cachedTopicsByLang.clear();
    return rooms;
  }).finally(() => {
    rawRoomsPromise = null;
  });

  return rawRoomsPromise;
}

async function fetchRawRooms() {
  const now = Date.now();
  if (cachedRawRooms && now < cachedRawRooms.exp) {
    return cachedRawRooms.rooms;
  }

  if (cachedRawRooms) {
    void refreshRawRooms().catch(error => {
      console.error('Failed to refresh room directory cache:', error);
    });
    return cachedRawRooms.rooms;
  }

  return await refreshRawRooms();
}

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
    return await cache.get(
      `room-metadata-${roomId}-${lang || 'raw'}`,
      async () => {
        const doc = await Room.findOne({ _id: roomId });
        const obj = doc?.toObject();
        if (!obj) return null;
        return lang ? toRoomI18nDTO(obj, lang) : obj;
      },
      [],
      { ttlMs: 10 * 60 * 1000, staleTtlMs: ROOM_STALE_TTL }
    );
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
  return await cache.get(
    'total-rooms',
    () => Room.countDocuments({}),
    [],
    { ttlMs: 10 * 60 * 1000, staleTtlMs: ROOM_STALE_TTL }
  );
}

/**
 * Fetches & groups rooms by their topic, caching the result 
 * for 10 minutes.
 */
export async function fetchAndGroupRooms(lang = null) {
  const now = Date.now();
  const hit = cachedTopicsByLang.get(lang || 'raw');
  if (hit && now < hit.exp) {
    return hit.topics;
  }

  try {
    const rawRooms = await fetchRawRooms();
    const rooms = lang ? rawRooms.map(r => toRoomI18nDTO(r, lang)) : rawRooms;

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
    cachedTopicsByLang.set(lang || 'raw', { topics, exp: Date.now() + ROOM_DIRECTORY_TTL });
    return topics;
  } catch (error) {
    console.error('Error fetching and grouping rooms:', error.message);
    throw error;
  }
}

export async function warmRoomDirectoryCache(lang = 'en') {
  const startedAt = Date.now();
  const topics = await fetchAndGroupRooms(lang);
  console.info('[rooms-cache] warmed', {
    lang,
    durationMs: Date.now() - startedAt,
    topicCount: topics.length,
    roomCount: topics.reduce((count, topic) => count + topic.rooms.length, 0),
  });
}

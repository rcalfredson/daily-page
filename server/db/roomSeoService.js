import Block from './models/Block.js';
import { publiclyVisibleBlockMatch } from '../services/blockVisibility.js';
import { SUPPORTED_UI_LANGS } from '../services/localeContext.js';
import * as cache from '../services/cache.js';

export function roomDiscoveryStatsPipeline() {
  return [
    { $match: publiclyVisibleBlockMatch() },
    { $group: {
      _id: { roomId: '$roomId', family: { $ifNull: ['$groupId', '$_id'] } },
      languages: { $addToSet: '$lang' }
    } },
    { $group: { _id: '$_id.roomId', postCount: { $sum: 1 }, languages: { $push: '$languages' } } }
  ];
}

export function meaningfulRoomLocales(room, languages) {
  const read = (field, lang) => {
    const map = room?.[`${field}_i18n`];
    return map?.get?.(lang) || map?.[lang] || (lang === 'en' ? room?.[field] : null);
  };
  return SUPPORTED_UI_LANGS.filter(lang => languages.includes(lang)
    && String(read('name', lang) || '').trim()
    && String(read('description', lang) || '').trim());
}

// One small aggregation shared by landing pages and sitemap requests. Count
// distinct public families, not translated editions; no article content is read.
export async function getRoomDiscoveryStats() {
  return cache.get('seo-room-discovery-stats', async () => {
    const rows = await Block.aggregate(roomDiscoveryStatsPipeline());
    return Object.fromEntries(rows.map(row => [row._id, {
      postCount: row.postCount,
      languages: [...new Set(row.languages.flat())]
    }]));
  }, [], 60 * 1000);
}

export function roomSeoFacts(room, stats = {}) {
  const data = stats[String(room?._id)] || { postCount: 0, languages: [] };
  return { postCount: data.postCount, availableLocales: meaningfulRoomLocales(room, data.languages) };
}

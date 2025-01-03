import { getCollection } from './mongo.js';

let cachedContent = null;
let cacheExpiration = 0;

export async function getFeaturedContent() {
  const now = Date.now();

  // Use cached content if it's still valid
  if (cachedContent && now < cacheExpiration) {
    return cachedContent;
  }

  try {
    const pagesCollection = await getCollection('pages');

    const latestContent = await pagesCollection
      .find({
        content: {
          $exists: true,
          $regex: /\w/ // Matches at least one word character (alphanumeric or underscore)
        }
      })
      .sort({ date: -1 })
      .limit(1)
      .toArray();

    if (!latestContent.length) {
      return null;
    }

    const featured = latestContent[0];
    cachedContent = {
      room: featured.room,
      content: featured.content.slice(0, 200),
      date: featured.date,
    };

    // Cache for 1 hour
    cacheExpiration = now + 60 * 60 * 1000;

    return cachedContent;
  } catch (error) {
    console.error('Error fetching featured content:', error.message);
    return null;
  }
}

import { getLatestNonEmptyPage } from '../db/pageService.js';
import { archiveContent } from '../utils/view.js';

let cachedContent = null;
let cacheExpiration = 0;

export async function getFeaturedContent() {
  const now = Date.now();

  // Use cached content if it's still valid
  if (cachedContent && now < cacheExpiration) {
    return cachedContent;
  }

  try {
    const latestContent = await getLatestNonEmptyPage();
    if (!latestContent.length) {
      return null;
    }

    const featured = latestContent[0];
    cachedContent = {
      room: featured.room,
      content: archiveContent({content: featured.content.slice(0, 320) + '...'})[1],
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

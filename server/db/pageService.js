import sanitizeHtml from 'sanitize-html';
import DateHelper from '../../lib/dateHelper.js';
import Page from './models/Page.js';

/**
 * Insert or update a page document (identified by date + room).
 */
export async function updatePage(content, room) {
  const date = DateHelper.currentDate();
  const [year, month, day] = date.split('-');

  return Page.updateOne(
    { date, room, year, month, day },
    {
      $set: {
        content: sanitizeHtml(content, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'width']
          }
        }),
        lastUpdate: Date.now(),
      },
    },
    { upsert: true }
  );
}

/**
 * Returns a "combined" page's content for a given date, 
 * sorted by room name.
 */
export async function pageByDate(date) {
  let pages = await Page.find({ date });
  if (pages.length === 0) {
    return null;
  }
  pages = pages.map(doc => doc.toObject());

  // Sort by room name ascending
  pages.sort((docA, docB) => {
    const roomA = docA.room.toUpperCase();
    const roomB = docB.room.toUpperCase();
    return roomA.localeCompare(roomB);
  });

  // Merge content
  const content = pages.map(doc => doc.content).join('\n');
  return { content };
}

/**
 * Returns *all* pages for a given date as an array
 */
export async function pagesByDate(date) {
  try {
    let pages = await Page.find({ date });
    return pages.map(doc => doc.toObject());
  } catch (error) {
    console.error(`Error fetching pages for date: ${date}`, error.message);
    return [];
  }
}

/**
 * Return a single page doc by date & room. 
 * The old code did a weird "options" approach. Let's mimic that.
 */
export async function pageByDateAndRoom(date, room, options = {}) {
  // Convert any string "true"/"false" to 1 or 0
  const keysToConvertToInt = ['lastUpdate'];
  keysToConvertToInt.forEach((k) => {
    if (options[k] === 'true') {
      options[k] = 1;
    } else if (options[k] === 'false') {
      options[k] = 0;
    }
  });

  // We'll do a .select(...) to replicate your "projection"
  // If options is empty, no need to do anything fancy
  const projection = options ? { ...options } : null;
  if (projection) projection._id = 0; // old code suppressed _id

  const doc = await Page.findOne({ date, room }).select(projection);
  if (!doc) return null;
  return doc.toObject(); 
}

/**
 * Returns all dates that have pages for a given year/month
 * and that have non-empty content
 */
export async function getPageDatesByYearAndMonth(year, month) {
  let docs = await Page.find({ year, month }, null, { sort: { date: -1 } });
  docs = docs.map(doc => doc.toObject());

  // The old code checks for non-empty content
  const filtered = docs.filter(doc => {
    // Filter out pages that basically have empty content
    if (!doc.content) return false;
    // If doc.content is just spaces or has a zero-width space, skip
    if (doc.content.charCodeAt(0) === 8203 && doc.content.length === 1) return false;
    if (!doc.content.trim()) return false;
    return true;
  });

  // Return unique dates
  const uniqueDates = [...new Set(filtered.map(doc => doc.date))];
  return uniqueDates;
}

/**
 * Returns all year-month combos that actually have pages with content
 * (like your old getPageMonthYearCombos logic).
 */
export async function getPageMonthYearCombos() {
  const pipeline = [
    {
      $project: {
        date: { $dateFromString: { dateString: '$date' } },
        year: '$year',
        month: '$month',
        content: '$content',
      },
    },
    { $sort: { date: -1 } },
  ];
  const aggDocs = await Page.aggregate(pipeline).exec();

  // The old code reduces it to a unique set of {year, month} combos
  const results = [];
  for (const doc of aggDocs) {
    // Check if we’ve already seen this year+month
    const exists = results.some(r => r.year === doc.year && r.month === doc.month);
    // Check if content is non-empty
    const isEmpty =
      doc.content?.charCodeAt(0) === 8203 && doc.content.length === 1
      || !(doc.content?.trim()?.length > 0);

    if (!exists && !isEmpty) {
      results.push({ year: doc.year, month: doc.month });
    }
  }

  return results;
}

/**
 * Retrieve or create a page doc for a date & room 
 */
export async function getPageForRoom(date, room, options) {
  try {
    const page = await pageByDateAndRoom(date, room, options);
    if (!page) {
      throw new Error('Page does not exist.');
    }
    return page;
  } catch (error) {
    // If we don't find a page, we create it with empty content
    await updatePage('', room);
    return pageByDateAndRoom(date, room, options);
  }
}

/**
 * Generic "getPage" logic—if room is provided, 
 * get the single page doc, else get the merged content for that date
 */
export async function getPage(
  date = DateHelper.currentDate(),
  room = null,
  options = null
) {
  if (room) {
    return getPageForRoom(date, room, options);
  }
  return pageByDate(date);
}

export async function getLatestNonEmptyPage() {
  let pages = await Page.find({
    content: { $exists: true, $regex: /\w/ }
  })
    .sort({ date: -1 })
    .limit(1);
  return pages.map(doc => doc.toObject());
}

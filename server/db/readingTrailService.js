import Block from './models/Block.js';
import ReadingTrail from './models/ReadingTrail.js';
import { getRoomMetadataByIds } from './roomService.js';
import {
  inspectReadingTrailLocales,
  isReadingTrailAvailableInLocale,
  localizedTrailNote,
  localizedTrailValue
} from './readingTrailDomain.js';
import { resolvePostTranslation } from '../services/postTranslationResolver.js';

const BLOCK_PROJECTION = [
  '_id',
  'groupId',
  'lang',
  'title',
  'description',
  'roomId',
  'creator',
  'authorshipState',
  'bannerImage',
  'createdAt',
  'status',
  'visibility',
  'originalBlock',
  'sourceLanguage'
].join(' ');

function id(value) {
  return value == null ? '' : String(value);
}

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function postKey(groupId, locale) {
  return `${groupId}\u0000${locale}`;
}

function trailPostPath(item, slug) {
  return `/rooms/${encodeURIComponent(item.post.roomId)}/blocks/${encodeURIComponent(item.post.id)}` +
    `?trail=${encodeURIComponent(slug)}`;
}

export function buildReadingTrailPostContext(trail, block) {
  if (!trail || !block?._id || !block?.groupId) return null;
  const index = trail.items.findIndex(item => (
    item.groupId === String(block.groupId) && item.post.id === String(block._id)
  ));
  if (index < 0) return null;

  const previousItem = trail.items[index - 1] || null;
  const nextItem = trail.items[index + 1] || null;
  const navigationItem = item => item ? {
    title: item.post.title,
    path: trailPostPath(item, trail.slug)
  } : null;

  return {
    slug: trail.slug,
    title: trail.title,
    position: index + 1,
    total: trail.items.length,
    overviewPath: `/trails/${encodeURIComponent(trail.slug)}`,
    previous: navigationItem(previousItem),
    next: navigationItem(nextItem),
    isFirst: index === 0,
    isLast: index === trail.items.length - 1
  };
}

function trailPostRequirements(trails) {
  return {
    itemGroupIds: [...new Set(trails.flatMap(trail => trail.items.map(item => item.groupId)))],
    coverGroupIds: [...new Set(trails.map(trail => (
      trail.coverImage?.url ? null : (trail.coverGroupId || trail.items[0]?.groupId)
    )).filter(Boolean))]
  };
}

function readingTrailDTO(trail, locale, posts, postsByKey, roomsById, availableLocales) {
  const title = localizedTrailValue(trail, 'title', locale);
  const description = localizedTrailValue(trail, 'description', locale);
  const items = trail.items.map((item, index) => {
    const post = postsByKey.get(postKey(item.groupId, locale));
    const room = roomsById[post.roomId];
    return {
      position: index + 1,
      groupId: item.groupId,
      note: localizedTrailNote(item, locale),
      post: {
        id: id(post._id),
        groupId: post.groupId,
        lang: post.lang,
        title: post.title,
        description: post.description || '',
        roomId: post.roomId,
        roomName: room?.displayName || room?.name || post.roomId,
        creator: post.creator,
        authorshipState: post.authorshipState,
        bannerImage: post.bannerImage || null,
        createdAt: post.createdAt || null
      }
    };
  });
  const roomCount = new Set(items.map(item => item.post.roomId)).size;
  const coverGroupId = trail.coverGroupId || items[0].groupId;
  const coverFamily = posts.filter(post => (
    post.groupId === coverGroupId && post.bannerImage?.url
  ));
  const resolvedCover = resolvePostTranslation(coverFamily, locale)?.record;
  const coverCaption = localizedTrailValue(trail.coverImage, 'caption', locale);
  const coverPost = trail.coverImage?.url ? {
    id: null,
    groupId: null,
    lang: locale,
    title,
    bannerImage: {
      kind: 'image',
      url: trail.coverImage.url,
      ...(coverCaption ? { caption: coverCaption } : {})
    }
  } : resolvedCover?.bannerImage?.url ? {
    id: id(resolvedCover._id),
    groupId: resolvedCover.groupId,
    lang: resolvedCover.lang,
    title: resolvedCover.title,
    bannerImage: resolvedCover.bannerImage
  } : items[0].post;

  return {
    id: id(trail._id),
    slug: trail.slug,
    sourceLanguage: trail.sourceLanguage,
    locale,
    title,
    description,
    readingCount: items.length,
    roomCount,
    coverPost,
    items,
    availableLocales
  };
}

async function hydrateTrails({ trails, locale, posts, getRooms }) {
  const reportsByTrail = new Map(trails.map(trail => [
    id(trail._id) || trail.slug,
    inspectReadingTrailLocales(trail, posts)
  ]));
  const available = trails.filter(trail => isReadingTrailAvailableInLocale(
    trail,
    locale,
    reportsByTrail.get(id(trail._id) || trail.slug)
  ));
  const postsByKey = new Map(posts.map(post => [postKey(post.groupId, post.lang), post]));
  const roomIds = available.flatMap(trail => trail.items.map(item => (
    postsByKey.get(postKey(item.groupId, locale))?.roomId
  ))).filter(Boolean);
  const roomsById = await getRooms(roomIds, locale);

  return available.map(trail => {
    const reports = reportsByTrail.get(id(trail._id) || trail.slug);
    const readyLocales = reports.filter(report => (
      report.ready && trail.publishedLocales.includes(report.locale)
    )).map(report => report.locale);
    return readingTrailDTO(trail, locale, posts, postsByKey, roomsById, readyLocales);
  });
}

export function buildReadingTrailReadService({
  ReadingTrailModel = ReadingTrail,
  BlockModel = Block,
  getRooms = getRoomMetadataByIds
} = {}) {
  async function findPosts({ itemGroupIds, coverGroupIds }, locales) {
    if (!itemGroupIds.length || !locales.length) return [];
    const postSources = [
      { groupId: { $in: itemGroupIds }, lang: { $in: locales } }
    ];
    if (coverGroupIds.length) postSources.push({ groupId: { $in: coverGroupIds } });
    return BlockModel.find({
      status: 'locked',
      visibility: 'public',
      $or: postSources
    }).sort({ createdAt: 1, _id: 1 }).select(BLOCK_PROJECTION).lean();
  }

  async function listPublicReadingTrails({ locale = 'en' } = {}) {
    const trails = await ReadingTrailModel.find({
      status: 'published',
      publishedLocales: locale
    }).sort({ createdAt: 1, slug: 1 }).lean();
    const posts = await findPosts(trailPostRequirements(trails), [locale]);
    return hydrateTrails({ trails, locale, posts, getRooms });
  }

  async function getPublicReadingTrail({ slug, locale = 'en' }) {
    const trail = await ReadingTrailModel.findOne({
      slug: normalizeSlug(slug),
      status: 'published'
    }).lean();
    if (!trail || !trail.publishedLocales.includes(locale)) return null;

    const posts = await findPosts(trailPostRequirements([trail]), trail.publishedLocales);
    const [hydrated] = await hydrateTrails({ trails: [trail], locale, posts, getRooms });
    return hydrated || null;
  }

  async function getReadingTrailPostContext({ slug, locale = 'en', block }) {
    const trail = await getPublicReadingTrail({ slug, locale });
    return buildReadingTrailPostContext(trail, block);
  }

  return {
    listPublicReadingTrails,
    getPublicReadingTrail,
    getReadingTrailPostContext
  };
}

const defaultService = buildReadingTrailReadService();

export const listPublicReadingTrails = defaultService.listPublicReadingTrails;
export const getPublicReadingTrail = defaultService.getPublicReadingTrail;
export const getReadingTrailPostContext = defaultService.getReadingTrailPostContext;

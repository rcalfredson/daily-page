import { markdownToPlainText } from './markdownHelper.js';

export const POST_META_DESCRIPTION_MAX_LENGTH = 160;

function truncateDescription(value, maxLength = POST_META_DESCRIPTION_MAX_LENGTH) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const sentenceCandidate = normalized.slice(0, maxLength);
  const minimumSentenceLength = Math.floor(maxLength * 0.5);
  const sentenceEndPattern = /[.!?](?:["'’”)\]]*)(?=\s|$)/gu;
  let sentenceEnd = -1;

  for (const match of sentenceCandidate.matchAll(sentenceEndPattern)) {
    const end = match.index + match[0].length;
    if (end >= minimumSentenceLength) sentenceEnd = end;
  }

  if (sentenceEnd >= 0) return sentenceCandidate.slice(0, sentenceEnd);

  const candidate = normalized.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(' ');
  const minimumWordBoundary = Math.floor(maxLength * 0.6);
  const cutAt = lastSpace >= minimumWordBoundary ? lastSpace : candidate.length;
  return `${candidate.slice(0, cutAt).trimEnd()}…`;
}

function isoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function jsonLdStringify(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildPostArticleJsonLd(block, {
  author,
  baseUrl,
  canonicalUrl,
  description,
  roomName
}) {
  const normalizedBaseUrl = String(baseUrl || '').replace(/\/$/, '');
  const hasArticleImage = block?.bannerImage?.url &&
    (!block.bannerImage.kind || block.bannerImage.kind === 'image');
  const datePublished = isoDate(block?.createdAt);
  const dateModified = isoDate(block?.updatedAt);
  const tags = Array.isArray(block?.tags)
    ? block.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${canonicalUrl}#article`,
    url: canonicalUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl
    },
    headline: String(block?.title || '').trim(),
    description,
    inLanguage: block?.lang || undefined,
    datePublished,
    dateModified,
    author: author?.name
      ? {
          '@type': 'Person',
          name: author.name,
          url: author.url || undefined
        }
      : undefined,
    publisher: {
      '@id': `${normalizedBaseUrl}/#organization`
    },
    image: hasArticleImage ? block.bannerImage.url : undefined,
    articleSection: roomName || undefined,
    keywords: tags.length ? tags : undefined
  };

  return jsonLdStringify(article);
}

export function buildPostSeo(block, {
  author,
  siteName,
  baseUrl,
  canonicalUrl,
  includeArticleJsonLd = true,
  roomName
}) {
  const normalizedSiteName = String(siteName || 'Daily Page').trim() || 'Daily Page';
  const postTitle = String(block?.title || normalizedSiteName).trim() || normalizedSiteName;
  const title = `${postTitle} | ${normalizedSiteName}`;
  const descriptionSource = block?.description || block?.content || postTitle;
  const description = truncateDescription(markdownToPlainText(descriptionSource) || postTitle);
  const hasShareableBanner = block?.bannerImage?.url &&
    (!block.bannerImage.kind || block.bannerImage.kind === 'image');
  const normalizedBaseUrl = String(baseUrl || '').replace(/\/$/, '');
  const image = hasShareableBanner
    ? block.bannerImage.url
    : `${normalizedBaseUrl}/assets/img/logo-512.png`;
  const articleJsonLd = includeArticleJsonLd
    ? buildPostArticleJsonLd(block, {
        author,
        baseUrl: normalizedBaseUrl,
        canonicalUrl,
        description,
        roomName
      })
    : null;

  return {
    title,
    description,
    canonicalUrl,
    socialTitle: title,
    socialDescription: description,
    socialImageUrl: image,
    socialImageAlt: hasShareableBanner
      ? (block.bannerImage.caption || postTitle)
      : normalizedSiteName,
    socialCardType: hasShareableBanner ? 'summary_large_image' : 'summary',
    openGraphType: 'article',
    socialPublishedTime: isoDate(block?.createdAt) || null,
    articleJsonLd
  };
}

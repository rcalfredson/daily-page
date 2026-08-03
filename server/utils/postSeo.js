import { markdownToPlainText } from './markdownHelper.js';

export const POST_META_DESCRIPTION_MAX_LENGTH = 160;

function truncateDescription(value, maxLength = POST_META_DESCRIPTION_MAX_LENGTH) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const candidate = normalized.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(' ');
  const cutAt = lastSpace >= Math.floor(maxLength * 0.6) ? lastSpace : candidate.length;
  return `${candidate.slice(0, cutAt).trimEnd()}…`;
}

export function buildPostSeo(block, { siteName, baseUrl, canonicalUrl }) {
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
    socialPublishedTime: block?.createdAt
      ? new Date(block.createdAt).toISOString()
      : null
  };
}

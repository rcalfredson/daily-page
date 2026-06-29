import { normalizeStreetViewEmbedUrl } from '../../lib/streetViewEmbed.js';

const MAX_BANNER_URL_LENGTH = 2048;
const MAX_BANNER_STREET_VIEW_URL_LENGTH = 8192;
const MAX_BANNER_CAPTION_LENGTH = 300;

export function isValidBannerImageUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_BANNER_URL_LENGTH) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidBannerStreetViewUrl(value) {
  return typeof value === 'string' &&
    value.length <= MAX_BANNER_STREET_VIEW_URL_LENGTH &&
    normalizeStreetViewEmbedUrl(value) !== null;
}

export function normalizeBannerImageInput(input) {
  if (input === undefined) return { value: undefined, shouldUnset: false };

  const url = String(input?.url || '').trim();
  const caption = String(input?.caption || '').trim();
  const kind = String(input?.kind || 'image').trim();

  if (!url) return { value: undefined, shouldUnset: true };
  if (kind !== 'image' && kind !== 'streetview') {
    throw new Error('Banner kind must be image or streetview.');
  }
  if (kind === 'image' && !isValidBannerImageUrl(url)) {
    throw new Error('Banner image URL must be a valid http or https URL.');
  }
  if (kind === 'streetview' && !isValidBannerStreetViewUrl(url)) {
    throw new Error('Street View banner must use a valid Google Maps embed URL.');
  }
  if (caption.length > MAX_BANNER_CAPTION_LENGTH) {
    throw new Error(`Banner caption cannot exceed ${MAX_BANNER_CAPTION_LENGTH} characters.`);
  }

  const normalizedUrl = kind === 'streetview'
    ? normalizeStreetViewEmbedUrl(url)
    : url;

  return {
    value: caption
      ? { kind, url: normalizedUrl, caption }
      : { kind, url: normalizedUrl },
    shouldUnset: false
  };
}

export {
  MAX_BANNER_URL_LENGTH,
  MAX_BANNER_STREET_VIEW_URL_LENGTH,
  MAX_BANNER_CAPTION_LENGTH
};

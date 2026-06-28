const MAX_BANNER_URL_LENGTH = 2048;
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

export function normalizeBannerImageInput(input) {
  if (input === undefined) return { value: undefined, shouldUnset: false };

  const url = String(input?.url || '').trim();
  const caption = String(input?.caption || '').trim();

  if (!url) return { value: undefined, shouldUnset: true };
  if (!isValidBannerImageUrl(url)) {
    throw new Error('Banner image URL must be a valid http or https URL.');
  }
  if (caption.length > MAX_BANNER_CAPTION_LENGTH) {
    throw new Error(`Banner image caption cannot exceed ${MAX_BANNER_CAPTION_LENGTH} characters.`);
  }

  return {
    value: caption ? { url, caption } : { url },
    shouldUnset: false
  };
}

export { MAX_BANNER_URL_LENGTH, MAX_BANNER_CAPTION_LENGTH };

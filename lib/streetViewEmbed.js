const STREET_VIEW_PREFIX = '@[streetview](';
const MAX_EMBED_URL_LENGTH = 8192;

export function normalizeStreetViewEmbedUrl(rawUrl) {
  const candidate = String(rawUrl || '').trim();
  if (!candidate || candidate.length > MAX_EMBED_URL_LENGTH) return null;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'www.google.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/maps/embed' ||
    url.hash
  ) {
    return null;
  }

  const params = Array.from(url.searchParams.entries());
  if (
    params.length !== 1 ||
    params[0][0] !== 'pb' ||
    !params[0][1]
  ) {
    return null;
  }

  return url.href;
}

function streetViewEmbedRule(state, silent) {
  const start = state.pos;
  if (!state.src.startsWith(STREET_VIEW_PREFIX, start)) return false;

  const urlStart = start + STREET_VIEW_PREFIX.length;
  const end = state.src.indexOf(')', urlStart);
  if (end === -1) return false;

  const src = normalizeStreetViewEmbedUrl(state.src.slice(urlStart, end));
  if (!src) return false;

  if (!silent) {
    const token = state.push('streetview_embed', 'iframe', 0);
    token.meta = { src };
  }

  state.pos = end + 1;
  return true;
}

export function streetViewEmbedPlugin(md) {
  md.inline.ruler.before('link', 'streetview_embed', streetViewEmbedRule);

  md.renderer.rules.streetview_embed = (tokens, index, options, env = {}) => {
    const src = md.utils.escapeHtml(tokens[index].meta.src);

    if (env.allowStreetViewEmbeds === false) {
      return `<a class="street-view-embed-link" href="${src}">Google Street View</a>`;
    }

    return '<span class="street-view-embed">' +
      `<iframe src="${src}" title="Google Maps Street View" loading="lazy" ` +
      'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' +
      '</span>';
  };
}

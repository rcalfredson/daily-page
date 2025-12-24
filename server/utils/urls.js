// server/utils/urls.js

export function withQuery(path, query = {}) {
  const [base, existingQs] = String(path).split('?');
  const params = new URLSearchParams(existingQs || '');

  for (const [k, v] of Object.entries(query || {})) {
    if (v == null || v === '') continue;
    params.set(k, String(v));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}


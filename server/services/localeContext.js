// server/services/localeContext.js

export function getUiLang(res) {
  return res?.locals?.uiLang || res?.locals?.lang || 'en';
}

export function getUiLangFromReq(req) {
  const fromCookie = req.cookies?.ui;
  if (fromCookie) return fromCookie;

  const fromHeader = (req.acceptsLanguages?.()?.[0] || 'en').split('-')[0];
  return fromHeader || 'en';
}

/**
 * Default policy for list selection / variant picking:
 * prefer the same language as the UI chrome.
 * (Can be upgraded later to use user preference, cookies, etc.)
 */
export function getPreferredContentLang(res) {
  return getUiLang(res);
}

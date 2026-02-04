// server/services/localeContext.js

export const SUPPORTED_UI_LANGS = ['en', 'es'];
export const DEFAULT_UI_LANG = 'en';

export function isSupportedUiLang(l) {
  return SUPPORTED_UI_LANGS.includes(l);
}

export function getUiLang(res) {
  return res?.locals?.uiLang || res?.locals?.lang || DEFAULT_UI_LANG;
}

export function getUiLangFromReq(req) {
  const fromCookie = req.cookies?.ui;
  if (fromCookie && isSupportedUiLang(fromCookie)) return fromCookie;

  const fromHeader = (req.acceptsLanguages?.()?.[0] || DEFAULT_UI_LANG).split('-')[0];
  return isSupportedUiLang(fromHeader) ? fromHeader : DEFAULT_UI_LANG;
}

/**
 * Default policy for list selection / variant picking:
 * prefer the same language as the UI chrome.
 */
export function getPreferredContentLang(res) {
  return getUiLang(res);
}

// server/middleware/uiLangFallbackNotice.js
import { DEFAULT_UI_LANG, isSupportedUiLang } from '../services/localeContext.js';

export function uiLangFallbackNotice(req, res, next) {
  const fromQuery = req.query?.ui ? String(req.query.ui) : null;
  const fromCookie = req.cookies?.ui_requested ? String(req.cookies.ui_requested) : null;

  const requested = fromQuery || fromCookie;
  if (!requested) return next();

  // If requested is actually supported, clear any stale cookie and move on
  if (isSupportedUiLang(requested)) {
    if (fromCookie) res.clearCookie('ui_requested', { path: '/' });
    return next();
  }

  const dismissed = req.cookies?.ui_fallback_hide === requested;

  if (!dismissed) {
    res.locals.uiLangFallbackFrom = requested;
    res.locals.uiLangIsFallback = true;
  }

  // Key change: if this banner was triggered by the redirect cookie,
  // clear it now so it doesn't "stick" when the user later browses /en or /es.
  if (fromCookie) {
    res.clearCookie('ui_requested', { path: '/' });
  }

  // Ensure effective UI lang is default (but don't fight uiPrefix if it already did it)
  if (!res.locals.uiLang || !isSupportedUiLang(res.locals.uiLang)) {
    res.locals.uiLang = DEFAULT_UI_LANG;
  }

  next();
}

// server/middleware/uiLangFallbackNotice.js
import { DEFAULT_UI_LANG, isSupportedUiLang } from '../services/localeContext.js';

export function uiLangFallbackNotice(req, res, next) {
  const requested =
    (req.query?.ui ? String(req.query.ui) : null) ||
    (req.cookies?.ui_requested ? String(req.cookies.ui_requested) : null);

  if (!requested) return next();

  // If requested is actually supported, clear any stale cookie and move on
  if (isSupportedUiLang(requested)) {
    if (req.cookies?.ui_requested) res.clearCookie('ui_requested', { path: '/' });
    return next();
  }

  const dismissed = req.cookies?.ui_fallback_hide === requested;
  if (!dismissed) {
    res.locals.uiLangFallbackFrom = requested;
    res.locals.uiLangIsFallback = true;
  }

  // Ensure effective UI lang is default (but don't fight uiPrefix if it already did it)
  if (!res.locals.uiLang || !isSupportedUiLang(res.locals.uiLang)) {
    res.locals.uiLang = DEFAULT_UI_LANG;
  }

  next();
}

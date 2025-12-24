// server/services/localization.js

const supportedLanguages = [
  'en',
  'es',
  'fr',
  'ru',
  'id',
  'de',
  'it',
  'pt',
  'zh',
  'ja',
  'ko',
  'ar',
  'hi',
  'tr',
  'nl',
  'sv',
  'no',
  'da',
  'fi',
  'pl',
  'cs',
  'el',
  'he',
  'th',
  'vi',
];
const defaultLanguage = 'en';

function isBlockContentRoute(req) {
  // only the canonical view route
  return /^\/rooms\/[^/]+\/blocks\/[^/]+\/?$/.test(req.path);
}

function isSupported(lang) {
  return !!lang && supportedLanguages.includes(lang);
}

export function getPreferredUiLang(req, {
  supported = supportedLanguages,
  fallback = defaultLanguage
} = {}) {
  const ui = req.query?.ui;
  if (ui && supported.includes(ui)) return ui;

  // Cookie preference (if previously set)
  const cookieUi = req.cookies?.ui;
  if (cookieUi && supported.includes(cookieUi)) return cookieUi;
  
  // Back-compat: old behavior (?lang= used to mean UI) ONLY off block routes
  const legacy = req.query?.lang;
  if (!isBlockContentRoute(req) && legacy && supported.includes(legacy)) return legacy;

  const best = req.acceptsLanguages(supported);
  return best || fallback;
}

export default function setLangMiddleware(req, res, next) {
  const uiLang = getPreferredUiLang(req);
  res.locals.uiLang = uiLang;
  req.uiLang = uiLang;

  // Transitional alias so your existing initI18n/layout don't explode:
  res.locals.lang = uiLang;
  req.lang = uiLang;

  // If user explicitly set UI via query param, persist it.
  const uiParam = req.query?.ui;
  if (isSupported(uiParam) && uiParam !== req.cookies?.ui) {
    res.cookie('ui', uiParam, {
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  next();
}

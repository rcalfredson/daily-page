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

function isLangContentOnlyRoute(req) {
  // only the canonical view route
  return /^\/rooms\/[^/]+\/blocks\/[^/]+\/?$/.test(req.path);
}

function pickSupportedLang(raw, supported) {
  if (!raw) return null;

  // If array (e.g. ?ui=en&ui=es), pick the first supported
  if (Array.isArray(raw)) {
    return raw.find((v) => supported.includes(v)) || null;
  }

  // If string, trim and accept if supported
  if (typeof raw === 'string') {
    const v = raw.trim();
    return supported.includes(v) ? v : null;
  }

  return null;
}

export function getUiQueryLang(req, { supported = supportedLanguages } = {}) {
  return pickSupportedLang(req.query?.ui, supported);
}

export function getPreferredUiLang(req, { supported = supportedLanguages, fallback = defaultLanguage } = {}) {
  const ui = pickSupportedLang(req.query?.ui, supported);
  if (ui) return ui;

  const cookieUi = pickSupportedLang(req.cookies?.ui, supported);
  if (cookieUi) return cookieUi;

  const legacy = pickSupportedLang(req.query?.lang, supported);
  if (!isLangContentOnlyRoute(req) && legacy) return legacy;

  const best = req.acceptsLanguages(supported);
  return best || fallback;
}

export default function setLangMiddleware(req, res, next) {
  const uiLang = getPreferredUiLang(req);
  res.locals.uiLang = uiLang;
  req.uiLang = uiLang;

  res.locals.lang = uiLang;
  req.lang = uiLang;

  const uiParam = pickSupportedLang(req.query?.ui, supportedLanguages);
  if (uiParam && uiParam !== req.cookies?.ui) {
    res.cookie('ui', uiParam, {
      maxAge: 1000 * 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  next();
}
